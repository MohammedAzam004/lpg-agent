import { getUiText } from "../i18n";

function BookingPanel({ language = "en", bookings = [], loading = false, user = null }) {
  const text = getUiText(language);

  return (
    <section className="booking-panel">
      <div className="booking-panel__header">
        <div>
          <p className="analytics-panel__eyebrow">Bookings</p>
          <h2>{text.requestHistoryTitle}</h2>
          <p className="booking-panel__copy">{text.requestHistoryCopy}</p>
        </div>
      </div>

      {!user ? (
        <p className="store-panel__empty">{text.loginToRequest}</p>
      ) : loading ? (
        <div className="booking-panel__list">
          {Array.from({ length: 2 }).map((_, index) => (
            <article key={`booking-skeleton-${index}`} className="booking-card">
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--text" />
            </article>
          ))}
        </div>
      ) : bookings.length ? (
        <div className="booking-panel__list">
          {bookings.map((booking) => (
            <article key={booking.id} className="booking-card">
              <div className="booking-card__header">
                <div>
                  <p className="store-card__eyebrow">{booking.storeId}</p>
                  <h3>{booking.storeName}</h3>
                  <p className="store-card__region">{[booking.location, booking.city, booking.state].filter(Boolean).join(", ")}</p>
                </div>
                <span className={`booking-card__status booking-card__status--${booking.status}`}>
                  {text.requestStatus[booking.status] || booking.status}
                </span>
              </div>

              <div className="booking-card__meta">
                <span>Rs. {booking.price}</span>
                <span>{booking.quantity} {language === "hi" ? "सिलेंडर" : "cylinder(s)"}</span>
                <span>{new Date(booking.requestedAt).toLocaleString("en-IN")}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="store-panel__empty">{text.noRequests}</p>
      )}
    </section>
  );
}

export default BookingPanel;
