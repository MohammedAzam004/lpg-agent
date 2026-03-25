import { translations } from "./translations";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeWithEnglishFallback(baseText, overrideText) {
  if (!isPlainObject(baseText)) {
    return overrideText === undefined ? baseText : overrideText;
  }

  const mergedObject = { ...baseText };

  Object.entries(overrideText || {}).forEach(([key, value]) => {
    if (isPlainObject(baseText[key]) && isPlainObject(value)) {
      mergedObject[key] = mergeWithEnglishFallback(baseText[key], value);
      return;
    }

    mergedObject[key] = value;
  });

  return mergedObject;
}

export function getUiText(language = "en") {
  if (!translations[language] || language === "en") {
    return translations.en;
  }

  return mergeWithEnglishFallback(translations.en, translations[language]);
}
