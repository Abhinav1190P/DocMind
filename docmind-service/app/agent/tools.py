import os
import ast
import operator
import requests
from app.services.retrieve import retrieve_relevant_chunks

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.Mod: operator.mod,
}


def tool_retrieve_docs(query: str, user_id: str) -> dict:
    """Search the user's uploaded documents for relevant information."""
    chunks = retrieve_relevant_chunks(query, user_id)
    if not chunks:
        return {"found": False, "chunks": []}

    formatted = [
        {
            "text": c["text"],
            "fileName": c.get("metadata", {}).get("fileName", "unknown"),
            "score": c.get("score"),
        }
        for c in chunks
    ]
    return {"found": True, "chunks": formatted}


def tool_web_search(query: str, max_results: int = 4) -> dict:
    """Search the web for current information not in the uploaded documents."""
    if not TAVILY_API_KEY:
        return {"found": False, "error": "Web search is not configured (missing TAVILY_API_KEY)"}

    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "max_results": max_results,
                "include_answer": False,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        results = [
            {"title": r.get("title"), "url": r.get("url"), "content": r.get("content")}
            for r in data.get("results", [])
        ]
        return {"found": len(results) > 0, "results": results}
    except Exception as e:
        return {"found": False, "error": str(e)}


def _safe_eval(node):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.BinOp):
        op_func = SAFE_OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
        return op_func(_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp):
        op_func = SAFE_OPERATORS.get(type(node.op))
        if op_func is None:
            raise ValueError(f"Unsupported operator: {type(node.op).__name__}")
        return op_func(_safe_eval(node.operand))
    raise ValueError(f"Unsupported expression: {ast.dump(node)}")


def tool_calculator(expression: str) -> dict:
    """Evaluate a mathematical expression safely, without using eval()."""
    try:
        tree = ast.parse(expression, mode="eval")
        result = _safe_eval(tree.body)
        if isinstance(result, float):
            result = round(result, 6)
            if result == int(result):
                result = int(result)
        return {"found": True, "result": result}
    except Exception as e:
        return {"found": False, "error": f"Could not evaluate expression: {e}"}


TOOL_REGISTRY = {
    "retrieve_docs": {
        "function": tool_retrieve_docs,
        "description": "Search the user's uploaded documents (PDFs, etc.) for relevant information. Use this for any question that could be answered by content the user has uploaded.",
        "parameters": {"query": "string - the search query"},
    },
    "web_search": {
        "function": tool_web_search,
        "description": "Search the public web for current information. Use this when the question is about something not likely to be in the user's uploaded documents (e.g. current events, general knowledge not in the corpus).",
        "parameters": {"query": "string - the search query"},
    },
    "calculator": {
        "function": tool_calculator,
        "description": "Evaluate a mathematical expression. Use this for any arithmetic instead of computing it yourself, to avoid mistakes. Supports +, -, *, /, **, %.",
        "parameters": {"expression": "string - a Python-style math expression, e.g. '383.3 * 0.15'"},
    },
}
