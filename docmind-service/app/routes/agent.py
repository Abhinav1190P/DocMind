from fastapi import APIRouter, HTTPException
from app.models.schemas import QueryRequest
from app.agent.loop import run_agent

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/query")
async def agent_query(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    answer, sources, trace = run_agent(req.query, req.userId, req.history)

    return {
        "answer": answer,
        "sources": sources,
        "trace": trace,
    }
