# DocMind — Agentic RAG Document Assistant

A full-stack, agentic RAG platform: upload documents, ask questions, get
grounded answers with citations — with a tool-calling agent that can also
search the web and do math when your documents alone aren't enough.

## Architecture

```
docmind-client/        React + Vite frontend
docmind-server/         Node/Express — auth, conversation persistence, proxies to the RAG service
docmind-rag-service/    Python/FastAPI/LangChain — ingestion, retrieval, re-ranking, generation, agent loop
```

```
┌─────────────┐      ┌──────────────┐      ┌────────────────────┐      ┌────────────────┐
│   React     │─────▶│  Node/Express │─────▶│  Python/FastAPI    │─────▶│  Groq (LLM)     │
│  (client)   │      │  (auth, chat  │      │  (RAG + agent)     │      │  Tavily (search)│
│             │◀─────│   history)    │◀─────│                    │◀─────│                 │
└─────────────┘      └──────┬───────┘      └─────────┬──────────┘      └─────────────────┘
                             │                         │
                             ▼                         ▼
                      MongoDB Atlas            MongoDB Atlas Vector Search
                   (users, conversations)        (chunks + embeddings)
```

## Key features

- **RAG pipeline**: PDF ingestion → chunking → local embeddings (free, no
  API cost) → MongoDB Atlas Vector Search → cross-encoder re-ranking →
  Groq (Llama) generation with citations
- **Agentic layer**: a planning loop that decides whether to search the
  user's documents, search the web (Tavily), or run a calculation —
  documents are always checked first (deterministically) so answers stay
  grounded in the user's own sources by default
- **Measured, not assumed**: a 13-question eval harness (`docmind-rag-service/eval/`)
  tracks retrieval accuracy and answer correctness; re-ranking improved the
  pass rate from 85% to 92% (see `eval/FINDINGS.md` for the full before/after
  analysis, including an honestly-documented known limitation)
- **Zero-cost stack**: Groq (free tier) for inference, local HuggingFace
  embeddings (no API calls), MongoDB Atlas free tier, Tavily free tier for
  web search

## Setup

Each service has its own README with detailed setup steps:
- [`docmind-rag-service/README.md`](./docmind-rag-service/README.md)
- [`docmind-server/README.md`](./docmind-server/README.md)
- [`docmind-client/README.md`](./docmind-client/README.md)

Quick start (3 terminals):
```bash
# 1. Python RAG service (port 8000)
cd docmind-rag-service && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# 2. Node server (port 5000)
cd docmind-server && npm run dev

# 3. React frontend (port 5173)
cd docmind-client && npm run dev
```

## Tech stack

**Frontend:** React, Vite, Axios
**Backend:** Node.js, Express, MongoDB (Mongoose)
**AI service:** Python, FastAPI, LangChain, sentence-transformers
**Infra:** MongoDB Atlas (Vector Search), Groq (Llama 3.1), Tavily (web search)