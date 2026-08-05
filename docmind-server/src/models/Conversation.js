import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: [
      {
        chunkId: { type: String },
        fileName: String,
        text: String,
        score: Number,
        sourceType: String,
      },
    ],
    trace: [{ type: mongoose.Schema.Types.Mixed }],
    mode: { type: String, enum: ["rag", "agent"], default: "rag" },
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "New Conversation" },
    messages: [messageSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
