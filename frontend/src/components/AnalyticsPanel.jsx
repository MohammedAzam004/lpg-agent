import { getUiText } from "../i18n";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function calculateAveragePrice(stores) {
  if (!stores.length) {
    return null;
  }

  const totalPrice = stores.reduce((sum, store) => sum + Number(store.price || 0), 0);
  return totalPrice / stores.length;
}

function AnalyticsPanel({ stores, loading = false, language = "en" }) {
  const text = getUiText(language);
  const availableStores = stores.filter((store) => store.availability);
  const cheapestStore = stores.length
    ? [...stores].sort((leftStore, rightStore) => leftStore.price - rightStore.price)[0]
    : null;
  const averagePrice = calculateAveragePrice(stores);

  const items = [
    {
      label: text.analyticsItems.totalStores.label,
      value: stores.length,
      detail: text.analyticsItems.totalStores.detail
    },
    {
      label: text.analyticsItems.availableStores.label,
      value: availableStores.length,
      detail: text.analyticsItems.availableStores.detail
    },
    {
      label: text.analyticsItems.cheapestLpg.label,
      value: cheapestStore ? currencyFormatter.format(cheapestStore.price) : "--",
      detail: cheapestStore ? cheapestStore.name : text.analyticsItems.cheapestLpg.empty
    },
    {
      label: text.analyticsItems.averagePrice.label,
      value: averagePrice != null ? currencyFormatter.format(averagePrice) : "--",
      detail: text.analyticsItems.averagePrice.detail
    }
  ];

  return (
    <section className="analytics-panel">
      <div className="analytics-panel__header">
        <div>
          <p className="analytics-panel__eyebrow">{text.analyticsEyebrow}</p>
          <h2>{text.analyticsTitle}</h2>
        </div>
      </div>

      <div className="analytics-panel__grid">
        {items.map((item) => (
          <article key={item.label} className={`analytics-card ${loading ? "analytics-card--loading" : ""}`}>
            <p className="analytics-card__label">{item.label}</p>
            {loading ? (
              <>
                <div className="skeleton skeleton--title" />
                <div className="skeleton skeleton--text" />
              </>
            ) : (
              <>
                <h3>{item.value}</h3>
                <p>{item.detail}</p>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default AnalyticsPanel;
