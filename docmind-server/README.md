# DocMind Server (Node/Express)

Handles auth, user accounts, and conversation persistence. Delegates all
AI/RAG work (ingestion, retrieval, generation) to the Python service
(`docmind-rag-service`), which must be running for uploads and queries to work.

## Setup

```
npm install
cp .env.example .env
```

Fill in `.env`:
- `MONGODB_URI` — same Atlas cluster the Python service uses (or a separate one, your call — this DB only stores users/document metadata/conversations, not chunks/embeddings)
- `JWT_SECRET` — any random string
- `RAG_SERVICE_URL` — where the Python service is running, default `http://localhost:8000`

## Run

Make sure `docmind-rag-service` is running first (port 8000), then:

```
npm run dev
```

## Architecture

```
Frontend → Node/Express (auth, history) → Python/FastAPI (RAG) → MongoDB Atlas (vectors)
                ↓
        MongoDB Atlas (users, doc metadata, conversations)
```

Node does NOT touch embeddings or the LLM directly — it proxies to the Python
service via `src/services/ragServiceClient.js`.

## Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/documents/upload` (multipart, field name `file`) — proxies to Python `/ingest`
- `GET /api/documents`
- `DELETE /api/documents/:id`
- `POST /api/chat/query` — `{ query, conversationId? }` — proxies to Python `/query`, persists history
- `POST /api/chat/query/stream` — SSE version
- `GET /api/chat/conversations`
- `GET /api/chat/conversations/:id`
- `DELETE /api/chat/conversations/:id`

All routes except auth require `Authorization: Bearer <token>`.
