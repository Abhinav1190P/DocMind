from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
from app.models.schemas import QueryRequest, QueryResponse
from app.services.retrieve import retrieve_relevant_chunks
from app.services.generate import generate_answer, generate_answer_stream

router = APIRouter(prefix="/query", tags=["query"])

@router.post("", response_model=QueryResponse)
async def query(req: QueryRequest, rerank: Optional[bool] = True):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    chunks = retrieve_relevant_chunks(req.query, req.userId, use_reranker=rerank)
    answer = generate_answer(req.query, chunks, req.history)

    sources = [
        {
            "chunkId": c["_id"],
            "fileName": c.get("metadata", {}).get("fileName"),
            "text": c["text"],
            "score": c.get("score"),
            "vector_score": c.get("vector_score"),
        }
        for c in chunks
    ]

    return {"answer": answer, "sources": sources}

@router.post("/stream")
async def query_stream(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    chunks = retrieve_relevant_chunks(req.query, req.userId)
    sources = [
        {
            "chunkId": c["_id"],
            "fileName": c.get("metadata", {}).get("fileName"),
            "text": c["text"],
            "score": c.get("score"),
        }
        for c in chunks
    ]

    def event_generator():
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        for token in generate_answer_stream(req.query, chunks, req.history):
            yield f"event: token\ndata: {json.dumps(token)}\n\n"
        yield "event: done\ndata: end\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
