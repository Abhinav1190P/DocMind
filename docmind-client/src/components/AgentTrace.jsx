import { useState } from "react";
import { ChevronDown, Search, Globe, Calculator, CheckCircle2, XCircle } from "lucide-react";

const TOOL_ICON = {
  retrieve_docs: Search,
  web_search: Globe,
  calculator: Calculator,
};

const TOOL_LABEL = {
  retrieve_docs: "Searched your documents",
  web_search: "Searched the web",
  calculator: "Calculated",
};

function TraceStep({ step }) {
  if (step.action === "answer") {
    return (
      <div className="trace-step trace-step-final">
        <CheckCircle2 size={13} />
        <span>Ready to answer</span>
      </div>
    );
  }

  if (step.action !== "call_tool") return null;

  const Icon = TOOL_ICON[step.tool] || Search;
  const label = TOOL_LABEL[step.tool] || step.tool;
  const found = step.result_found;

  return (
    <div className="trace-step">
      <Icon size={13} />
      <span className="trace-step-label">{label}</span>
      {step.input?.query && <span className="trace-step-detail">"{step.input.query}"</span>}
      {step.input?.expression && <span className="trace-step-detail">{step.input.expression}</span>}
      {found === false && (
        <span className="trace-step-empty">
          <XCircle size={11} /> nothing found
        </span>
      )}
    </div>
  );
}

export default function AgentTrace({ trace }) {
  const [expanded, setExpanded] = useState(false);

  if (!trace || trace.length === 0) return null;

  const toolCalls = trace.filter((s) => s.action === "call_tool");

  return (
    <div className="agent-trace">
      <button className="trace-toggle" onClick={() => setExpanded((v) => !v)}>
        <ChevronDown size={13} className={expanded ? "chevron-open" : ""} />
        {toolCalls.length} step{toolCalls.length !== 1 ? "s" : ""} taken
      </button>

      {expanded && (
        <div className="trace-steps">
          {trace.map((step, i) => (
            <TraceStep key={i} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
