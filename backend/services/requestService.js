const { randomUUID } = require("crypto");
const { extractQueryUnderstanding } = require("./geminiService");
const { getPreviousStores, getRequests, getStores, saveRequests } = require("./dataService");
const {
  detectStockRestocks,
  filterStores,
  isStoreAvailable,
  pickBestRecommendation,
  sortByDistanceThenPrice
} = require("./storeService");
const { findUserByEmail, getAllUsers } = require("./userService");

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function normalizeText(value = "") {
  return value.toString().trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function sanitizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const normalizedMessage = normalizeText(message);

  return values
    .filter(Boolean)
    .sort((leftValue, rightValue) => rightValue.length - leftValue.length)
    .find((value) => normalizedMessage.includes(normalizeText(value))) || null;
}

function sortByPriceThenDistance(stores) {
  return [...stores].sort((leftStore, rightStore) => {
    const priceDelta = Number(leftStore.price) - Number(rightStore.price);

    if (priceDelta !== 0) {
      return priceDelta;
    }

    return Number(leftStore.distance) - Number(rightStore.distance);
  });
}

function sanitizeStoredRequest(request) {
  return {
    id: request.id,
    requestType: request.requestType || (request.storeId ? "store_watch" : "search"),
    userEmail: request.userEmail,
    userName: request.userName,
    query: request.query,
    createdAt: request.createdAt,
    status: request.status,
    storeId: request.storeId || null,
    storeName: request.storeName || request.matchedStoreName || null,
    storeLocation: request.storeLocation || request.locationQuery || null,
    storeCity: request.storeCity || request.city || null,
    storeState: request.storeState || request.state || null,
    storePrice: request.storePrice ?? request.matchedStorePrice ?? null,
    storeDistance: request.storeDistance ?? request.matchedStoreDistance ?? null,
    maxPrice: request.maxPrice,
    maxDistance: request.maxDistance,
    city: request.city,
    state: request.state,
    locationQuery: request.locationQuery,
    sortBy: request.sortBy,
    matchedStoreName: request.matchedStoreName || null,
    matchedStorePrice: request.matchedStorePrice ?? null,
    matchedStoreCity: request.matchedStoreCity || null,
    matchedStoreState: request.matchedStoreState || null,
    matchedStoreDistance: request.matchedStoreDistance ?? null,
    matchedAt: request.matchedAt || null
  };
}

function createRequestLabel(store) {
  return `Notify me when ${store.name} is available`;
}

async function buildFallbackQueryUnderstanding(query) {
  const stores = await getStores();
  const states = [...new Set(stores.map((store) => store.state).filter(Boolean))];
  const cities = [...new Set(stores.map((store) => store.city).filter(Boolean))];
  const localAreas = [...new Set(stores.map((store) => store.location).filter(Boolean))];
  const maxPrice = extractNumericFilter(query, [
    /(?:under|below|less than)\s*rs\.?\s*(\d+(?:\.\d+)?)/i,
    /(?:under|below|less than)\s*(\d+(?:\.\d+)?)\s*(?:rs|rupees)?/i
  ]);
  const maxDistance = extractNumericFilter(query, [
    /(?:within|under|below)\s*(\d+(?:\.\d+)?)\s*km/i,
    /(\d+(?:\.\d+)?)\s*km/i
  ]);
  const state = findMentionInText(query, states);
  const city = findMentionInText(query, cities);
  const localArea = findMentionInText(query, localAreas);
  const intent = /\bcheap|cheapest|lowest|budget\b/i.test(query) ? "cheapest" : "search";

  return {
    outOfScope: false,
    intent,
    location: {
      state,
      city
    },
    locationQuery: localArea || city || state || null,
    filters: {
      maxPrice,
      maxDistance,
      availability: true,
      sortBy: intent === "cheapest" ? "price" : "distance"
    }
  };
}

async function parseRequestQuery(query) {
  const trimmedQuery = query?.toString().trim();

  if (!trimmedQuery) {
    throw createHttpError("Request query is required.");
  }

  let extractedQuery;

  try {
    extractedQuery = await extractQueryUnderstanding(trimmedQuery, null);
  } catch (error) {
    console.warn("[request-service] Gemini parsing failed, using fallback parser:", error.message);
    extractedQuery = await buildFallbackQueryUnderstanding(trimmedQuery);
  }

  if (extractedQuery?.outOfScope) {
    throw createHttpError("Only LPG availability requests can be saved.");
  }

  return {
    query: trimmedQuery,
    intent: extractedQuery?.intent || "search",
    state: extractedQuery?.location?.state || null,
    city: extractedQuery?.location?.city || null,
    locationQuery: extractedQuery?.locationQuery || extractedQuery?.location?.city || extractedQuery?.location?.state || null,
    maxPrice: sanitizeOptionalNumber(extractedQuery?.filters?.maxPrice),
    maxDistance: sanitizeOptionalNumber(extractedQuery?.filters?.maxDistance),
    sortBy: extractedQuery?.filters?.sortBy === "price" ? "price" : "distance"
  };
}

async function createRequestAlert(payload = {}) {
  const userEmail = normalizeEmail(payload.userEmail || payload.email);
  const query = payload.query?.toString().trim();
  const requestedStoreId = payload.storeId?.toString().trim();

  if (!isValidEmail(userEmail)) {
    throw createHttpError("A valid user email is required to save an LPG request.");
  }

  if (!requestedStoreId && !query) {
    throw createHttpError("Please enter an LPG request.");
  }

  const [user, requests, stores] = await Promise.all([
    findUserByEmail(userEmail),
    getRequests(),
    getStores()
  ]);

  if (!user) {
    throw createHttpError("Please register or log in before saving a request.", 404);
  }

  if (requestedStoreId) {
    const watchedStore = stores.find((store) => store.id === requestedStoreId);

    if (!watchedStore) {
      throw createHttpError("Requested LPG store was not found.", 404);
    }

    if (isStoreAvailable(watchedStore)) {
      throw createHttpError("This LPG store is already available.");
    }

    const existingStoreRequest = requests.find((request) => (
      normalizeEmail(request.userEmail) === user.email &&
      request.storeId === requestedStoreId
    ));

    if (existingStoreRequest) {
      console.log(`[request-service] Duplicate store request prevented for ${user.email} and ${watchedStore.name}.`);
      return {
        ...sanitizeStoredRequest(existingStoreRequest),
        duplicate: true
      };
    }

    const storedRequest = {
      id: randomUUID(),
      requestType: "store_watch",
      userEmail: user.email,
      userName: user.name,
      query: createRequestLabel(watchedStore),
      status: "requested",
      storeId: watchedStore.id,
      storeName: watchedStore.name,
      storeLocation: watchedStore.location || watchedStore.city || watchedStore.state || null,
      storeCity: watchedStore.city || null,
      storeState: watchedStore.state || null,
      storePrice: watchedStore.price ?? null,
      storeDistance: watchedStore.distance ?? null,
      intent: "store_watch",
      state: watchedStore.state || null,
      city: watchedStore.city || null,
      locationQuery: watchedStore.location || watchedStore.city || watchedStore.state || null,
      maxPrice: null,
      maxDistance: null,
      sortBy: "distance",
      createdAt: new Date().toISOString(),
      matchedAt: null,
      matchedStoreId: null,
      matchedStoreName: null,
      matchedStorePrice: null,
      matchedStoreCity: null,
      matchedStoreState: null,
      matchedStoreDistance: null,
      alertSentAt: null
    };

    requests.unshift(storedRequest);
    await saveRequests(requests);
    console.log(`[request-service] Saved store availability request ${storedRequest.id} for ${user.email}.`);
    return sanitizeStoredRequest(storedRequest);
  }

  const parsedQuery = await parseRequestQuery(query);

  const storedRequest = {
    id: randomUUID(),
    requestType: "search",
    userEmail: user.email,
    userName: user.name,
    query: parsedQuery.query,
    intent: parsedQuery.intent,
    state: parsedQuery.state,
    city: parsedQuery.city,
    locationQuery: parsedQuery.locationQuery,
    maxPrice: parsedQuery.maxPrice,
    maxDistance: parsedQuery.maxDistance,
    sortBy: parsedQuery.sortBy,
    status: "waiting",
    createdAt: new Date().toISOString(),
    matchedAt: null,
    matchedStoreId: null,
    matchedStoreName: null,
    matchedStorePrice: null,
    matchedStoreCity: null,
    matchedStoreState: null,
    matchedStoreDistance: null,
    alertSentAt: null
  };

  requests.unshift(storedRequest);
  await saveRequests(requests);
  console.log(`[request-service] Saved smart LPG request ${storedRequest.id} for ${user.email}.`);
  return sanitizeStoredRequest(storedRequest);
}

async function getRequestHistory(email) {
  if (!isValidEmail(email)) {
    throw createHttpError("Email must be a valid format.");
  }

  const requests = await getRequests();

  return requests
    .filter((request) => normalizeEmail(request.userEmail) === normalizeEmail(email))
    .sort((leftRequest, rightRequest) => new Date(rightRequest.createdAt) - new Date(leftRequest.createdAt))
    .map(sanitizeStoredRequest);
}

async function getAllRequests() {
  const requests = await getRequests();

  return requests
    .slice()
    .sort((leftRequest, rightRequest) => new Date(rightRequest.createdAt) - new Date(leftRequest.createdAt))
    .map(sanitizeStoredRequest);
}

async function deleteRequestAlert(requestId, email) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRequestId = requestId?.toString().trim();

  if (!normalizedRequestId) {
    throw createHttpError("Request id is required.");
  }

  if (!isValidEmail(normalizedEmail)) {
    throw createHttpError("Email must be a valid format.");
  }

  const requests = await getRequests();
  const requestIndex = requests.findIndex((request) => (
    request.id === normalizedRequestId && normalizeEmail(request.userEmail) === normalizedEmail
  ));

  if (requestIndex === -1) {
    throw createHttpError("LPG request not found.", 404);
  }

  const [deletedRequest] = requests.splice(requestIndex, 1);
  await saveRequests(requests);
  console.log(`[request-service] Removed smart LPG request ${deletedRequest.id} for ${normalizedEmail}.`);
  return sanitizeStoredRequest(deletedRequest);
}

async function deleteRequestById(requestId) {
  const normalizedRequestId = requestId?.toString().trim();

  if (!normalizedRequestId) {
    throw createHttpError("Request id is required.");
  }

  const requests = await getRequests();
  const requestIndex = requests.findIndex((request) => request.id === normalizedRequestId);

  if (requestIndex === -1) {
    throw createHttpError("LPG request not found.", 404);
  }

  const [deletedRequest] = requests.splice(requestIndex, 1);
  await saveRequests(requests);
  console.log(`[request-service] Admin removed LPG request ${deletedRequest.id}.`);
  return sanitizeStoredRequest(deletedRequest);
}

function getMatchingStoreForRequest(storedRequest, stores) {
  const filteredStores = filterStores(stores, {
    locationQuery: storedRequest.locationQuery,
    state: storedRequest.state,
    city: storedRequest.city,
    maxPrice: storedRequest.maxPrice,
    maxDistance: storedRequest.maxDistance,
    availability: true,
    sortBy: storedRequest.sortBy
  }).filter((store) => isStoreAvailable(store));

  if (!filteredStores.length) {
    return null;
  }

  const sortedStores = storedRequest.sortBy === "price"
    ? sortByPriceThenDistance(filteredStores)
    : sortByDistanceThenPrice(filteredStores);

  return sortedStores[0] || pickBestRecommendation(sortedStores) || null;
}

function applyMatchedStoreDetails(request, matchedStore) {
  request.status = "matched";
  request.matchedAt = new Date().toISOString();
  request.matchedStoreId = matchedStore.id;
  request.matchedStoreName = matchedStore.name;
  request.matchedStorePrice = matchedStore.price ?? null;
  request.matchedStoreCity = matchedStore.city || null;
  request.matchedStoreState = matchedStore.state || null;
  request.matchedStoreDistance = matchedStore.distance ?? null;
  request.alertSentAt = request.matchedAt;
}

async function processPendingRequests(previousStoresInput = null, currentStoresInput = null) {
  const [requests, users] = await Promise.all([getRequests(), getAllUsers()]);
  const [previousStores, stores] = previousStoresInput !== null && currentStoresInput !== null
    ? [previousStoresInput, currentStoresInput]
    : await Promise.all([getPreviousStores(), getStores()]);
  const waitingRequests = requests.filter((request) => request.status !== "matched" && !request.alertSentAt);

  if (!waitingRequests.length) {
    console.log("[request-service] No pending LPG requests to evaluate.");
    return [];
  }

  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
  const restockedStoresById = new Map(
    detectStockRestocks(previousStores, stores).map((alert) => [alert.store.id, alert.store])
  );
  const matches = [];
  let hasUpdates = false;

  for (const request of waitingRequests) {
    const user = usersByEmail.get(normalizeEmail(request.userEmail));

    if (!user) {
      console.warn(`[request-service] Skipping request ${request.id} because user ${request.userEmail} was not found.`);
      continue;
    }

    const matchedStore = request.storeId
      ? restockedStoresById.get(request.storeId) || null
      : getMatchingStoreForRequest(request, stores);

    if (!matchedStore) {
      continue;
    }

    applyMatchedStoreDetails(request, matchedStore);
    hasUpdates = true;

    matches.push({
      request: sanitizeStoredRequest(request),
      user,
      store: matchedStore
    });
  }

  if (hasUpdates) {
    await saveRequests(requests);
    console.log(`[request-service] Marked ${matches.length} request(s) as matched.`);
  } else {
    console.log("[request-service] No LPG requests matched the current store data.");
  }

  return matches;
}

module.exports = {
  createRequestAlert,
  deleteRequestById,
  deleteRequestAlert,
  getAllRequests,
  getRequestHistory,
  parseRequestQuery,
  processPendingRequests
};
