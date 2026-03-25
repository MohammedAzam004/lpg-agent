const {
  getAllStores,
  getFallbackAlternatives
} = require("./storeService");
const { getConversationMemory, saveConversationTurn } = require("./chatMemoryService");
const { extractQueryUnderstanding } = require("./geminiService");
const { runChatAgents } = require("./agents/orchestrator");

const COPY = {
  en: {
    greeting: "Hi! I can help you find LPG availability, prices, and nearby stores.",
    smallTalk: "I am doing well. I can help with LPG availability, prices, and nearby stores.",
    help: "Ask about available LPG, out-of-stock LPG, cheapest LPG, or nearby stores in a city.",
    unrelated: "I can help with LPG availability, prices, and nearby stores.",
    availableNone: "No LPG is currently available",
    unavailableNone: "All nearby stores currently have LPG available",
    searchNone: "I could not find LPG stores that match your request",
    cheapestNone: "I could not find any available LPG stores",
    availableDescriptor: "available LPG stores",
    unavailableDescriptor: "out-of-stock LPG stores",
    cheapestDescriptor: "cheapest LPG stores",
    nearbyDescriptor: "nearby LPG stores",
    searchDescriptor: "LPG stores",
    recommendationDescriptor: "recommended LPG options",
    bestRecommendationPrefix: "Best recommendation:",
    recommendationFallback: "This store is recommended because it offers a strong balance of distance and price."
  },
  hi: {
    greeting: "नमस्ते! मैं LPG उपलब्धता, कीमत, और नज़दीकी स्टोर ढूंढने में मदद कर सकता हूँ।",
    smallTalk: "मैं ठीक हूँ। मैं LPG उपलब्धता, कीमत, और नज़दीकी स्टोर में आपकी मदद कर सकता हूँ।",
    help: "उपलब्ध LPG, आउट-ऑफ-स्टॉक LPG, सबसे सस्ता LPG, या किसी शहर के पास के स्टोर के बारे में पूछें।",
    unrelated: "मैं LPG उपलब्धता, कीमत, और नज़दीकी स्टोर में मदद कर सकता हूँ।",
    availableNone: "इस स्थान पर अभी LPG उपलब्ध नहीं है",
    unavailableNone: "पास के सभी स्टोर में अभी LPG उपलब्ध है",
    searchNone: "आपकी रिक्वेस्ट के हिसाब से LPG स्टोर नहीं मिले",
    cheapestNone: "इस रिक्वेस्ट के लिए कोई उपलब्ध LPG स्टोर नहीं मिला",
    availableDescriptor: "उपलब्ध LPG स्टोर",
    unavailableDescriptor: "आउट-ऑफ-स्टॉक LPG स्टोर",
    cheapestDescriptor: "सबसे सस्ते LPG स्टोर",
    nearbyDescriptor: "नज़दीकी LPG स्टोर",
    searchDescriptor: "LPG स्टोर",
    recommendationDescriptor: "सिफारस किए गए LPG विकल्प",
    bestRecommendationPrefix: "सर्वश्रेष्ठ सुझाव:",
    recommendationFallback: "यह स्टोर दूरी और कीमत के अच्छे संतुलन की वजह से सुझाया गया है।"
  },
  te: {
    greeting: "హాయ్! LPG లభ్యత, ధరలు, మరియు సమీప స్టోర్లను కనుగొనడంలో నేను సహాయం చేయగలను.",
    smallTalk: "నేను బాగున్నాను. LPG లభ్యత, ధరలు, మరియు సమీప స్టోర్ల విషయంలో నేను సహాయం చేయగలను.",
    help: "అందుబాటులో ఉన్న LPG, స్టాక్ లేని LPG, తక్కువ ధర LPG, లేదా నగరానికి సమీపంలోని స్టోర్ల గురించి అడగండి.",
    unrelated: "నేను LPG లభ్యత, ధరలు, మరియు సమీప స్టోర్ల గురించి మాత్రమే సహాయం చేయగలను.",
    availableNone: "ఈ స్థానంలో ప్రస్తుతం LPG అందుబాటులో లేదు",
    unavailableNone: "సమీపంలోని అన్ని స్టోర్లలో ప్రస్తుతం LPG అందుబాటులో ఉంది",
    searchNone: "మీ అభ్యర్థనకు సరిపోయే LPG స్టోర్లు కనుగొనలేకపోయాను",
    cheapestNone: "ఈ అభ్యర్థనకు సరిపోయే అందుబాటులో ఉన్న LPG స్టోర్ కనుగొనలేకపోయాను",
    availableDescriptor: "అందుబాటులో ఉన్న LPG స్టోర్లు",
    unavailableDescriptor: "స్టాక్ లేని LPG స్టోర్లు",
    cheapestDescriptor: "తక్కువ ధర LPG స్టోర్లు",
    nearbyDescriptor: "సమీప LPG స్టోర్లు",
    searchDescriptor: "LPG స్టోర్లు",
    recommendationDescriptor: "సిఫారసు చేసిన LPG ఎంపికలు",
    bestRecommendationPrefix: "ఉత్తమ సిఫారసు:",
    recommendationFallback: "దూరం మరియు ధర మధ్య మంచి సమతుల్యత ఉన్నందున ఈ స్టోర్ సిఫారసు చేయబడింది."
  }
};

const GREETING_PATTERNS = [
  /^(hi|hii|hello|hey|namaste)\b/i,
  /\bgood (morning|afternoon|evening)\b/i,
  /\bnamaskar\b/i
];

const SMALL_TALK_PATTERNS = [
  /\bhow are you\b/i,
  /\bhow's it going\b/i,
  /\bkaise ho\b/i,
  /\bkya haal hai\b/i
];

const LPG_KEYWORD_PATTERNS = [
  /\blpg\b/i,
  /\bgas\b/i,
  /\bcylinder\b/i,
  /\brefill\b/i,
  /\bagency\b/i,
  /\bbranch\b/i,
  /\bdistributor\b/i,
  /\bbooking\b/i,
  /à¤à¤²à¤ªà¥€à¤œà¥€/i,
  /à¤—à¥ˆà¤¸/i,
  /à¤¸à¤¿à¤²à¥‡à¤‚à¤¡à¤°/i,
  /à¤°à¤¿à¤«à¤¿à¤²/i
];

const LPG_INTENT_PATTERNS = [
  /\bavailable\b/i,
  /\bavailability\b/i,
  /\bin stock\b/i,
  /\bout of stock\b/i,
  /\bnot available\b/i,
  /\bno gas\b/i,
  /\bcheap\b/i,
  /\bcheapest\b/i,
  /\blowest\b/i,
  /\bnear me\b/i,
  /\bnearby\b/i,
  /\bnear\b/i,
  /\brecommend\b/i,
  /\bbest\b/i,
  /\bunder\s*(?:rs\.?|â‚¹)?\s*\d+/i,
  /\bwithin\s*\d+(?:\.\d+)?\s*km\b/i,
  /à¤‰à¤ªà¤²à¤¬à¥à¤§/i,
  /à¤¸à¥à¤Ÿà¥‰à¤•/i,
  /à¤¸à¤¬à¤¸à¥‡ à¤¸à¤¸à¥à¤¤à¤¾/i,
  /à¤ªà¤¾à¤¸/i
];

const CLEARLY_UNRELATED_PATTERNS = [
  /\bweather\b/i,
  /\btemperature\b/i,
  /\brain\b/i,
  /\bcricket\b/i,
  /\bfootball\b/i,
  /\bmovie\b/i,
  /\bpolitics\b/i,
  /\bnews\b/i,
  /\bpython\b/i,
  /\bjavascript\b/i,
  /\bcoding\b/i,
  /\bprogramming\b/i
];

const NOT_AVAILABLE_PATTERNS = [
  /\bnot available\b/i,
  /\bout of stock\b/i,
  /\bno gas\b/i,
  /\bunavailable\b/i,
  /\bwithout stock\b/i,
  /à¤‰à¤ªà¤²à¤¬à¥à¤§ à¤¨à¤¹à¥€à¤‚/i,
  /à¤¸à¥à¤Ÿà¥‰à¤• à¤¨à¤¹à¥€à¤‚/i,
  /à¤–à¤¤à¥à¤®/i
];

const AVAILABLE_PATTERNS = [
  /\bin stock\b/i,
  /\bavailable\b/i,
  /\bavailability\b/i,
  /\bwith stock\b/i,
  /à¤‰à¤ªà¤²à¤¬à¥à¤§/i,
  /à¤¸à¥à¤Ÿà¥‰à¤• à¤¹à¥ˆ/i
];

const CHEAPEST_PATTERNS = [
  /\bcheap\b/i,
  /\bcheapest\b/i,
  /\blowest\b/i,
  /\bbudget\b/i,
  /à¤¸à¤¬à¤¸à¥‡ à¤¸à¤¸à¥à¤¤à¤¾/i,
  /à¤•à¤® à¤•à¥€à¤®à¤¤/i
];

const NEARBY_PATTERNS = [
  /\bnear me\b/i,
  /\bnearby\b/i,
  /\bnear\b/i,
  /à¤ªà¤¾à¤¸/i,
  /à¤¨à¤œà¤¦à¥€à¤•/i
];

const RECOMMENDATION_PATTERNS = [
  /\brecommend\b/i,
  /\bbest\b/i,
  /\bsuggest\b/i,
  /à¤¸à¥à¤à¤¾à¤µ/i,
  /à¤¸à¤¬à¤¸à¥‡ à¤…à¤šà¥à¤›à¤¾/i
];

const FOLLOW_UP_PATTERNS = [
  /\bwhat about\b/i,
  /\bhow about\b/i,
  /\bthat one\b/i,
  /\bthose\b/i,
  /\bthem\b/i,
  /\bthere\b/i,
  /\bsame\b/i,
  /\bclosest\b/i,
  /\bcheapest one\b/i,
  /\bavailable one\b/i,
  /\bout of stock one\b/i,
  /\bwithin\b/i,
  /\bunder\b/i,
  /\bbelow\b/i,
  /à¤‰à¤¸à¥€/i,
  /à¤µà¤¹à¥€à¤‚/i
];

function getLanguageCopy(language = "en") {
  return COPY[language] || COPY.en;
}

function normalizeLanguage(language = "en") {
  return ["en", "hi", "te"].includes(language) ? language : "en";
}

function normalizeText(value = "") {
  return value.toString().trim();
}

function normalizeMessageText(value = "") {
  return normalizeText(value).toLowerCase();
}

function normalizeIntent(intent) {
  const normalizedIntent = normalizeMessageText(intent);

  if (normalizedIntent === "availability") {
    return "available";
  }

  if (["nearby", "near"].includes(normalizedIntent)) {
    return "nearby";
  }

  if (["search", "available", "not_available", "cheapest", "nearby", "recommendation", "general", "help"].includes(normalizedIntent)) {
    return normalizedIntent;
  }

  return "general";
}

function buildChatResponse({
  success = true,
  intent,
  query,
  location,
  reply,
  stores = [],
  recommendation = null,
  alternatives = [],
  explanation = null,
  language = "en"
}) {
  return {
    success,
    intent,
    query,
    location: location || null,
    language,
    reply,
    explanation,
    count: stores.length,
    stores,
    recommendation,
    alternatives
  };
}

function buildGreetingResponse(message, location, language) {
  const copy = getLanguageCopy(language);
  return buildChatResponse({
    intent: "greeting",
    query: message || "",
    location,
    reply: copy.greeting,
    stores: [],
    recommendation: null,
    alternatives: [],
    language
  });
}

function buildSmallTalkResponse(message, location, language) {
  const copy = getLanguageCopy(language);
  return buildChatResponse({
    intent: "small_talk",
    query: message || "",
    location,
    reply: copy.smallTalk,
    stores: [],
    recommendation: null,
    alternatives: [],
    language
  });
}

function buildRestrictedResponse(message, location, language) {
  const copy = getLanguageCopy(language);
  return buildChatResponse({
    intent: "general",
    query: message || "",
    location,
    reply: copy.unrelated,
    stores: [],
    recommendation: null,
    alternatives: [],
    language
  });
}

function isGreetingQuery(message) {
  return GREETING_PATTERNS.some((pattern) => pattern.test(message));
}

function isSmallTalkQuery(message) {
  return SMALL_TALK_PATTERNS.some((pattern) => pattern.test(message));
}

function isLpgAllowedQuery(message) {
  const hasKeyword = LPG_KEYWORD_PATTERNS.some((pattern) => pattern.test(message));
  const hasIntentSignal = LPG_INTENT_PATTERNS.some((pattern) => pattern.test(message));
  const looksUnrelated = CLEARLY_UNRELATED_PATTERNS.some((pattern) => pattern.test(message));

  if (hasKeyword) {
    return true;
  }

  return hasIntentSignal && !looksUnrelated;
}

function preprocessQuery(message) {
  const normalizedMessage = normalizeMessageText(message);
  const isGreeting = isGreetingQuery(normalizedMessage);
  const isSmallTalk = isSmallTalkQuery(normalizedMessage);
  const isLpgQuery = isLpgAllowedQuery(normalizedMessage);

  let category = "unrelated";

  if (!normalizedMessage) {
    category = "empty";
  } else if (isLpgQuery) {
    category = "lpg";
  } else if (isSmallTalk) {
    category = "small_talk";
  } else if (isGreeting) {
    category = "greeting";
  }

  return {
    normalizedMessage,
    category
  };
}

function isFollowUpQuery(message) {
  const normalizedMessage = normalizeMessageText(message);
  const wordCount = normalizedMessage ? normalizedMessage.split(/\s+/).length : 0;
  const hasFollowUpCue = FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
  const hasPrimaryLpgKeyword = LPG_KEYWORD_PATTERNS.some((pattern) => pattern.test(normalizedMessage));

  return hasFollowUpCue || (wordCount > 0 && wordCount <= 4 && !hasPrimaryLpgKeyword);
}

function normalizeMemoryContext(memoryRecord = null) {
  return {
    lastIntent: normalizeIntent(memoryRecord?.context?.lastIntent),
    state: memoryRecord?.context?.state || null,
    city: memoryRecord?.context?.city || null,
    locationQuery: memoryRecord?.context?.locationQuery || null,
    maxPrice: typeof memoryRecord?.context?.maxPrice === "number" ? memoryRecord.context.maxPrice : null,
    maxDistance: typeof memoryRecord?.context?.maxDistance === "number" ? memoryRecord.context.maxDistance : null,
    language: memoryRecord?.context?.language || "en"
  };
}

function detectAvailabilityFilter(message) {
  if (NOT_AVAILABLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }

  if (AVAILABLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  return null;
}

function detectIntent(message) {
  const normalizedMessage = normalizeMessageText(message);
  const availabilityFilter = detectAvailabilityFilter(normalizedMessage);

  if (!normalizedMessage) {
    return "help";
  }

  if (availabilityFilter === false) {
    return "not_available";
  }

  if (CHEAPEST_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
    return "cheapest";
  }

  if (availabilityFilter === true) {
    return "available";
  }

  if (NEARBY_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
    return "nearby";
  }

  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
    return "recommendation";
  }

  if (
    normalizedMessage.includes("gas")
    || normalizedMessage.includes("lpg")
    || normalizedMessage.includes("cylinder")
    || normalizedMessage.includes("à¤—à¥ˆà¤¸")
    || normalizedMessage.includes("à¤à¤²à¤ªà¥€à¤œà¥€")
  ) {
    return "search";
  }

  return "general";
}

function hasPriceConstraint(message = "") {
  return /(?:under|below|less than)\s*(?:rs\.?|â‚¹)?\s*\d+(?:\.\d+)?/i.test(message)
    || /(?:â‚¹|rs\.?)\s*\d+(?:\.\d+)?/i.test(message)
    || /(?:à¤•à¥‡ à¤¨à¥€à¤šà¥‡|à¤¸à¥‡ à¤•à¤®)\s*\d+(?:\.\d+)?/i.test(message);
}

function hasDistanceConstraint(message = "") {
  return /(?:within|under|below)\s*\d+(?:\.\d+)?\s*km/i.test(message)
    || /\d+(?:\.\d+)?\s*km/i.test(message)
    || /\d+(?:\.\d+)?\s*à¤•à¤¿à¤®à¥€/i.test(message);
}

function extractNumericFilter(message, patterns) {
  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function findMentionInText(message, values = []) {
  const normalizedMessage = normalizeMessageText(message);

  return values
    .filter(Boolean)
    .sort((leftValue, rightValue) => rightValue.length - leftValue.length)
    .find((value) => normalizedMessage.includes(normalizeMessageText(value))) || null;
}

function buildLocationObject(searchFilters = {}) {
  return {
    state: searchFilters.state || null,
    city: searchFilters.city || null,
    query: searchFilters.locationQuery || null
  };
}

function buildLocationLabel(location = {}) {
  return [...new Set([location.city, location.state, location.query].filter(Boolean))].join(", ");
}

function deriveLocationHint(explicitLocationHint, memoryContext = {}) {
  return explicitLocationHint
    || memoryContext.locationQuery
    || memoryContext.city
    || memoryContext.state
    || null;
}

function applyMemoryContext(extractedQuery = {}, memoryContext = {}, message, explicitLocationHint) {
  const nextQuery = {
    ...extractedQuery,
    location: {
      ...(extractedQuery.location || {})
    },
    filters: {
      ...(extractedQuery.filters || {})
    }
  };
  const followUp = isFollowUpQuery(message);
  const hasExplicitLocation = Boolean(
    explicitLocationHint
    || nextQuery.city
    || nextQuery.state
    || nextQuery.location?.city
    || nextQuery.location?.state
    || nextQuery.locationQuery
  );

  if (!hasExplicitLocation) {
    if (!nextQuery.state && !nextQuery.location.state && memoryContext.state) {
      nextQuery.state = memoryContext.state;
      nextQuery.location.state = memoryContext.state;
    }

    if (!nextQuery.city && !nextQuery.location.city && memoryContext.city) {
      nextQuery.city = memoryContext.city;
      nextQuery.location.city = memoryContext.city;
    }

    if (!nextQuery.locationQuery && memoryContext.locationQuery) {
      nextQuery.locationQuery = memoryContext.locationQuery;
    }
  }

  if (
    followUp
    && normalizeIntent(nextQuery.intent) === "general"
    && memoryContext.lastIntent
    && !["general", "help", "greeting", "small_talk"].includes(memoryContext.lastIntent)
  ) {
    nextQuery.intent = memoryContext.lastIntent;
  }

  const normalizedIntent = normalizeIntent(nextQuery.intent);

  if (
    !nextQuery.filters.sortBy
    || nextQuery.filters.sortBy === "none"
    || (followUp && normalizedIntent === "cheapest")
  ) {
    nextQuery.filters.sortBy = normalizedIntent === "cheapest" ? "price" : "distance";
  }

  return nextQuery;
}

function buildConstraintSuffix(locationLabel, searchFilters = {}, language = "en") {
  const parts = [];

  if (locationLabel) {
    parts.push(language === "hi" ? `${locationLabel} में` : language === "te" ? `${locationLabel} లో` : `in ${locationLabel}`);
  }

  if (searchFilters.maxPrice !== null && searchFilters.maxPrice !== undefined) {
    parts.push(language === "hi" ? `Rs. ${searchFilters.maxPrice} से कम` : language === "te" ? `Rs. ${searchFilters.maxPrice} లోపు` : `under Rs. ${searchFilters.maxPrice}`);
  }

  if (searchFilters.maxDistance !== null && searchFilters.maxDistance !== undefined) {
    parts.push(language === "hi" ? `${searchFilters.maxDistance} km के भीतर` : language === "te" ? `${searchFilters.maxDistance} km లోపు` : `within ${searchFilters.maxDistance} km`);
  }

  return parts.length ? ` ${parts.join(language === "en" ? " " : ", ")}` : "";
}

function buildStoreSummary(store, language = "en") {
  const locationName = store.city || store.location;
  const predictionNote = store?.prediction
    ? language === "hi"
      ? ` पूर्वानुमान: ${store.prediction}.`
      : language === "te"
        ? ` అంచనా: ${store.prediction}.`
        : ` Prediction: ${store.prediction}.`
    : "";

  if (language === "hi") {
    return `${locationName} में ${store.name} ${store.distance} km दूर है और कीमत Rs. ${store.price} है।${predictionNote}`;
  }

  if (language === "te") {
    return `${locationName} లో ${store.name} ${store.distance} km దూరంలో ఉంది మరియు ధర Rs. ${store.price}. ${predictionNote}`.trim();
  }

  return `${store.name} in ${locationName} is ${store.distance} km away at Rs. ${store.price}.${predictionNote}`;
}

function localizeExplanation(explanation, language) {
  if (!explanation) {
    return explanation;
  }

  if (language === "en") {
    return explanation;
  }

  const explanationMap = {
    hi: {
      "This store is recommended because it is closest and cheapest.": "यह स्टोर इसलिए सुझाया गया है क्योंकि यह सबसे पास और सबसे सस्ता है।",
      "This store is recommended because it is the closest available option with a competitive price.": "यह स्टोर इसलिए सुझाया गया है क्योंकि यह सबसे नज़दीकी उपलब्ध विकल्प है और इसकी कीमत भी अच्छी है।",
      "This store is recommended because it offers the lowest price among available stores.": "यह स्टोर इसलिए सुझाया गया है क्योंकि उपलब्ध स्टोर में इसकी कीमत सबसे कम है।",
      "This store is recommended because it offers the best balance of price and distance.": "यह स्टोर इसलिए सुझाया गया है क्योंकि यह कीमत और दूरी का सबसे अच्छा संतुलन देता है।",
      "This store is recommended because it is the best available option right now.": "यह स्टोर इसलिए सुझाया गया है क्योंकि यह अभी का सबसे अच्छा उपलब्ध विकल्प है।"
    },
    te: {
      "This store is recommended because it is closest and cheapest.": "ఈ స్టోర్ అత్యంత దగ్గరగా ఉండి తక్కువ ధరలో ఉండటంతో సిఫారసు చేయబడింది.",
      "This store is recommended because it is the closest available option with a competitive price.": "ఈ స్టోర్ దగ్గరగా ఉండి పోటీ ధరలో అందుబాటులో ఉండటంతో సిఫారసు చేయబడింది.",
      "This store is recommended because it offers the lowest price among available stores.": "అందుబాటులో ఉన్న స్టోర్లలో ఇది అత్యల్ప ధరను అందిస్తున్నందున సిఫారసు చేయబడింది.",
      "This store is recommended because it offers the best balance of price and distance.": "ధర మరియు దూరం మధ్య మంచి సమతుల్యత ఉన్నందున ఈ స్టోర్ సిఫారసు చేయబడింది.",
      "This store is recommended because it is the best available option right now.": "ప్రస్తుతం అందుబాటులో ఉన్న ఉత్తమ ఎంపిక కావడంతో ఈ స్టోర్ సిఫారసు చేయబడింది."
    }
  };

  return explanationMap[language]?.[explanation] || getLanguageCopy(language).recommendationFallback;
}

function resolveIntent(message, extractedIntent) {
  const ruleIntent = normalizeIntent(detectIntent(message));
  const aiIntent = normalizeIntent(extractedIntent);

  if (["available", "not_available", "cheapest", "nearby", "recommendation"].includes(ruleIntent)) {
    return ruleIntent;
  }

  if (aiIntent !== "general") {
    return aiIntent;
  }

  return ruleIntent;
}

function resolveAvailabilityFilter(message, extractedQuery, intent) {
  const ruleAvailability = detectAvailabilityFilter(message);

  if (typeof ruleAvailability === "boolean") {
    return ruleAvailability;
  }

  if (typeof extractedQuery?.filters?.availability === "boolean") {
    return extractedQuery.filters.availability;
  }

  if (typeof extractedQuery?.filters?.availableOnly === "boolean") {
    return extractedQuery.filters.availableOnly;
  }

  if (intent === "available") {
    return true;
  }

  if (intent === "not_available") {
    return false;
  }

  if (intent === "cheapest" || intent === "recommendation") {
    return true;
  }

  return null;
}

function buildSearchFilters({ locationHint, extractedQuery, intent, availabilityFilter }) {
  const state = extractedQuery?.state ?? extractedQuery?.location?.state ?? null;
  const city = extractedQuery?.city ?? extractedQuery?.location?.city ?? null;
  const maxPrice = extractedQuery?.priceLimit ?? extractedQuery?.filters?.maxPrice ?? null;
  const maxDistance = extractedQuery?.distanceLimit ?? extractedQuery?.filters?.maxDistance ?? null;
  const locationQuery = extractedQuery?.locationQuery || city || state || locationHint || null;
  const sortBy = extractedQuery?.filters?.sortBy && extractedQuery.filters.sortBy !== "none"
    ? extractedQuery.filters.sortBy
    : intent === "cheapest"
      ? "price"
      : "distance";

  return {
    locationQuery,
    state,
    city,
    maxPrice,
    maxDistance,
    availability: availabilityFilter,
    sortBy
  };
}

function buildNoStoresReply(intent, locationLabel, language, searchFilters = {}) {
  const copy = getLanguageCopy(language);
  const suffix = buildConstraintSuffix(locationLabel, searchFilters, language);

  if (intent === "available") {
    return `${copy.availableNone}${suffix}.`.replace(/\s+\./, ".");
  }

  if (intent === "not_available") {
    if (locationLabel) {
      if (language === "hi") {
        return `${locationLabel} में सभी LPG स्टोर में अभी स्टॉक है।`;
      }

      if (language === "te") {
        return `${locationLabel} లోని అన్ని LPG స్టోర్లలో ప్రస్తుతం స్టాక్ ఉంది.`;
      }

      return `All LPG stores in ${locationLabel} currently have stock.`;
    }

    return `${copy.unavailableNone}.`;
  }

  if (intent === "cheapest") {
    return `${copy.cheapestNone}${suffix}.`.replace(/\s+\./, ".");
  }

  return `${copy.searchNone}${suffix}.`.replace(/\s+\./, ".");
}

function buildPrimaryReply(intent, stores, recommendation, locationLabel, language, searchFilters = {}) {
  const copy = getLanguageCopy(language);
  const suffix = buildConstraintSuffix(locationLabel, searchFilters, language);
  const descriptor = intent === "available"
    ? copy.availableDescriptor
    : intent === "not_available"
      ? copy.unavailableDescriptor
      : intent === "cheapest"
        ? copy.cheapestDescriptor
        : intent === "nearby"
          ? copy.nearbyDescriptor
          : intent === "recommendation"
            ? copy.recommendationDescriptor
            : copy.searchDescriptor;

  let reply;

  if (language === "hi") {
    reply = `${stores.length} ${descriptor}${suffix} मिले।`;
  } else if (language === "te") {
    reply = `${stores.length} ${descriptor}${suffix} దొరికాయి.`;
  } else {
    const countAwareDescriptor = stores.length === 1
      ? descriptor.replace(/stores$/, "store").replace(/options$/, "option")
      : descriptor;
    reply = `Here ${stores.length === 1 ? "is" : "are"} ${stores.length} ${countAwareDescriptor}${suffix}.`.replace(/\s+\./, ".");
  }

  if (recommendation) {
    reply += ` ${copy.bestRecommendationPrefix} ${buildStoreSummary(recommendation, language)}`;
  }

  return reply;
}

function buildHelpResponse(message, location, language) {
  const copy = getLanguageCopy(language);
  return buildChatResponse({
    intent: "help",
    query: message || "",
    location,
    reply: copy.help,
    stores: [],
    recommendation: null,
    alternatives: [],
    language
  });
}

function buildMemoryPayload(response, extractedQuery = {}, locationHint, language) {
  const state = response?.location?.state || extractedQuery.state || extractedQuery.location?.state;
  const city = response?.location?.city || extractedQuery.city || extractedQuery.location?.city;
  const locationQuery = response?.location?.query || extractedQuery.locationQuery || locationHint;
  const maxPrice = extractedQuery.priceLimit ?? extractedQuery.filters?.maxPrice;
  const maxDistance = extractedQuery.distanceLimit ?? extractedQuery.filters?.maxDistance;

  return {
    lastIntent: response?.intent || extractedQuery.intent || "general",
    state: state || undefined,
    city: city || undefined,
    locationQuery: locationQuery || undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    maxDistance: Number.isFinite(maxDistance) ? maxDistance : undefined,
    language
  };
}

async function persistChatMemory(identity, userMessage, response, context = {}) {
  if (!identity?.userEmail && !identity?.sessionId) {
    return;
  }

  await saveConversationTurn(identity, {
    userMessage,
    botReply: response.reply,
    context
  });
}

async function extractLegacyQueryUnderstanding(message, locationHint) {
  const stores = await getAllStores();
  const combinedText = [message, locationHint].filter(Boolean).join(" ");
  const states = [...new Set(stores.map((store) => store.state).filter(Boolean))];
  const cities = [...new Set(stores.map((store) => store.city).filter(Boolean))];
  const localAreas = [...new Set(stores.map((store) => store.location).filter(Boolean))];
  const intent = normalizeIntent(detectIntent(message));
  const state = findMentionInText(combinedText, states);
  const city = findMentionInText(combinedText, cities);
  const localArea = findMentionInText(combinedText, localAreas);
  const maxPrice = extractNumericFilter(combinedText, [
    /(?:under|below|less than)\s*(?:rs\.?|â‚¹)?\s*(\d+(?:\.\d+)?)/i,
    /(?:under|below|less than)\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees)?/i,
    /(?:â‚¹|rs\.?)\s*(\d+(?:\.\d+)?)/i,
    /(?:à¤•à¥‡ à¤¨à¥€à¤šà¥‡|à¤¸à¥‡ à¤•à¤®)\s*(\d+(?:\.\d+)?)/i
  ]);
  const maxDistance = extractNumericFilter(combinedText, [
    /(?:within|under|below)\s*(\d+(?:\.\d+)?)\s*km/i,
    /(\d+(?:\.\d+)?)\s*km/i,
    /(\d+(?:\.\d+)?)\s*à¤•à¤¿à¤®à¥€/i
  ]);
  const availability = resolveAvailabilityFilter(message, {}, intent);

  return {
    intent: intent === "help" ? "general" : intent,
    state,
    city,
    priceLimit: maxPrice,
    distanceLimit: maxDistance,
    confidence: "medium",
    location: {
      state,
      city
    },
    locationQuery: locationHint || localArea || city || state || null,
    filters: {
      maxPrice,
      maxDistance,
      availableOnly: availability,
      availability,
      sortBy: intent === "cheapest" ? "price" : "distance"
    }
  };
}

function getGeminiFallbackReason(message, extractedQuery = {}) {
  const normalizedMessage = normalizeMessageText(message);
  const ruleIntent = normalizeIntent(detectIntent(normalizedMessage));
  const aiIntent = normalizeIntent(extractedQuery.intent);

  if (extractedQuery.confidence === "low") {
    return "Gemini confidence is low.";
  }

  if (
    ["available", "not_available", "cheapest", "nearby"].includes(ruleIntent)
    && aiIntent === "general"
  ) {
    return `Gemini intent "${aiIntent}" is too weak for rule intent "${ruleIntent}".`;
  }

  if (hasPriceConstraint(normalizedMessage) && extractedQuery.priceLimit == null && extractedQuery.filters?.maxPrice == null) {
    return "Gemini missed the price constraint.";
  }

  if (
    hasDistanceConstraint(normalizedMessage)
    && extractedQuery.distanceLimit == null
    && extractedQuery.filters?.maxDistance == null
  ) {
    return "Gemini missed the distance constraint.";
  }

  return null;
}

async function buildStructuredResponse(message, locationHint, extractedQuery, language) {
  const intent = resolveIntent(message, extractedQuery.intent);
  const availabilityFilter = resolveAvailabilityFilter(message, extractedQuery, intent);
  const searchFilters = buildSearchFilters({
    locationHint,
    extractedQuery,
    intent,
    availabilityFilter
  });
  const location = buildLocationObject(searchFilters);
  const locationLabel = buildLocationLabel(location);
  const availabilityLabel = typeof availabilityFilter === "boolean"
    ? (availabilityFilter ? "available" : "not_available")
    : "none";

  console.log(
    `[chat] detected intent="${intent}" filters={location:"${locationLabel || "all"}", maxPrice:"${searchFilters.maxPrice ?? "none"}", maxDistance:"${searchFilters.maxDistance ?? "none"}", availability:"${availabilityLabel}", sortBy:"${searchFilters.sortBy}"}`
  );

  const agentResult = await runChatAgents({
    intent,
    searchFilters
  });
  const validatedStores = agentResult.stores;
  const visibleStores = agentResult.visibleStores;
  const recommendation = agentResult.recommendation;
  const explanation = recommendation
    ? localizeExplanation(
      agentResult.explanation || getLanguageCopy(language).recommendationFallback,
      language
    )
    : null;

  console.log(`[chat] number of results=${visibleStores.length} for intent="${intent}"`);

  if (!visibleStores.length) {
    return buildChatResponse({
      intent,
      query: message,
      location,
      reply: buildNoStoresReply(intent, locationLabel, language, searchFilters),
      stores: [],
      recommendation: null,
      alternatives: intent === "not_available" ? [] : getFallbackAlternatives(),
      explanation: null,
      language
    });
  }

  return buildChatResponse({
    intent,
    query: message,
    location,
    reply: buildPrimaryReply(intent, visibleStores, recommendation, locationLabel, language, searchFilters),
    stores: visibleStores,
    recommendation,
    explanation,
    alternatives: [],
    language
  });
}

async function processLegacyChatMessage(message, locationHint, language, memoryContext = {}) {
  const fallbackQuery = await extractLegacyQueryUnderstanding(message, locationHint);
  const memoryAwareQuery = applyMemoryContext(fallbackQuery, memoryContext, message, locationHint);
  return buildStructuredResponse(message, locationHint, memoryAwareQuery, language);
}

async function processChatMessage(message, location, language = "en", identity = {}) {
  const resolvedLanguage = normalizeLanguage(language);
  const { normalizedMessage, category } = preprocessQuery(message);
  const memoryRecord = await getConversationMemory(identity);
  const memoryContext = normalizeMemoryContext(memoryRecord);
  const resolvedLocationHint = deriveLocationHint(location, memoryContext);

  console.log(
    `[chat] user query="${normalizedMessage || "empty"}" category="${category}" language="${resolvedLanguage}" memoryLocation="${resolvedLocationHint || "none"}"`
  );

  if (!normalizedMessage) {
    const helpResponse = buildHelpResponse("", resolvedLocationHint, resolvedLanguage);
    await persistChatMemory(identity, message, helpResponse, {
      lastIntent: helpResponse.intent,
      language: resolvedLanguage
    });
    return helpResponse;
  }

  if (category === "greeting") {
    const greetingResponse = buildGreetingResponse(message, resolvedLocationHint, resolvedLanguage);
    await persistChatMemory(identity, message, greetingResponse, {
      lastIntent: greetingResponse.intent,
      language: resolvedLanguage
    });
    return greetingResponse;
  }

  if (category === "small_talk") {
    const smallTalkResponse = buildSmallTalkResponse(message, resolvedLocationHint, resolvedLanguage);
    await persistChatMemory(identity, message, smallTalkResponse, {
      lastIntent: smallTalkResponse.intent,
      language: resolvedLanguage
    });
    return smallTalkResponse;
  }

  if (category !== "lpg") {
    console.log("[chat] query blocked as unrelated");
    const restrictedResponse = buildRestrictedResponse(message, resolvedLocationHint, resolvedLanguage);
    await persistChatMemory(identity, message, restrictedResponse, {
      lastIntent: restrictedResponse.intent,
      language: resolvedLanguage
    });
    return restrictedResponse;
  }

  try {
    const extractedQuery = await extractQueryUnderstanding(message, resolvedLocationHint, memoryContext);

    if (extractedQuery.outOfScope) {
      console.log("[chat] Gemini marked query as out of scope");
      const restrictedResponse = buildRestrictedResponse(message, resolvedLocationHint, resolvedLanguage);
      await persistChatMemory(identity, message, restrictedResponse, {
        lastIntent: restrictedResponse.intent,
        language: resolvedLanguage
      });
      return restrictedResponse;
    }

    const fallbackReason = getGeminiFallbackReason(message, extractedQuery);

    if (fallbackReason) {
      console.warn(`[chat] Falling back to rule-based parsing: ${fallbackReason}`);
      const fallbackQuery = applyMemoryContext(
        await extractLegacyQueryUnderstanding(message, resolvedLocationHint),
        memoryContext,
        message,
        resolvedLocationHint
      );
      const fallbackResponse = await buildStructuredResponse(message, resolvedLocationHint, fallbackQuery, resolvedLanguage);
      await persistChatMemory(
        identity,
        message,
        fallbackResponse,
        buildMemoryPayload(fallbackResponse, fallbackQuery, resolvedLocationHint, resolvedLanguage)
      );
      return fallbackResponse;
    }

    const memoryAwareQuery = applyMemoryContext(extractedQuery, memoryContext, message, resolvedLocationHint);
    const structuredResponse = await buildStructuredResponse(message, resolvedLocationHint, memoryAwareQuery, resolvedLanguage);
    await persistChatMemory(
      identity,
      message,
      structuredResponse,
      buildMemoryPayload(structuredResponse, memoryAwareQuery, resolvedLocationHint, resolvedLanguage)
    );
    return structuredResponse;
  } catch (error) {
    const isConfigIssue = typeof error?.message === "string" && error.message.includes("GEMINI_API_KEY");

    if (isConfigIssue) {
      console.warn("[chat] Gemini is not configured, using rule-based fallback.");
    } else {
      console.error("[chat] Gemini failed, using rule-based fallback:", error.message);
    }

    const fallbackQuery = applyMemoryContext(
      await extractLegacyQueryUnderstanding(message, resolvedLocationHint),
      memoryContext,
      message,
      resolvedLocationHint
    );
    const fallbackResponse = await buildStructuredResponse(message, resolvedLocationHint, fallbackQuery, resolvedLanguage);
    await persistChatMemory(
      identity,
      message,
      fallbackResponse,
      buildMemoryPayload(fallbackResponse, fallbackQuery, resolvedLocationHint, resolvedLanguage)
    );
    return fallbackResponse;
  }
}

module.exports = {
  processChatMessage
};
