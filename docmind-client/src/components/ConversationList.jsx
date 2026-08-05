import { MessageSquarePlus, Trash2 } from "lucide-react";

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}) {
  return (
    <div className="convo-list">
      <button className="convo-new" onClick={onNew}>
        <MessageSquarePlus size={15} />
        New conversation
      </button>

      <div className="convo-items">
        {conversations.map((c) => (
          <div
            key={c._id}
            className={`convo-item ${activeId === c._id ? "convo-item-active" : ""}`}
            onClick={() => onSelect(c._id)}
          >
            <span className="convo-item-title">{c.title}</span>
            <button
              className="convo-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c._id);
              }}
              aria-label="Delete conversation"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
