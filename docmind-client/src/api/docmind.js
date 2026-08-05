import { api, API_URL } from "./client.js";

export async function signup({ email, password, name }) {
  const res = await api.post("/auth/signup", { email, password, name });
  return res.data;
}

export async function login({ email, password }) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function listDocuments() {
  const res = await api.get("/documents");
  return res.data;
}

export async function deleteDocument(id) {
  await api.delete(`/documents/${id}`);
}

export async function listConversations() {
  const res = await api.get("/chat/conversations");
  return res.data;
}

export async function getConversation(id) {
  const res = await api.get(`/chat/conversations/${id}`);
  return res.data;
}

export async function deleteConversation(id) {
  await api.delete(`/chat/conversations/${id}`);
}

export async function agentQuery({ query, conversationId }) {
  const res = await api.post("/chat/agent/query", { query, conversationId });
  return res.data;
}

export function streamQuery({ query, conversationId, onSources, onToken, onDone, onError }) {
  const token = localStorage.getItem("docmind_token");

  fetch(`${API_URL}/chat/query/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, conversationId }),
  })
    .then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const evt of events) {
          const lines = evt.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const eventType = eventLine.slice(7).trim();
          const data = dataLine.slice(6);

          if (eventType === "conversationId") {
            onSources?.({ conversationId: data });
          } else if (eventType === "sources") {
            try {
              onSources?.({ sources: JSON.parse(data) });
            } catch {}
          } else if (eventType === "token") {
            try {
              onToken?.(JSON.parse(data));
            } catch {}
          } else if (eventType === "done") {
            onDone?.();
          } else if (eventType === "error") {
            onError?.(data);
          }
        }
      }
    })
    .catch((err) => onError?.(err.message));
}