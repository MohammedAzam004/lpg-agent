const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const OUT_OF_SCOPE_TOKEN = "OUT_OF_SCOPE";

const SUPPORTED_INTENTS = ["available", "not_available", "cheapest", "nearby", "recommendation", "general"];
const SUPPORTED_CONFIDENCE = ["high", "medium", "low"];

function normalizeString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function isConfiguredApiKey(apiKey) {
  const normalizedKey = normalizeString(apiKey);
  return Boolean(normalizedKey && normalizedKey !== "your-gemini-api-key");
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const normalizedValue = Number(value.replace(/[^\d.]+/g, ""));
    return Number.isFinite(normalizedValue) ? normalizedValue : null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function normalizeIntent(value) {
  if (typeof value !== "string") {
    return "general";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["availability", "available", "in_stock", "in stock"].includes(normalizedValue)) {
    return "available";
  }

  if (["not_available", "unavailable", "out_of_stock", "out of stock", "no_stock"].includes(normalizedValue)) {
    return "not_available";
  }

  if (["cheapest", "cheap", "lowest"].includes(normalizedValue)) {
    return "cheapest";
  }

  if (["nearby", "near", "search"].includes(normalizedValue)) {
    return "nearby";
  }

  if (["recommendation", "recommend", "best"].includes(normalizedValue)) {
    return "recommendation";
  }

  return SUPPORTED_INTENTS.includes(normalizedValue) ? normalizedValue : "general";
}

function normalizeConfidence(value) {
  if (typeof value !== "string") {
    return "medium";
  }

  const normalizedValue = value.trim().toLowerCase();
  return SUPPORTED_CONFIDENCE.includes(normalizedValue) ? normalizedValue : "medium";
}

function deriveAvailability(intent) {
  if (intent === "available") {
    return true;
  }

  if (intent === "not_available") {
    return false;
  }

  return null;
}

function deriveSort(intent) {
  if (intent === "cheapest") {
    return "price";
  }

  if (intent === "nearby") {
    return "distance";
  }

  return "none";
}

function stripCodeFence(text = "") {
  return text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractCandidateText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  const textParts = parts
    .map((part) => part.text)
    .filter(Boolean);

  return textParts.join("\n");
}

function isOutOfScopeValue(value) {
  return normalizeString(value)?.toUpperCase() === OUT_OF_SCOPE_TOKEN;
}

function normalizeGeminiResponse(response) {
  if (typeof response === "string" && isOutOfScopeValue(response)) {
    return {
      outOfScope: true
    };
  }

  if (isOutOfScopeValue(response?.intent) || isOutOfScopeValue(response?.scope)) {
    return {
      outOfScope: true
    };
  }

  return {
    outOfScope: false,
    intent: (() => {
      const normalizedIntent = normalizeIntent(response?.intent);
      return SUPPORTED_INTENTS.includes(normalizedIntent) ? normalizedIntent : "general";
    })(),
    state: normalizeString(response?.state ?? response?.location?.state),
    city: normalizeString(response?.city ?? response?.location?.city),
    priceLimit: normalizeNumber(response?.priceLimit ?? response?.filters?.maxPrice),
    distanceLimit: normalizeNumber(response?.distanceLimit ?? response?.filters?.maxDistance),
    confidence: normalizeConfidence(response?.confidence),
    filters: {
      maxPrice: normalizeNumber(response?.priceLimit ?? response?.filters?.maxPrice),
      maxDistance: normalizeNumber(response?.distanceLimit ?? response?.filters?.maxDistance),
      availableOnly: deriveAvailability(normalizeIntent(response?.intent)),
      availability: deriveAvailability(normalizeIntent(response?.intent)),
      sortBy: deriveSort(normalizeIntent(response?.intent))
    },
    location: {
      state: normalizeString(response?.state ?? response?.location?.state),
      city: normalizeString(response?.city ?? response?.location?.city)
    }
  };
}

async function extractQueryUnderstanding(query, locationHint, memoryContext = null) {
  if (!isConfiguredApiKey(process.env.GEMINI_API_KEY)) {
    throw new Error("GEMINI_API_KEY is missing or still using the placeholder value.");
  }

  const systemInstruction = [
    "You are an LPG assistant.",
    "Only analyze LPG-related queries about LPG availability, LPG stores, prices, locations, or recommendations.",
    `If the query is unrelated, respond with the exact text ${OUT_OF_SCOPE_TOKEN}.`,
    "For valid LPG queries, return minified JSON only.",
    "Use only these keys: intent, city, state, priceLimit, distanceLimit, confidence.",
    "Use intent values: available, not_available, cheapest, nearby, recommendation, general.",
    "Use null for any unknown city, state, priceLimit, or distanceLimit.",
    "Do not add explanations, markdown, or any extra text."
  ].join(" ");

  const prompt = [
    "Extract the structured search intent from this LPG store query.",
    `If the query is not about LPG, return ${OUT_OF_SCOPE_TOKEN}.`,
    "For valid queries, return JSON only with keys: intent, city, state, priceLimit, distanceLimit, confidence.",
    "Examples:",
    "{\"intent\":\"cheapest\",\"city\":\"Mumbai\",\"state\":null,\"priceLimit\":900,\"distanceLimit\":3,\"confidence\":\"high\"}",
    "{\"intent\":\"not_available\",\"city\":\"Hyderabad\",\"state\":null,\"priceLimit\":null,\"distanceLimit\":null,\"confidence\":\"high\"}",
    `Query: ${query}`,
    `Additional location hint: ${locationHint || "none"}`,
    `Recent memory context: ${memoryContext ? JSON.stringify({
      city: memoryContext.city || null,
      state: memoryContext.state || null,
      locationQuery: memoryContext.locationQuery || null,
      maxPrice: memoryContext.maxPrice ?? null,
      maxDistance: memoryContext.maxDistance ?? null,
      lastIntent: memoryContext.lastIntent || "general"
    }) : "none"}`,
    "Use recent memory context only when the new query is clearly a follow-up and the user did not provide a new value."
  ].join("\n");

  const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${errorBody}`);
  }

  const payload = await response.json();
  const rawText = extractCandidateText(payload);

  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  const sanitizedText = stripCodeFence(rawText);

  if (isOutOfScopeValue(sanitizedText.replace(/^"|"$/g, ""))) {
    return {
      outOfScope: true
    };
  }

  const parsedResponse = JSON.parse(sanitizedText);
  return normalizeGeminiResponse(parsedResponse);
}

module.exports = {
  extractQueryUnderstanding
};
