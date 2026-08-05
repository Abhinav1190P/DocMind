import { useState } from "react";
import { User, Brain } from "lucide-react";
import { CitationChip, SourcesPanel } from "./Sources.jsx";
import AgentTrace from "./AgentTrace.jsx";

function renderWithCitations(text, onHover, activeIndex) {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);

  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
    if (!match) return <span key={i}>{part}</span>;

    const nums = match[1].split(",").map((n) => n.trim());
    return (
      <span key={i}>
        {nums.map((n, j) => (
          <CitationChip key={j} index={n} onHover={onHover} active={activeIndex === n} />
        ))}
      </span>
    );
  });
}

export default function ChatMessage({ message }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const isUser = message.role === "user";

  return (
    <div className={`chat-message ${isUser ? "chat-message-user" : "chat-message-assistant"}`}>
      <div className="chat-message-avatar">
        {isUser ? <User size={15} /> : <Brain size={15} />}
      </div>
      <div className="chat-message-body">
        <div className="chat-message-text">
          {isUser
            ? message.content
            : renderWithCitations(message.content, setActiveIndex, activeIndex)}
          {message.streaming && <span className="cursor-blink" />}
        </div>
        {!isUser && message.trace && <AgentTrace trace={message.trace} />}
        {!isUser && <SourcesPanel sources={message.sources} activeIndex={activeIndex} />}
      </div>
    </div>
  );
}
