import { useRef, useState } from "react";
import { FileText, Upload, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function DocumentSidebar({ documents, onUpload, onDelete, uploading }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  return (
    <aside className="doc-sidebar">
      <div className="doc-sidebar-header">
        <span className="doc-sidebar-title">Sources</span>
        <span className="doc-sidebar-count">{documents.length}</span>
      </div>

      <div
        className={`doc-dropzone ${dragOver ? "doc-dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 size={18} className="spin" />
        ) : (
          <Upload size={18} strokeWidth={1.75} />
        )}
        <span>{uploading ? "Processing…" : "Drop a file or click to upload"}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          hidden
          onChange={handleFileSelect}
        />
      </div>

      <div className="doc-list">
        {documents.length === 0 && (
          <p className="doc-empty">No sources yet. Upload a PDF to start asking questions.</p>
        )}
        {documents.map((doc) => (
          <div className="doc-item" key={doc._id}>
            <FileText size={16} strokeWidth={1.75} className="doc-item-icon" />
            <div className="doc-item-meta">
              <span className="doc-item-name" title={doc.fileName}>
                {doc.fileName}
              </span>
              <span className="doc-item-sub">
                {doc.status === "ready" && (
                  <>
                    <CheckCircle2 size={11} /> {doc.chunkCount} chunks
                  </>
                )}
                {doc.status === "processing" && (
                  <>
                    <Loader2 size={11} className="spin" /> Processing
                  </>
                )}
                {doc.status === "failed" && (
                  <>
                    <XCircle size={11} /> Failed
                  </>
                )}
              </span>
            </div>
            <button
              className="doc-item-delete"
              onClick={() => onDelete(doc._id)}
              aria-label={`Remove ${doc.fileName}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
