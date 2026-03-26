import ChatMessage from "./ChatMessage";
import QuickActions from "./QuickActions";

function ChatWorkspace({
  uiText,
  language = "en",
  messages = [],
  chatLoading = false,
  chatWindowRef,
  isAuthenticated = false,
  draft = "",
  onDraftChange,
  onSubmit,
  onSelectQuickAction,
  onVoiceInput,
  voiceSupported = false,
  listening = false,
  onOpenSection,
  onOpenStore,
  onRequestStore,
  bookingStatusByStoreId = {},
  bookingPendingStoreId = null,
  onNotifyStore,
  notifyPendingStoreId = null,
  requestStatusByStoreId = {},
  compact = false,
  onExpand,
  onClose
}) {
  return (
    <section className={compact ? "chat-panel chat-panel--floating" : "chat-panel"}>
      <div className="chat-panel__header">
        <div>
          <p className="chat-panel__eyebrow">{compact ? (uiText.aiAssistant || "Assistant") : "Assistant"}</p>
          <h2>{uiText.assistantTitle}</h2>
        </div>

        <div className="chat-panel__header-actions">
          {!compact && <QuickActions onSelect={onSelectQuickAction} actions={uiText.quickActions} />}

          {compact && (
            <>
              <button type="button" className="chat-panel__utility" onClick={onExpand}>
                {uiText.expandChat || "Expand"}
              </button>
              <button
                type="button"
                className="chat-panel__utility chat-panel__utility--close"
                onClick={onClose}
                aria-label={uiText.closeChat || "Close chat"}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {compact && (
        <div className="chat-panel__quick-actions">
          <QuickActions onSelect={onSelectQuickAction} actions={uiText.quickActions} />
        </div>
      )}

      <div ref={chatWindowRef} className={compact ? "chat-window chat-window--floating" : "chat-window"}>
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            language={language}
            onOpenSection={onOpenSection}
            onOpenStore={onOpenStore}
            onRequestStore={onRequestStore}
            bookingStatusByStoreId={bookingStatusByStoreId}
            requestPendingId={bookingPendingStoreId}
            onNotifyStore={onNotifyStore}
            notifyPendingId={notifyPendingStoreId}
            requestStatusByStoreId={requestStatusByStoreId}
          />
        ))}

        {chatLoading && (
          <div className="chat-message chat-message--bot">
            <div className="chat-message__bubble chat-message__bubble--typing">
              <p className="chat-message__meta">{uiText.aiAssistant}</p>
              <div className="typing-indicator" aria-live="polite">
                <span className="typing-indicator__label">{uiText.typing}</span>
                <span className="typing-indicator__dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <button
          type="button"
          className={`chat-composer__voice ${listening ? "chat-composer__voice--active" : ""}`}
          onClick={onVoiceInput}
          aria-label={listening ? uiText.stopListening : uiText.listen}
          disabled={!isAuthenticated}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 4a3 3 0 0 1 3 3v5a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Zm-6 8a1 1 0 1 1 2 0 4 4 0 1 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.91V21h2a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2h2v-2.09A6 6 0 0 1 6 12Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <input
          type="text"
          placeholder={uiText.typePlaceholder}
          value={draft}
          onChange={(event) => onDraftChange?.(event.target.value)}
          disabled={!isAuthenticated}
        />

        <button
          type="submit"
          className="chat-composer__send"
          disabled={chatLoading || !isAuthenticated}
          aria-label={uiText.sendMessage}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 12h11M12 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      </form>

      {voiceSupported && listening && (
        <p className="chat-panel__listening">{uiText.listening}</p>
      )}

      {!isAuthenticated && (
        <p className="chat-panel__listening">{uiText.loginRequiredPrompt}</p>
      )}
    </section>
  );
}

export default ChatWorkspace;
