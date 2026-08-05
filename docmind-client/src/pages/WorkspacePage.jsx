import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Brain, LogOut, PanelLeftClose, PanelLeft, Sparkles, MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import * as api from "../api/docmind.js";
import DocumentSidebar from "../components/DocumentSidebar.jsx";
import ConversationList from "../components/ConversationList.jsx";
import ChatMessage from "../components/ChatMessage.jsx";
import "./Workspace.css";

export default function WorkspacePage() {
  const { user, logout } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [agentMode, setAgentMode] = useState(false);

  const scrollRef = useRef(null);

  const refreshDocuments = useCallback(async () => {
    const docs = await api.listDocuments();
    setDocuments(docs);
  }, []);

  const refreshConversations = useCallback(async () => {
    const convos = await api.listConversations();
    setConversations(convos);
  }, []);

  useEffect(() => {
    refreshDocuments();
    refreshConversations();
  }, [refreshDocuments, refreshConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleUpload(file) {
    setUploading(true);
    try {
      await api.uploadDocument(file);
      await refreshDocuments();
    } catch (err) {
      alert(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(id) {
    await api.deleteDocument(id);
    await refreshDocuments();
  }

  async function handleSelectConversation(id) {
    setActiveConversationId(id);
    const convo = await api.getConversation(id);
    setMessages(convo.messages);
  }

  function handleNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
  }

  async function handleDeleteConversation(id) {
    await api.deleteConversation(id);
    if (activeConversationId === id) handleNewConversation();
    await refreshConversations();
  }

  async function handleSend(e) {
    e.preventDefault();
    const query = input.trim();
    if (!query || sending) return;

    setInput("");
    setSending(true);

    const userMessage = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);

    if (agentMode) {
      const assistantMessage = { role: "assistant", content: "Thinking…", sources: [], streaming: true };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const result = await api.agentQuery({ query, conversationId: activeConversationId });
        if (!activeConversationId) setActiveConversationId(result.conversationId);

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: result.answer,
            sources: result.sources,
            trace: result.trace,
            streaming: false,
          };
          return next;
        });
        refreshConversations();
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "Something went wrong answering that. Try again.",
            streaming: false,
          };
          return next;
        });
        console.error(err);
      } finally {
        setSending(false);
      }
      return;
    }

    const assistantMessage = { role: "assistant", content: "", sources: [], streaming: true };
    setMessages((prev) => [...prev, assistantMessage]);

    let convoId = activeConversationId;

    api.streamQuery({
      query,
      conversationId: convoId,
      onSources: ({ conversationId, sources }) => {
        if (conversationId && !convoId) {
          convoId = conversationId;
          setActiveConversationId(conversationId);
        }
        if (sources) {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], sources };
            return next;
          });
        }
      },
      onToken: (token) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + token };
          return next;
        });
      },
      onDone: () => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], streaming: false };
          return next;
        });
        setSending(false);
        refreshConversations();
      },
      onError: (err) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: "Something went wrong answering that. Try again.",
            streaming: false,
          };
          return next;
        });
        setSending(false);
        console.error(err);
      },
    });
  }

  return (
    <div className="workspace">
      <header className="workspace-header">
        <div className="workspace-brand">
          <button
            className="icon-btn"
            onClick={() => setShowSidebar((v) => !v)}
            aria-label="Toggle sidebar"
          >
            {showSidebar ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
          </button>
          <div className="workspace-brand-mark">
            <Brain size={16} />
          </div>
          <span className="workspace-brand-name">DocMind</span>
        </div>
        <div className="workspace-user">
          <span className="workspace-user-name">{user?.name}</span>
          <button className="icon-btn" onClick={logout} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="workspace-body">
        {showSidebar && (
          <div className="workspace-left">
            <DocumentSidebar
              documents={documents}
              onUpload={handleUpload}
              onDelete={handleDeleteDocument}
              uploading={uploading}
            />
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onDelete={handleDeleteConversation}
            />
          </div>
        )}

        <main className="workspace-chat">
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon">
                  <Brain size={28} strokeWidth={1.5} />
                </div>
                <h2>Ask anything about your documents</h2>
                <p>
                  {documents.length === 0
                    ? "Upload a source on the left to get started."
                    : "Answers are grounded in your uploaded sources, with citations."}
                </p>
              </div>
            ) : (
              messages.map((m, i) => <ChatMessage key={i} message={m} />)
            )}
          </div>

          <form className="chat-input-bar" onSubmit={handleSend}>
            <button
              type="button"
              className={`mode-toggle ${agentMode ? "mode-toggle-active" : ""}`}
              onClick={() => setAgentMode((v) => !v)}
              title={agentMode ? "Agent mode: can use web search & calculator" : "Standard mode: documents only"}
            >
              {agentMode ? <Sparkles size={14} /> : <MessageCircle size={14} />}
              {agentMode ? "Agent" : "Standard"}
            </button>
            <input
              className="chat-input"
              placeholder={
                documents.length === 0
                  ? "Upload a document first…"
                  : agentMode
                  ? "Ask anything — agent can search the web and do math…"
                  : "Ask a question about your documents…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
