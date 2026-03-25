import { getUiText } from "../i18n";

function formatRequestLocation(request) {
  return [request.storeCity, request.storeState].filter(Boolean).join(", ") || request.storeLocation || null;
}

function formatRequestTime(request, language, text) {
  const resolvedDate = request.matchedAt || request.createdAt;

  if (!resolvedDate) {
    return text.justNow;
  }

  return new Date(resolvedDate).toLocaleString(language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN");
}

function formatStatusCopy(status, text) {
  return status === "matched"
    ? `🟢 ${text.requestStatus.matched}`
    : `🟡 ${text.requestStatus.requested}`;
}

function RequestHistoryPanel({
  user,
  loading = false,
  deletingId = null,
  requests = [],
  feedback = null,
  onRemove,
  language = "en"
}) {
  const text = getUiText(language);

  return (
    <section className="request-history-panel">
      <div className="request-history-panel__header">
        <div>
          <p className="profile-panel__eyebrow">{text.requestHistoryTitle}</p>
          <h2>{text.requestHistoryTitle}</h2>
          <p className="request-history-panel__copy">{text.requestHistoryCopy}</p>
        </div>
      </div>

      {feedback?.message && (
        <div className={`request-history-panel__feedback request-history-panel__feedback--${feedback.type || "success"}`}>
          {feedback.message}
        </div>
      )}

      {!user ? (
        <p className="request-history-panel__empty">{text.myRequestsLoginHint}</p>
      ) : loading ? (
        <div className="request-history-panel__list">
          {Array.from({ length: 3 }).map((_, index) => (
            <article key={`request-history-skeleton-${index}`} className="request-history-card request-history-card--skeleton">
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--grid" />
            </article>
          ))}
        </div>
      ) : requests.length ? (
        <div className="request-history-panel__list">
          {requests.map((request) => (
            <article key={request.id} className="request-history-card">
              <div className="request-history-card__header">
                <div>
                  <h3>{request.storeName || text.requestFallbackTitle}</h3>
                  <p className="request-history-card__location">{formatRequestLocation(request) || text.filterTip}</p>
                </div>
                <div className="request-history-card__actions">
                  <span
                    className={`request-history-card__status request-history-card__status--${request.status === "matched" ? "matched" : "requested"}`}
                  >
                    {formatStatusCopy(request.status, text)}
                  </span>
                  <button
                    type="button"
                    className="request-history-card__remove"
                    onClick={() => onRemove?.(request.id)}
                    disabled={deletingId === request.id}
                    aria-label={text.removeRequestLabel(request.storeName)}
                  >
                    {deletingId === request.id ? "..." : "✕"}
                  </button>
                </div>
              </div>

              <div className="request-history-card__meta">
                <div>
                  <span>{text.timeLabel}</span>
                  <strong>{formatRequestTime(request, language, text)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="request-history-panel__empty">{text.noRequests}</p>
      )}
    </section>
  );
}

export default RequestHistoryPanel;
