export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File is too large. Maximum size is 20MB." });
  }

  if (err.response?.status === 429 || err.response?.data?.detail?.includes("rate_limit")) {
    return res.status(503).json({
      error: "The AI service is temporarily at capacity. Please try again in a minute.",
    });
  }

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({ error: message });
}
