import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";

export function CitationChip({ index, onHover, active }) {
  return (
    <sup
      className={`citation-chip ${active ? "citation-chip-active" : ""}`}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
    >
      {index}
    </sup>
  );
}

export function SourcesPanel({ sources, activeIndex }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="sources-panel">
      <button className="sources-toggle" onClick={() => setExpanded((v) => !v)}>
        <ChevronDown size={14} className={expanded ? "chevron-open" : ""} />
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>

      {expanded && (
        <div className="sources-grid">
          {sources.map((src, i) => (
            <div
              key={src.chunkId || i}
              className={`source-card ${activeIndex === i + 1 ? "source-card-active" : ""}`}
            >
              <div className="source-card-header">
                <FileText size={12} />
                <span className="source-card-name">{src.fileName}</span>
                {typeof src.score === "number" && (
                  <span className="source-card-score">{src.score.toFixed(2)}</span>
                )}
              </div>
              <p className="source-card-text">{src.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
