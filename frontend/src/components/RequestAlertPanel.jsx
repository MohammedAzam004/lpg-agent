function RequestAlertPanel({
  user,
  value,
  saving = false,
  feedback = null,
  onChange,
  onSubmit
}) {
  return (
    <section className="request-alert-panel">
      <div className="request-alert-panel__header">
        <div>
          <p className="chat-panel__eyebrow">Smart Request</p>
          <h3>Watch for LPG that matches your need</h3>
        </div>
        <p className="request-alert-panel__summary">
          {user ? "Saved requests appear below the admin panel." : "Log in to start tracking LPG requests."}
        </p>
      </div>

      <form className="request-alert-panel__form" onSubmit={onSubmit}>
        <div className="request-alert-panel__controls">
          <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder="Request LPG (e.g. gas under 900 within 3 km)"
            disabled={!user || saving}
          />
          <button type="submit" disabled={!user || saving}>
            {saving ? "Saving..." : "Request"}
          </button>
        </div>

        {!user && (
          <p className="request-alert-panel__hint">Log in to save smart LPG alerts.</p>
        )}

        {feedback?.message && (
          <div className={`request-alert-panel__feedback request-alert-panel__feedback--${feedback.type || "success"}`}>
            {feedback.message}
          </div>
        )}
      </form>
    </section>
  );
}

export default RequestAlertPanel;
