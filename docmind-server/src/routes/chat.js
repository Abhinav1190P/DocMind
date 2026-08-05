import express from "express";
import Conversation from "../models/Conversation.js";
import { authMiddleware } from "../utils/authMiddleware.js";
import { queryLimiter } from "../utils/rateLimiters.js";
import { queryRagService, queryRagServiceStream, queryAgentService } from "../services/ragServiceClient.js";

const MAX_QUERY_LENGTH = 2000;

const router = express.Router();

router.use(authMiddleware);
router.use(queryLimiter);

function validateQuery(query, res) {
  if (!query || query.trim().length === 0) {
    res.status(400).json({ error: "Query is required" });
    return false;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ error: `Query is too long (max ${MAX_QUERY_LENGTH} characters)` });
    return false;
  }
  return true;
}

router.post("/query", async (req, res) => {
  const { query, conversationId } = req.body;

  if (!validateQuery(query, res)) return;

  let conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, userId: req.userId })
    : null;

  if (!conversation) {
    conversation = await Conversation.create({
      userId: req.userId,
      title: query.slice(0, 50),
      messages: [],
    });
  }

  const history = conversation.messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let result;
  try {
    result = await queryRagService({
      query,
      userId: req.userId.toString(),
      history,
    });
  } catch (err) {
    return res.status(502).json({
      error: "RAG service failed",
      details: err.response?.data?.detail || err.message,
    });
  }

  conversation.messages.push({ role: "user", content: query });
  conversation.messages.push({
    role: "assistant",
    content: result.answer,
    sources: result.sources,
  });
  await conversation.save();

  res.json({
    conversationId: conversation._id,
    answer: result.answer,
    sources: result.sources,
  });
});

router.post("/query/stream", async (req, res) => {
  const { query, conversationId } = req.body;

  if (!validateQuery(query, res)) return;

  let conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, userId: req.userId })
    : null;

  if (!conversation) {
    conversation = await Conversation.create({
      userId: req.userId,
      title: query.slice(0, 50),
      messages: [],
    });
  }

  const history = conversation.messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(`event: conversationId\ndata: ${conversation._id}\n\n`);

  let fullAnswer = "";
  let sources = [];

  try {
    const ragResponse = await queryRagServiceStream({
      query,
      userId: req.userId.toString(),
      history,
    });

    ragResponse.data.on("data", (chunk) => {
      const text = chunk.toString();
      res.write(text);

      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("event: sources")) {
          const dataLine = lines[i + 1];
          if (dataLine?.startsWith("data: ")) {
            try {
              sources = JSON.parse(dataLine.slice(6));
            } catch {}
          }
        }
        if (lines[i].startsWith("event: token")) {
          const dataLine = lines[i + 1];
          if (dataLine?.startsWith("data: ")) {
            try {
              fullAnswer += JSON.parse(dataLine.slice(6));
            } catch {}
          }
        }
      }
    });

    ragResponse.data.on("end", async () => {
      conversation.messages.push({ role: "user", content: query });
      conversation.messages.push({ role: "assistant", content: fullAnswer, sources });
      await conversation.save();
      res.end();
    });

    ragResponse.data.on("error", (err) => {
      res.write(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`);
      res.end();
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`);
    res.end();
  }
});

router.post("/agent/query", async (req, res) => {
  const { query, conversationId } = req.body;

  if (!validateQuery(query, res)) return;

  let conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, userId: req.userId })
    : null;

  if (!conversation) {
    conversation = await Conversation.create({
      userId: req.userId,
      title: query.slice(0, 50),
      messages: [],
    });
  }

  const history = conversation.messages.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let result;
  try {
    result = await queryAgentService({
      query,
      userId: req.userId.toString(),
      history,
    });
  } catch (err) {
    return res.status(502).json({
      error: "Agent service failed",
      details: err.response?.data?.detail || err.message,
    });
  }

  conversation.messages.push({ role: "user", content: query, mode: "agent" });
  conversation.messages.push({
    role: "assistant",
    content: result.answer,
    sources: result.sources,
    trace: result.trace,
    mode: "agent",
  });
  await conversation.save();

  res.json({
    conversationId: conversation._id,
    answer: result.answer,
    sources: result.sources,
    trace: result.trace,
  });
});

router.get("/conversations", async (req, res) => {
  const conversations = await Conversation.find({ userId: req.userId })
    .select("title createdAt updatedAt")
    .sort({ updatedAt: -1 });
  res.json(conversations);
});

router.get("/conversations/:id", async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  res.json(conversation);
});

router.delete("/conversations/:id", async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  await conversation.deleteOne();
  res.status(204).send();
});

export default router;
