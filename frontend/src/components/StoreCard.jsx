import { getUiText } from "../i18n";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function buildRegionLabel(store) {
  return [store.location, store.city, store.state].filter(Boolean).join(", ");
}

function getLocale(language) {
  if (language === "te") {
    return "te-IN";
  }

  if (language === "hi") {
    return "hi-IN";
  }

  return "en-IN";
}

function StoreCard({
  store,
  compact = false,
  recommended = false,
  language = "en",
  onSelect,
  onRequest,
  requestStatus = null,
  requestLoading = false,
  onNotify,
  notifyLoading = false,
  notifyStatus = null,
  highlighted = false,
  storeRef = null
}) {
  const text = getUiText(language);
  const stockLabel = typeof store.stockCount === "number"
    ? `${store.stockCount} ${text.cylinders}`
    : store.availability
      ? text.inStock
      : text.unavailable;
  const showBookingButton = store.availability && typeof onRequest === "function";
  const showNotifyButton = !store.availability && typeof onNotify === "function";
  const showMapButton = Number.isFinite(Number(store.latitude)) && Number.isFinite(Number(store.longitude));
  const hasExistingBookingRequest = Boolean(requestStatus);
  const hasExistingNotifyRequest = Boolean(notifyStatus);
  const isInteractive = typeof onSelect === "function";
  const notifyLabel = hasExistingNotifyRequest ? text.alreadyRequested : text.notifyWhenAvailable;
  const bookingLabel = hasExistingBookingRequest ? (text.requestSentButton || "Request sent") : text.requestButton;
  const shouldRenderFooter = showBookingButton || showNotifyButton || showMapButton;

  function handleCardClick() {
    if (isInteractive) {
      onSelect(store);
    }
  }

  function handleCardKeyDown(event) {
    if (!isInteractive) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(store);
    }
  }

  function handleOpenMap(event) {
    const mapUrl = `https://www.google.com/maps?q=${store.latitude},${store.longitude}`;
    event.stopPropagation();
    window.open(mapUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <article
      ref={storeRef}
      className={`store-card ${compact ? "store-card--compact" : ""} ${
        store.availability ? "store-card--available" : "store-card--out"
      } ${recommended ? "store-card--recommended" : ""} ${isInteractive ? "store-card--interactive" : ""} ${highlighted ? "store-card--highlighted" : ""}`}
      onClick={isInteractive ? handleCardClick : undefined}
      onKeyDown={isInteractive ? handleCardKeyDown : undefined}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? text.openTrackedStore(store.name) : undefined}
    >
      <div className="store-card__header">
        <div>
          <p className="store-card__eyebrow">{store.branchCode || text.lpgStore}</p>
          <h3>{store.name}</h3>
          <p className="store-card__region">{buildRegionLabel(store)}</p>
        </div>
        <div className="store-card__badges">
          {recommended && <span className="recommendation-badge">{text.recommended}</span>}
          <span className={`status-pill ${store.availability ? "status-pill--available" : "status-pill--out"}`}>
            <span className="status-pill__dot" aria-hidden="true" />
            {store.availability ? text.available : text.outOfStock}
          </span>
        </div>
      </div>

      <div className="store-card__metrics">
        <div>
          <span>{text.cityState}</span>
          <strong>{[store.city, store.state].filter(Boolean).join(", ") || store.location}</strong>
        </div>
        <div>
          <span>{text.distance}</span>
          <strong>{store.distance} km</strong>
        </div>
        <div>
          <span>{text.price}</span>
          <strong>{currencyFormatter.format(store.price)}</strong>
        </div>
        <div>
          <span>{text.stock}</span>
          <strong>{stockLabel}</strong>
        </div>
      </div>

      <p className="store-card__updated">
        {text.updated} {new Date(store.lastUpdated).toLocaleString(getLocale(language))}
      </p>
      {store.prediction && <p className="store-card__prediction">{store.prediction}</p>}

      {shouldRenderFooter && (
        <div className="store-card__footer">
          {showBookingButton && (
            <button
              type="button"
              className={`store-card__action ${hasExistingBookingRequest ? "store-card__action--muted" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onRequest(store);
              }}
              disabled={requestLoading || hasExistingBookingRequest}
            >
              {requestLoading ? text.sending : bookingLabel}
            </button>
          )}

          {showNotifyButton && (
            <button
              type="button"
              className={`store-card__action store-card__action--notify ${hasExistingNotifyRequest ? "store-card__action--muted" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onNotify(store);
              }}
              disabled={notifyLoading || hasExistingNotifyRequest}
            >
              {notifyLoading ? text.saving : notifyLabel}
            </button>
          )}

          {showMapButton && (
            <button
              type="button"
              className="store-card__action store-card__action--map"
              onClick={handleOpenMap}
              aria-label={text.mapLocationLabel ? text.mapLocationLabel(store.name) : `Open ${store.name} in Google Maps`}
            >
              <span aria-hidden="true">📍</span>
              <span>{text.viewOnMap || "View on Map"}</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default StoreCard;
