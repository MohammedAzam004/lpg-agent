function FloatingChatbot({
  uiText,
  isOpen = false,
  onToggle,
  onClose,
  children
}) {
  return (
    <>
      <button
        type="button"
        className={`floating-chat__trigger ${isOpen ? "floating-chat__trigger--active" : ""}`}
        onClick={onToggle}
        aria-label={isOpen ? (uiText.closeChat || "Close chat") : (uiText.openChat || "Open chat")}
      >
        <span aria-hidden="true">💬</span>
      </button>

      <div
        className={isOpen ? "floating-chat__backdrop floating-chat__backdrop--visible" : "floating-chat__backdrop"}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <div
        className={isOpen ? "floating-chat__panel floating-chat__panel--open" : "floating-chat__panel"}
        aria-hidden={!isOpen}
      >
        {children}
      </div>
    </>
  );
}

export default FloatingChatbot;
