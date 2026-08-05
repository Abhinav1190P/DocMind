import json
import logging
from app.core.llm import get_llm
from app.agent.tools import TOOL_REGISTRY
from langchain.schema import SystemMessage, HumanMessage, AIMessage

logger = logging.getLogger("docmind.agent")

MAX_STEPS = 4

PLANNER_SYSTEM_PROMPT = """You are DocMind's planning module. The user's uploaded documents have
already been searched automatically (see the first tool result below). Given that result and the
user's question, decide what to do next.

Available tools for further steps:
{tool_descriptions}

Respond ONLY with a JSON object, no other text, in one of these two forms:

To call a tool:
{{"action": "call_tool", "tool": "<tool_name>", "input": {{...tool parameters...}}}}

To answer directly (when the document search already gave enough information, or a further tool
result now gives enough information):
{{"action": "answer"}}

Rules:
- If the initial retrieve_docs result already answers the question, respond with
  {{"action": "answer"}} immediately - do not call web_search redundantly.
- Only use web_search if retrieve_docs found nothing relevant, or the question is clearly about
  something outside any uploaded document (e.g. current events, general facts not in a corpus).
- MANDATORY: if the question requires ANY arithmetic (percentages, sums, differences, ratios,
  multiplication, division - even something that looks simple like "15% of X"), you MUST call
  calculator. Never compute a numeric result yourself, even mentally, even for simple-looking math.
  This is a hard rule, not a judgment call.
- Do not call the same tool with the same input twice.
- Once you have enough information to answer, respond with {{"action": "answer"}} immediately.
"""

ANSWER_SYSTEM_PROMPT = """You are DocMind, an assistant that answers questions using the tool results
gathered so far.

Rules:
- Only use information present in the tool results below.
- If the tool results do not contain enough information to answer, say so honestly.
- Cite which source supports each claim - use [1], [2] etc. matching the numbered sources below.
- Do not fabricate information not present in the tool results.
- If the answer requires a numeric calculation (percentage, sum, product, etc.) and no calculator
  result appears in the tool results below, say that the calculation could not be completed rather
  than computing it yourself - your own arithmetic is not reliable enough to state as fact.
"""


def _build_tool_descriptions():
    lines = []
    for name, spec in TOOL_REGISTRY.items():
        if name == "retrieve_docs":
            continue  # already run deterministically as the first step
        lines.append(f"- {name}: {spec['description']} Parameters: {spec['parameters']}")
    return "\n".join(lines)


def _format_tool_result_as_sources(tool_name: str, tool_input: dict, result: dict, source_counter: list) -> list:
    sources = []

    if tool_name == "retrieve_docs" and result.get("found"):
        for chunk in result["chunks"]:
            source_counter[0] += 1
            sources.append(
                {
                    "index": source_counter[0],
                    "type": "document",
                    "fileName": chunk["fileName"],
                    "text": chunk["text"],
                    "score": chunk.get("score"),
                }
            )
    elif tool_name == "web_search" and result.get("found"):
        for r in result["results"]:
            source_counter[0] += 1
            sources.append(
                {
                    "index": source_counter[0],
                    "type": "web",
                    "fileName": r["url"],
                    "text": f"{r['title']}: {r['content']}",
                    "score": None,
                }
            )
    elif tool_name == "calculator" and result.get("found"):
        source_counter[0] += 1
        sources.append(
            {
                "index": source_counter[0],
                "type": "calculation",
                "fileName": "calculator",
                "text": f"{tool_input.get('expression')} = {result['result']}",
                "score": None,
            }
        )

    return sources


def run_agent(query: str, user_id: str, history: list = None):
    """
    Runs the agent loop: plan -> call tool -> observe -> repeat or answer.
    Returns (answer, sources, trace) where trace is the list of steps taken (for UI display).
    """
    llm = get_llm()
    history = history or []

    trace = []
    all_sources = []
    source_counter = [0]
    called_tools = set()

    tool_descriptions = _build_tool_descriptions()
    planner_prompt = PLANNER_SYSTEM_PROMPT.format(tool_descriptions=tool_descriptions)

    conversation_so_far = f"User question: {query}\n"

    # Deterministic first step: always check the user's own documents before
    # anything else. This isn't left to the planner's discretion because a
    # small/fast model can't be reliably trusted to prioritize this on its
    # own, and giving the LLM's own documents lower priority than the web
    # undermines the "grounded in your documents" guarantee.
    initial_result = TOOL_REGISTRY["retrieve_docs"]["function"](query, user_id)
    called_tools.add(f"retrieve_docs:{json.dumps({'query': query}, sort_keys=True)}")
    trace.append({"step": 0, "action": "call_tool", "tool": "retrieve_docs", "input": {"query": query}, "result_found": initial_result.get("found")})
    logger.info(f"[AGENT] step 0 (forced): called retrieve_docs -> found={initial_result.get('found')}")

    initial_sources = _format_tool_result_as_sources("retrieve_docs", {"query": query}, initial_result, source_counter)
    all_sources.extend(initial_sources)

    best_doc_score = max((s["score"] for s in initial_sources if s.get("score") is not None), default=0)
    low_relevance = best_doc_score < 0

    relevance_note = (
        f"\nNOTE: the best relevance score among these chunks is {best_doc_score:.2f}, which is "
        "negative - this means the retrieved chunks are NOT actually relevant to the question, "
        "even though the search technically returned results. Treat this as if nothing relevant "
        "was found in the user's documents, and use web_search instead if appropriate.\n"
        if low_relevance and initial_sources
        else ""
    )

    conversation_so_far += (
        f"\nTool call: retrieve_docs({{'query': '{query}'}})\n"
        f"Result: {json.dumps(initial_result)[:1500]}\n"
        f"{relevance_note}"
    )

    for step in range(1, MAX_STEPS):
        planner_messages = [
            SystemMessage(content=planner_prompt),
            HumanMessage(content=conversation_so_far),
        ]

        response = llm.invoke(planner_messages)
        raw = response.content.strip()

        try:
            decision = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"[AGENT] Planner returned non-JSON, defaulting to answer: {raw[:200]}")
            trace.append({"step": step, "action": "answer", "reason": "planner_parse_error"})
            break

        action = decision.get("action")

        if action == "answer":
            trace.append({"step": step, "action": "answer"})
            break

        if action == "call_tool":
            tool_name = decision.get("tool")
            tool_input = decision.get("input", {})
            call_key = f"{tool_name}:{json.dumps(tool_input, sort_keys=True)}"

            if tool_name not in TOOL_REGISTRY:
                trace.append({"step": step, "action": "error", "detail": f"unknown tool {tool_name}"})
                break

            if call_key in called_tools:
                trace.append({"step": step, "action": "skip_duplicate", "tool": tool_name})
                break

            called_tools.add(call_key)

            tool_fn = TOOL_REGISTRY[tool_name]["function"]

            if tool_name == "retrieve_docs":
                result = tool_fn(tool_input.get("query", query), user_id)
            else:
                result = tool_fn(**tool_input)

            trace.append({"step": step, "action": "call_tool", "tool": tool_name, "input": tool_input, "result_found": result.get("found")})
            logger.info(f"[AGENT] step {step}: called {tool_name}({tool_input}) -> found={result.get('found')}")

            new_sources = _format_tool_result_as_sources(tool_name, tool_input, result, source_counter)
            all_sources.extend(new_sources)

            conversation_so_far += f"\nTool call: {tool_name}({tool_input})\nResult: {json.dumps(result)[:1500]}\n"
        else:
            trace.append({"step": step, "action": "unknown_action", "raw": raw[:200]})
            break
    else:
        trace.append({"step": MAX_STEPS, "action": "max_steps_reached"})

    context_block = "\n\n".join(
        f"[{s['index']}] (source: {s['fileName']})\n{s['text']}" for s in all_sources
    )

    history_messages = []
    for turn in history:
        if turn["role"] == "user":
            history_messages.append(HumanMessage(content=turn["content"]))
        else:
            history_messages.append(AIMessage(content=turn["content"]))

    answer_messages = [
        SystemMessage(content=ANSWER_SYSTEM_PROMPT),
        *history_messages,
        HumanMessage(
            content=f"Tool results:\n{context_block if context_block else '(no tool results gathered)'}\n\nQuestion: {query}"
        ),
    ]

    final_response = llm.invoke(answer_messages)

    sources_for_response = [
        {
            "chunkId": f"agent-{s['index']}",
            "fileName": s["fileName"],
            "text": s["text"],
            "score": s["score"],
            "sourceType": s["type"],
        }
        for s in all_sources
    ]

    return final_response.content, sources_for_response, trace
