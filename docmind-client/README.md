# DocMind Client (React + Vite)

## Setup

```
npm install
cp .env.example .env
```

`.env` should point at your running Node server (default `http://localhost:5000/api`).

## Run

Make sure both backend services are running first:
1. `docmind-rag-service` (Python, port 8000)
2. `docmind-server` (Node, port 5000)

Then:
```
npm run dev
```

Opens at `http://localhost:5173`.

## What's here

- Auth (signup/login) — JWT stored in localStorage
- Document sidebar — drag-and-drop upload, status (processing/ready/failed), delete
- Conversation list — multiple chats, persisted via the Node backend
- Chat — streams tokens live via SSE, renders `[1]` `[2]` citations as interactive
  chips that highlight the matching source card on hover
- Sources panel — collapsible per-answer, shows the retrieved chunk text and
  similarity score for each citation

## Structure

```
src/
  api/            axios client + endpoint functions + SSE stream handler
  context/        AuthContext (login/signup/logout, token persistence)
  components/     DocumentSidebar, ConversationList, ChatMessage, Sources
  pages/          LoginPage, SignupPage, WorkspacePage (+ their CSS)
```
