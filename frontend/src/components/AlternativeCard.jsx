import { getUiText } from "../i18n";

function AlternativeCard({ item, language = "en" }) {
  const text = getUiText(language);

  return (
    <article className="alternative-card">
      <div className="alternative-card__header">
        <div>
          <p className="alternative-card__label">{text.alternative}</p>
          <h3>{item.name}</h3>
        </div>
        {item.priceRange && <span className="alternative-card__price">{item.priceRange}</span>}
      </div>
      <p className="alternative-card__description">{item.description}</p>
    </article>
  );
}

export default AlternativeCard;
