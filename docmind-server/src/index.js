import dotenv from "dotenv";
dotenv.config();

import "express-async-errors";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { errorHandler } from "./utils/errorHandler.js";
import { generalLimiter } from "./utils/rateLimiters.js";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import chatRoutes from "./routes/chat.js";

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : "*";

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(generalLimiter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`DocMind server running on port ${PORT}`);
  });
});
