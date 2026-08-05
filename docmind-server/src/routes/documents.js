import express from "express";
import multer from "multer";
import Document from "../models/Document.js";
import { authMiddleware } from "../utils/authMiddleware.js";
import { uploadLimiter } from "../utils/rateLimiters.js";
import { ingestDocumentViaRagService } from "../services/ragServiceClient.js";

const MAX_DOCUMENTS_PER_USER = 20;

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

router.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const existingCount = await Document.countDocuments({ userId: req.userId });
  if (existingCount >= MAX_DOCUMENTS_PER_USER) {
    return res.status(403).json({
      error: `You've reached the limit of ${MAX_DOCUMENTS_PER_USER} documents. Delete one before uploading another.`,
    });
  }

  const document = await Document.create({
    userId: req.userId,
    fileName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    status: "processing",
  });

  try {
    const result = await ingestDocumentViaRagService({
      userId: req.userId.toString(),
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    document.status = result.status;
    document.chunkCount = result.chunkCount;
    document.ragDocumentId = result.documentId;
    await document.save();

    res.status(201).json(document);
  } catch (err) {
    document.status = "failed";
    document.errorMessage = err.response?.data?.detail || err.message;
    await document.save();

    res.status(502).json({ error: "Ingestion failed", details: document.errorMessage });
  }
});

router.get("/", async (req, res) => {
  const documents = await Document.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(documents);
});

router.get("/:id", async (req, res) => {
  const document = await Document.findOne({ _id: req.params.id, userId: req.userId });
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json(document);
});

router.delete("/:id", async (req, res) => {
  const document = await Document.findOne({ _id: req.params.id, userId: req.userId });
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }

  await document.deleteOne();
  res.status(204).send();
});

export default router;
