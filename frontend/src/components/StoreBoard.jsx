import StoreCard from "./StoreCard";

function StoreBoard({
  uiText,
  activeLocation = "",
  dashboardLoading = false,
  stores = [],
  stateCount = 0,
  cityCount = 0,
  recommendedStore = null,
  highlightedStoreId = null,
  registerStoreCardRef,
  onRequestStore,
  bookingStatusByStoreId = {},
  bookingPendingStoreId = null,
  onNotifyStore,
  notifyPendingStoreId = null,
  requestStatusByStoreId = {},
  language = "en",
  className = ""
}) {
  const panelClassName = className ? `store-panel ${className}` : "store-panel";

  return (
    <div className={panelClassName}>
      <div className="store-panel__header">
        <div>
          <p className="store-panel__eyebrow">{uiText.availabilityBoard}</p>
          <h2>{activeLocation ? uiText.storesNear(activeLocation) : uiText.allStores}</h2>
          <p className="store-panel__summary">
            {dashboardLoading ? uiText.loadingBranches : uiText.branchSummary(stores.length, stateCount, cityCount)}
          </p>
        </div>
      </div>

      <div className="store-panel__content">
        {dashboardLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <article key={`store-skeleton-${index}`} className="store-card store-card--skeleton">
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--grid" />
            </article>
          ))
        ) : stores.length ? (
          stores.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              recommended={recommendedStore?.id === store.id}
              language={language}
              storeRef={(element) => registerStoreCardRef?.(store.id, element)}
              highlighted={highlightedStoreId === store.id}
              onRequest={onRequestStore}
              requestStatus={bookingStatusByStoreId[store.id] || null}
              requestLoading={bookingPendingStoreId === store.id}
              onNotify={onNotifyStore}
              notifyLoading={notifyPendingStoreId === store.id}
              notifyStatus={requestStatusByStoreId[store.id] || null}
            />
          ))
        ) : (
          <p className="store-panel__empty">{uiText.noStoreMatch}</p>
        )}
      </div>
    </div>
  );
}

export default StoreBoard;
