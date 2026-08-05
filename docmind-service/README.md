# DocMind RAG Service (Python + LangChain + Groq)

Zero-cost AI microservice: Groq for LLM inference (free tier), local HuggingFace
embeddings (no API calls), MongoDB Atlas free tier for vector storage.

## Setup

```
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env`:
- `GROQ_API_KEY` — free at https://console.groq.com
- `MONGODB_URI` — free Atlas M0 cluster connection string

First run will download the embedding model (~90MB) locally — one-time, then cached.

## MongoDB Atlas Vector Search Index

Create on the `chunks` collection (Atlas UI > Search Indexes):

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    }
  ]
}
```

Note: 384 dimensions (not 1536) since `all-MiniLM-L6-v2` is a smaller local model.
Name the index `vector_index`.

## Run

```
uvicorn app.main:app --reload --port 8000
```

Docs at `http://localhost:8000/docs`

## Endpoints

- `POST /ingest` — multipart form: `user_id`, `file`
- `POST /query` — `{ query, userId, history? }`
- `POST /query/stream` — SSE version
- `GET /health`

## How this fits with the Node/Express server

This service is the "AI brain." The Node server (`docmind-server`) handles auth,
user accounts, and conversation history, then calls this service for anything
RAG-related (ingestion, retrieval, generation). The Node server should forward
`userId` from the authenticated JWT into every call here.
