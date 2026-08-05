import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import ingest, query, agent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

app = FastAPI(title="DocMind RAG Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(query.router)
app.include_router(agent.router)

@app.get("/health")
def health():
    return {"status": "ok"}