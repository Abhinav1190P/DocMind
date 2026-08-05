import rateLimit from "express-rate-limit";

// General API rate limit - protects against basic abuse
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Auth routes - stricter, since these are unauthenticated and a common abuse target
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login/signup attempts. Please try again in 15 minutes." },
});

// Query routes - these cost real money/quota (Groq, Tavily, embeddings), so keep tight
export const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip, // per-user once authenticated
  message: { error: "You're sending questions too quickly. Please wait a moment and try again." },
});

// Upload route - ingestion is the most expensive operation (embeddings for every chunk)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: "Upload limit reached. Please try again later." },
});
