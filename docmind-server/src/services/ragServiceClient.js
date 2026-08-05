import axios from "axios";
import FormData from "form-data";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";

export async function ingestDocumentViaRagService({ userId, fileBuffer, fileName, mimeType }) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("file", fileBuffer, { filename: fileName, contentType: mimeType });

  const response = await axios.post(`${RAG_SERVICE_URL}/ingest`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return response.data;
}

export async function queryRagService({ query, userId, history }) {
  const response = await axios.post(`${RAG_SERVICE_URL}/query`, {
    query,
    userId,
    history,
  });

  return response.data;
}

export function queryRagServiceStream({ query, userId, history }) {
  return axios.post(
    `${RAG_SERVICE_URL}/query/stream`,
    { query, userId, history },
    { responseType: "stream" }
  );
}

export async function queryAgentService({ query, userId, history }) {
  const response = await axios.post(`${RAG_SERVICE_URL}/agent/query`, {
    query,
    userId,
    history,
  });

  return response.data;
}
