import { translations } from "./translations";

export function getUiText(language = "en") {
  return translations[language] || translations.en;
}
