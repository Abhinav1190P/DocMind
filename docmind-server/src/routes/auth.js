import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authLimiter } from "../utils/rateLimiters.js";

const router = express.Router();

router.use(authLimiter);

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const user = await User.create({ email, password, name });
  const token = generateToken(user._id);

  res.status(201).json({
    token,
    user: { id: user._id, email: user.email, name: user.name },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken(user._id);

  res.json({
    token,
    user: { id: user._id, email: user.email, name: user.name },
  });
});

export default router;
