import { getUiText } from "../i18n";

function buildSummaryItems(settings, text) {
  const items = [];

  if (settings.notificationsEnabled === false) {
    items.push(text.notification.notificationsPaused);
    return items;
  }

  if (settings.maxPrice !== "" && settings.maxPrice !== null && settings.maxPrice !== undefined) {
    items.push(text.notification.priceUpTo(settings.maxPrice));
  }

  if (settings.maxDistance !== "" && settings.maxDistance !== null && settings.maxDistance !== undefined) {
    items.push(text.notification.distanceWithin(settings.maxDistance));
  }

  if (!items.length) {
    items.push(text.notification.allAlertsEnabled);
  }

  return items;
}

function NotificationSettingsPanel({
  user,
  settings,
  saving = false,
  feedback = null,
  onChange,
  onSubmit,
  language = "en"
}) {
  const text = getUiText(language);
  const summaryItems = buildSummaryItems(settings, text);

  return (
    <section className="notification-panel">
      <div className="notification-panel__header">
        <div>
          <p className="profile-panel__eyebrow">{text.notification.eyebrow}</p>
          <h2>{text.notification.title}</h2>
          <p className="notification-panel__copy">{text.notification.copy}</p>
        </div>
      </div>

      {!user ? (
        <div className="notification-panel__empty">
          <strong>{text.notification.loginTitle}</strong>
          <p>{text.notification.loginCopy}</p>
        </div>
      ) : (
        <div className="notification-panel__body">
          <form className="notification-panel__card" onSubmit={onSubmit}>
            {feedback?.message && (
              <div
                className={`notification-panel__toast notification-panel__toast--${feedback.type || "success"}`}
                aria-live="polite"
              >
                {feedback.message}
              </div>
            )}

            <div className="notification-panel__grid">
              <label>
                <span>{text.notification.maxPrice}</span>
                <input
                  name="maxPrice"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={text.notification.maxPricePlaceholder}
                  value={settings.maxPrice}
                  onChange={onChange}
                />
              </label>

              <label>
                <span>{text.notification.maxDistance}</span>
                <input
                  name="maxDistance"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder={text.notification.maxDistancePlaceholder}
                  value={settings.maxDistance}
                  onChange={onChange}
                />
              </label>
            </div>

            <label className="notification-panel__toggle">
              <input
                name="notificationsEnabled"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={onChange}
              />
              <span>{text.notification.sendTargetedAlerts}</span>
            </label>

            <button type="submit" className="notification-panel__submit" disabled={saving}>
              {saving ? text.saving : text.notification.submit}
            </button>
          </form>

          <aside className="notification-panel__summary">
            <p className="notification-panel__summary-label">{text.notification.activeFilters}</p>
            <div className="notification-panel__summary-items">
              {summaryItems.map((item) => (
                <span key={item} className="notification-panel__summary-pill">
                  {item}
                </span>
              ))}
            </div>
            <p className="notification-panel__summary-copy">{text.notification.summaryCopy}</p>
          </aside>
        </div>
      )}
    </section>
  );
}

export default NotificationSettingsPanel;
