import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing",
    },
    chunkCount: { type: Number, default: 0 },
    errorMessage: { type: String },
    ragDocumentId: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
