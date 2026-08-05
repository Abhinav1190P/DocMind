import time
import logging
from langchain.schema import SystemMessage, HumanMessage, AIMessage
from app.core.llm import get_llm

logger = logging.getLogger("docmind.generate")

SYSTEM_PROMPT = """You are DocMind, an assistant that answers questions strictly using the provided context.

Rules:
- Only use information present in the context below.
- If the context does not contain enough information to answer, say "I don't have enough information in the provided documents to answer that."
- Cite which source number(s) support each claim using [1], [2], etc.
- Do not fabricate information not present in the context."""

def build_context_block(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks):
        source = chunk.get("metadata", {}).get("fileName", "unknown")
        parts.append(f"[{i + 1}] (source: {source})\n{chunk['text']}")
    return "\n\n".join(parts)

def build_messages(query: str, chunks: list[dict], history: list[dict]):
    context_block = build_context_block(chunks)

    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for turn in history:
        if turn["role"] == "user":
            messages.append(HumanMessage(content=turn["content"]))
        else:
            messages.append(AIMessage(content=turn["content"]))

    messages.append(HumanMessage(content=f"Context:\n{context_block}\n\nQuestion: {query}"))
    return messages

def generate_answer(query: str, chunks: list[dict], history: list[dict] = None) -> str:
    llm = get_llm()
    messages = build_messages(query, chunks, history or [])
    t0 = time.time()
    response = llm.invoke(messages)
    t1 = time.time()
    logger.info(f"[TIMING] llm_generate: {t1 - t0:.3f}s")
    return response.content

def generate_answer_stream(query: str, chunks: list[dict], history: list[dict] = None):
    llm = get_llm()
    messages = build_messages(query, chunks, history or [])
    for chunk in llm.stream(messages):
        if chunk.content:
            yield chunk.content
