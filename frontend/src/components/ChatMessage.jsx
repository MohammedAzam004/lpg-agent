import { getUiText } from "../i18n";
import AlternativeCard from "./AlternativeCard";
import StoreCard from "./StoreCard";

function ChatMessage({
  message,
  language = "en",
  onRequestStore,
  requestPendingId = null,
  onNotifyStore,
  notifyPendingId = null,
  requestStatusByStoreId = {},
  onOpenStore
}) {
  const text = getUiText(language);
  const recommendation = message.recommendation || null;
  const stores = Array.isArray(message.stores) ? message.stores : [];
  const visibleStores = recommendation
    ? stores.filter((store) => store.id !== recommendation.id)
    : stores;
  const label = message.role === "user" ? text.you : text.aiAssistant;

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__bubble">
        <p className="chat-message__meta">{label}</p>
        <p className="chat-message__text">{message.text}</p>

        {!!recommendation && (
          <div className="chat-message__recommendation">
            <p className="chat-message__recommendation-label">{text.recommendationLabel}</p>
            <StoreCard
              store={recommendation}
              compact
              recommended
              language={language}
              onSelect={onOpenStore}
              onRequest={onRequestStore}
              requestLoading={requestPendingId === recommendation.id}
              onNotify={onNotifyStore}
              notifyLoading={notifyPendingId === recommendation.id}
              notifyStatus={requestStatusByStoreId[recommendation.id] || null}
            />
            {message.explanation && <p className="chat-message__explanation">{message.explanation}</p>}
          </div>
        )}

        {!!visibleStores.length && (
          <div className="chat-message__cards">
            {visibleStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                compact
                language={language}
                onSelect={onOpenStore}
                onRequest={onRequestStore}
                requestLoading={requestPendingId === store.id}
                onNotify={onNotifyStore}
                notifyLoading={notifyPendingId === store.id}
                notifyStatus={requestStatusByStoreId[store.id] || null}
              />
            ))}
          </div>
        )}

        {!!message.alternatives?.length && (
          <div className="chat-message__cards">
            {message.alternatives.map((item) => (
              <AlternativeCard key={item.id} item={item} language={language} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
