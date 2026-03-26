const { randomUUID } = require("crypto");
const {
  getPreviousStores,
  getStoreHierarchy,
  getStores,
  saveStoreHierarchy
} = require("./dataService");

const LOW_STOCK_THRESHOLD = 5;

const fallbackAlternatives = [
  {
    id: "alt-1",
    name: "Electric Stove",
    priceRange: "Rs. 1,500 - Rs. 3,500",
    description: "Reliable for daily cooking and easy to use when LPG cylinders are temporarily unavailable."
  },
  {
    id: "alt-2",
    name: "Induction Cooktop",
    priceRange: "Rs. 2,000 - Rs. 5,000",
    description: "Fast, energy-efficient option that works well for homes with stable electricity."
  }
];

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value = "") {
  return value.toString().trim().toLowerCase();
}

function toNumber(value, fallbackValue = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function getComparableDistance(store = {}) {
  return toNumber(store.distanceFromUser ?? store.distance, Number.POSITIVE_INFINITY);
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateGeoDistanceKm(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLatitude))
    * Math.cos(toRadians(secondLatitude))
    * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function attachGeoDistances(stores, latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return stores;
  }

  return stores.map((store) => {
    if (!Number.isFinite(Number(store.latitude)) || !Number.isFinite(Number(store.longitude))) {
      return store;
    }

    return {
      ...store,
      distanceFromUser: Number(calculateGeoDistanceKm(latitude, longitude, Number(store.latitude), Number(store.longitude)).toFixed(2))
    };
  });
}

function normalizeString(value, fallbackValue = "") {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  return value.toString().trim();
}

function normalizeOptionalString(value, fallbackValue = null) {
  const normalizedValue = normalizeString(value);
  return normalizedValue || fallbackValue;
}

function normalizeAvailabilityValue(value, fallbackValue = null) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (["true", "yes", "available", "in_stock", "in stock"].includes(normalizedValue)) {
      return true;
    }

    if (["false", "no", "unavailable", "not_available", "out_of_stock", "out of stock"].includes(normalizedValue)) {
      return false;
    }
  }

  return fallbackValue;
}

function normalizeOptionalNumber(value, fallbackValue = null) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function slugifySegment(value, fallbackValue) {
  const normalizedValue = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalizedValue || fallbackValue;
}

function createBranchCode(state, city, location, index) {
  const stateCode = slugifySegment(state, "st").slice(0, 2).toUpperCase();
  const cityCode = slugifySegment(city, "cty").slice(0, 3).toUpperCase();
  const locationCode = slugifySegment(location, "loc").slice(0, 3).toUpperCase();
  const suffix = String(index).padStart(2, "0");
  return `${stateCode}-${cityCode}-${locationCode}-${suffix}`;
}

function sortByDistanceThenPrice(stores) {
  return sortStores(stores, "distance");
}

function scoreStore(store, limits) {
  const distanceScore = limits.maxDistance === 0 ? 1 : 1 - getComparableDistance(store) / limits.maxDistance;
  const priceScore = limits.maxPrice === 0 ? 1 : 1 - toNumber(store.price, limits.maxPrice) / limits.maxPrice;

  return distanceScore * 0.6 + priceScore * 0.4;
}

function getHoursSince(timestamp) {
  const parsedDate = new Date(timestamp);

  if (Number.isNaN(parsedDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return (Date.now() - parsedDate.getTime()) / (1000 * 60 * 60);
}

function getStoreStockCount(store) {
  const parsedStockCount = Number(store?.stockCount ?? 0);
  return Number.isFinite(parsedStockCount) ? parsedStockCount : 0;
}

function isStoreAvailable(store) {
  return Boolean(store?.availability) || getStoreStockCount(store) > 0;
}

function predictAvailability(store, previousStore) {
  const hoursSinceUpdate = getHoursSince(store.lastUpdated);

  if (isStoreAvailable(store)) {
    return hoursSinceUpdate <= 12
      ? "Expected to stay available for the next 12 hours"
      : "Currently available";
  }

  if (isStoreAvailable(previousStore)) {
    return "Likely available in next 12 hours";
  }

  if (hoursSinceUpdate <= 6) {
    return "Availability may improve within the next 12 hours";
  }

  if (hoursSinceUpdate <= 24) {
    return "Likely restock check within the next 24 hours";
  }

  return "No short-term availability signal";
}

function attachPredictions(stores, previousStores) {
  const previousById = new Map(previousStores.map((store) => [store.id, store]));

  return stores.map((store) => ({
    ...store,
    prediction: predictAvailability(store, previousById.get(store.id))
  }));
}

function filterStoresByAvailability(stores, availability = null) {
  if (typeof availability !== "boolean") {
    return stores;
  }

  return stores.filter((store) => isStoreAvailable(store) === availability);
}

function resolveAvailabilityForIntent(intent, explicitAvailability = null) {
  if (typeof explicitAvailability === "boolean") {
    return explicitAvailability;
  }

  if (intent === "available") {
    return true;
  }

  if (intent === "not_available") {
    return false;
  }

  return null;
}

function enforceIntentAccuracy(intent, stores, explicitAvailability = null) {
  const requiredAvailability = resolveAvailabilityForIntent(intent, explicitAvailability);

  if (requiredAvailability === null) {
    return stores;
  }

  const validatedStores = filterStoresByAvailability(stores, requiredAvailability);

  if (validatedStores.length !== stores.length) {
    console.warn(
      `[store-service] Removed ${stores.length - validatedStores.length} mismatched store(s) for intent="${intent}" availability="${requiredAvailability ? "available" : "not_available"}".`
    );
  }

  return validatedStores;
}

function matchesLocation(store, locationQuery) {
  if (!locationQuery) {
    return true;
  }

  const normalizedQuery = normalizeText(locationQuery);
  return [
    store.location,
    store.city,
    store.state,
    store.name,
    store.branchCode
  ].some((value) => normalizeText(value).includes(normalizedQuery));
}

function matchesRegion(store, filters = {}) {
  const { state, city } = filters;

  if (state && !normalizeText(store.state).includes(normalizeText(state))) {
    return false;
  }

  if (city && !normalizeText(store.city).includes(normalizeText(city))) {
    return false;
  }

  return true;
}

function filterStores(stores, filters = {}) {
  const {
    locationQuery,
    state,
    city,
    maxPrice,
    maxDistance,
    availableOnly = false,
    availability = null
  } = filters;

  const requestedAvailability = typeof availability === "boolean"
    ? availability
    : typeof availableOnly === "boolean" && availableOnly
      ? true
      : null;

  return stores.filter((store) => {
    const matchesRequestedLocation = matchesLocation(store, locationQuery);
    const matchesRequestedRegion = matchesRegion(store, { state, city });
    const withinPrice = maxPrice === null || maxPrice === undefined ? true : toNumber(store.price) <= Number(maxPrice);
    const withinDistance = maxDistance === null || maxDistance === undefined ? true : toNumber(store.distance) <= Number(maxDistance);
    const matchesAvailability = requestedAvailability === null
      ? true
      : isStoreAvailable(store) === requestedAvailability;

    return (
      matchesRequestedLocation &&
      matchesRequestedRegion &&
      withinPrice &&
      withinDistance &&
      matchesAvailability
    );
  });
}

function sortStores(stores, sortBy = "distance") {
  const normalizedSort = normalizeText(sortBy);

  if (normalizedSort === "price") {
    return [...stores].sort((leftStore, rightStore) => {
      const priceDelta = toNumber(leftStore.price) - toNumber(rightStore.price);

      if (priceDelta !== 0) {
        return priceDelta;
      }

      return toNumber(leftStore.distance) - toNumber(rightStore.distance);
    });
  }

  if (normalizedSort === "none") {
    return [...stores];
  }

  return [...stores].sort((leftStore, rightStore) => {
    const distanceDelta = getComparableDistance(leftStore) - getComparableDistance(rightStore);

    if (distanceDelta !== 0) {
      return distanceDelta;
    }

    return toNumber(leftStore.price) - toNumber(rightStore.price);
  });
}

function pickBestRecommendation(stores) {
  const availableStores = stores.filter((store) => isStoreAvailable(store));

  if (!availableStores.length) {
    return null;
  }

  const limits = availableStores.reduce(
    (accumulator, store) => ({
      maxDistance: Math.max(accumulator.maxDistance, getComparableDistance(store)),
      maxPrice: Math.max(accumulator.maxPrice, toNumber(store.price, 0))
    }),
    { maxDistance: 0, maxPrice: 0 }
  );

  return [...availableStores]
    .sort((leftStore, rightStore) => scoreStore(rightStore, limits) - scoreStore(leftStore, limits))
    [0];
}

function buildRecommendationExplanation(recommendation, stores = []) {
  if (!recommendation) {
    return null;
  }

  const comparableStores = stores.filter((store) => isStoreAvailable(store));

  if (!comparableStores.length) {
    return "This store is recommended because it is the best available option right now.";
  }

  const lowestPrice = Math.min(...comparableStores.map((store) => Number(store.price)));
  const lowestDistance = Math.min(...comparableStores.map((store) => getComparableDistance(store)));
  const isCheapest = Number(recommendation.price) === lowestPrice;
  const isClosest = getComparableDistance(recommendation) === lowestDistance;

  if (isClosest && isCheapest) {
    return "This store is recommended because it is closest and cheapest.";
  }

  if (isClosest) {
    return "This store is recommended because it is the closest available option with a competitive price.";
  }

  if (isCheapest) {
    return "This store is recommended because it offers the lowest price among available stores.";
  }

  return "This store is recommended because it offers the best balance of price and distance.";
}

function buildTrendSeries(stores) {
  const averagePrice = stores.length
    ? Number((stores.reduce((sum, store) => sum + Number(store.price || 0), 0) / stores.length).toFixed(2))
    : 0;
  const availableCount = stores.filter((store) => store.availability).length;
  const unavailableCount = stores.length - availableCount;

  return {
    averagePrice,
    availableCount,
    unavailableCount
  };
}

function cleanStoreHierarchy(storeHierarchy) {
  return storeHierarchy
    .map((stateEntry) => ({
      ...stateEntry,
      cities: (Array.isArray(stateEntry.cities) ? stateEntry.cities : [])
        .map((cityEntry) => ({
          ...cityEntry,
          stores: Array.isArray(cityEntry.stores) ? cityEntry.stores : []
        }))
        .filter((cityEntry) => cityEntry.stores.length > 0)
    }))
    .filter((stateEntry) => stateEntry.cities.length > 0);
}

function ensureHierarchyEntry(storeHierarchy, state, city) {
  let stateEntry = storeHierarchy.find((entry) => normalizeText(entry.state) === normalizeText(state));

  if (!stateEntry) {
    stateEntry = {
      state,
      cities: []
    };
    storeHierarchy.push(stateEntry);
  }

  let cityEntry = stateEntry.cities.find((entry) => normalizeText(entry.city) === normalizeText(city));

  if (!cityEntry) {
    cityEntry = {
      city,
      stores: []
    };
    stateEntry.cities.push(cityEntry);
  }

  return cityEntry;
}

function findStoreNode(storeHierarchy, storeId) {
  for (let stateIndex = 0; stateIndex < storeHierarchy.length; stateIndex += 1) {
    const stateEntry = storeHierarchy[stateIndex];
    const cities = Array.isArray(stateEntry.cities) ? stateEntry.cities : [];

    for (let cityIndex = 0; cityIndex < cities.length; cityIndex += 1) {
      const cityEntry = cities[cityIndex];
      const stores = Array.isArray(cityEntry.stores) ? cityEntry.stores : [];
      const storeIndex = stores.findIndex((store) => store.id === storeId);

      if (storeIndex >= 0) {
        return {
          stateIndex,
          cityIndex,
          storeIndex,
          stateEntry,
          cityEntry,
          store: stores[storeIndex]
        };
      }
    }
  }

  return null;
}

function validateStoreEntity(payload = {}, existingStore = null) {
  const mergedPayload = {
    ...existingStore,
    ...payload
  };
  const state = normalizeString(mergedPayload.state);
  const city = normalizeString(mergedPayload.city);
  const name = normalizeString(mergedPayload.name);
  const location = normalizeString(mergedPayload.location || city || state);
  const branchCode = normalizeOptionalString(mergedPayload.branchCode, null);
  const distance = normalizeOptionalNumber(mergedPayload.distance, existingStore ? Number(existingStore.distance) : null);
  const price = normalizeOptionalNumber(mergedPayload.price, existingStore ? Number(existingStore.price) : null);
  const parsedStockCount = normalizeOptionalNumber(
    mergedPayload.stockCount,
    existingStore ? Number(existingStore.stockCount) : null
  );
  const baseStockCount = parsedStockCount == null ? 0 : parsedStockCount;
  const availability = normalizeAvailabilityValue(
    mergedPayload.availability,
    existingStore ? Boolean(existingStore.availability) : baseStockCount > 0
  );

  if (!state) {
    throw createHttpError("State is required.");
  }

  if (!city) {
    throw createHttpError("City is required.");
  }

  if (!name) {
    throw createHttpError("Store name is required.");
  }

  if (!location) {
    throw createHttpError("Store location is required.");
  }

  if (!Number.isFinite(distance) || distance < 0) {
    throw createHttpError("Distance must be a valid non-negative number.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw createHttpError("Price must be a valid positive number.");
  }

  if (!Number.isFinite(baseStockCount) || baseStockCount < 0) {
    throw createHttpError("Stock count must be a valid non-negative number.");
  }

  const resolvedAvailability = baseStockCount === 0 ? false : Boolean(availability);

  return {
    id: existingStore?.id || normalizeOptionalString(payload.id, randomUUID()),
    branchCode,
    name,
    location,
    distance,
    price,
    availability: resolvedAvailability,
    stockCount: resolvedAvailability ? baseStockCount || 1 : 0,
    lastUpdated: new Date().toISOString(),
    state,
    city,
    latitude: normalizeOptionalNumber(mergedPayload.latitude, existingStore?.latitude ?? null),
    longitude: normalizeOptionalNumber(mergedPayload.longitude, existingStore?.longitude ?? null)
  };
}

async function searchStores(filters = {}) {
  const [stores, previousStores] = await Promise.all([getStores(), getPreviousStores()]);
  const withGeoDistances = attachGeoDistances(
    stores,
    Number.isFinite(Number(filters.latitude)) ? Number(filters.latitude) : Number.NaN,
    Number.isFinite(Number(filters.longitude)) ? Number(filters.longitude) : Number.NaN
  );
  let filteredStores = filterStores(withGeoDistances, filters);

  if (Number.isFinite(Number(filters.latitude)) && Number.isFinite(Number(filters.longitude)) && filters.maxDistance != null) {
    filteredStores = filteredStores.filter((store) => getComparableDistance(store) <= Number(filters.maxDistance));
  }

  const sortedStores = sortStores(filteredStores, filters.sortBy || "distance");
  const availabilityLabel = typeof filters.availability === "boolean"
    ? (filters.availability ? "available" : "not_available")
    : filters.availableOnly
      ? "available"
      : "any";
  console.log(
    `[store-service] searchStores filter applied: location="${filters.locationQuery || "all"}" state="${filters.state || "any"}" city="${filters.city || "any"}" availability="${availabilityLabel}" sortBy="${filters.sortBy || "distance"}" latitude="${filters.latitude || "none"}" longitude="${filters.longitude || "none"}" results=${sortedStores.length}`
  );
  return attachPredictions(sortedStores, previousStores);
}

async function searchStoresForIntent(intent, filters = {}) {
  const resolvedAvailability = resolveAvailabilityForIntent(intent, filters.availability);
  const resolvedSortBy = filters.sortBy
    || (intent === "cheapest"
      ? "price"
      : intent === "nearby"
        ? "distance"
        : "distance");

  const stores = await searchStores({
    ...filters,
    availability: resolvedAvailability,
    sortBy: resolvedSortBy
  });

  return enforceIntentAccuracy(intent, stores, resolvedAvailability);
}

async function getAllStores() {
  const [stores, previousStores] = await Promise.all([getStores(), getPreviousStores()]);
  return attachPredictions(sortStores(stores, "distance"), previousStores);
}

async function getNearbyStores(location, maxDistance, latitude = null, longitude = null) {
  return searchStores({
    locationQuery: location,
    maxDistance: maxDistance ? Number(maxDistance) : null,
    latitude,
    longitude,
    sortBy: "distance"
  });
}

async function getAvailableStores(location, latitude = null, longitude = null) {
  return searchStores({
    locationQuery: location,
    availability: true,
    availableOnly: true,
    latitude,
    longitude,
    sortBy: "distance"
  });
}

async function getUnavailableStores(location) {
  return searchStores({
    locationQuery: location,
    availability: false,
    sortBy: "distance"
  });
}

async function getBestRecommendation(location, latitude = null, longitude = null) {
  const availableStores = await getAvailableStores(location, latitude, longitude);
  return pickBestRecommendation(availableStores);
}

async function getTrendAnalytics(locationQuery = null, latitude = null, longitude = null) {
  const [currentStores, previousStores] = await Promise.all([getStores(), getPreviousStores()]);
  const currentVisibleStores = filterStores(attachGeoDistances(currentStores, latitude, longitude), { locationQuery });
  const previousVisibleStores = filterStores(attachGeoDistances(previousStores, latitude, longitude), { locationQuery });
  const previousSeries = buildTrendSeries(previousVisibleStores);
  const currentSeries = buildTrendSeries(currentVisibleStores);

  return {
    priceTrend: {
      labels: ["Previous Snapshot", "Current Snapshot"],
      datasets: [
        {
          label: "Average LPG Price",
          data: [previousSeries.averagePrice, currentSeries.averagePrice]
        }
      ]
    },
    availabilityTrend: {
      labels: ["Previous Snapshot", "Current Snapshot"],
      datasets: [
        {
          label: "Available Stores",
          data: [previousSeries.availableCount, currentSeries.availableCount]
        },
        {
          label: "Out of Stock",
          data: [previousSeries.unavailableCount, currentSeries.unavailableCount]
        }
      ]
    },
    lowStockThreshold: LOW_STOCK_THRESHOLD
  };
}

function detectAvailabilityChanges(previousStores, currentStores) {
  return detectStockRestocks(previousStores, currentStores).map((alert) => alert.store);
}

function detectStockRestocks(previousStores, currentStores) {
  const previousById = new Map(previousStores.map((store) => [store.id, store]));

  return currentStores.flatMap((store) => {
    const previousStore = previousById.get(store.id);

    if (!previousStore) {
      return [];
    }

    const previousStockCount = getStoreStockCount(previousStore);
    const currentStockCount = getStoreStockCount(store);
    const wasAvailable = isStoreAvailable(previousStore);
    const isAvailableNow = isStoreAvailable(store);
    const stockMovedFromEmpty = previousStockCount <= 0 && currentStockCount > 0;
    const availabilityRecovered = !wasAvailable && isAvailableNow;

    if (!stockMovedFromEmpty && !availabilityRecovered) {
      return [];
    }

    return [
      {
        type: "stock_available",
        store: {
          ...store,
          availability: isAvailableNow,
          stockCount: currentStockCount
        },
        previousStockCount,
        currentStockCount
      }
    ];
  });
}

function detectPriceDrops(previousStores, currentStores) {
  const previousById = new Map(previousStores.map((store) => [store.id, store]));

  return currentStores.flatMap((store) => {
    const previousStore = previousById.get(store.id);

    if (!previousStore || Number(store.price) >= Number(previousStore.price)) {
      return [];
    }

    return [
      {
        type: "price_drop",
        store,
        previousPrice: Number(previousStore.price),
        currentPrice: Number(store.price),
        dropAmount: Number(previousStore.price) - Number(store.price)
      }
    ];
  });
}

function detectLowStockAlerts(previousStores, currentStores, threshold = LOW_STOCK_THRESHOLD) {
  const previousById = new Map(previousStores.map((store) => [store.id, store]));

  return currentStores.flatMap((store) => {
    const previousStore = previousById.get(store.id);
    const currentStock = Number(store.stockCount || 0);
    const previousStock = Number(previousStore?.stockCount || 0);
    const becameLowStock = previousStore
      ? previousStock > threshold && currentStock > 0 && currentStock <= threshold
      : currentStock > 0 && currentStock <= threshold;

    if (!isStoreAvailable(store) || !becameLowStock) {
      return [];
    }

    return [
      {
        type: "low_stock",
        store,
        previousStock: previousStore ? previousStock : null,
        currentStock,
        threshold
      }
    ];
  });
}

function getFallbackAlternatives() {
  return fallbackAlternatives;
}

async function createStore(payload = {}) {
  const storeHierarchy = await getStoreHierarchy();
  const normalizedStore = validateStoreEntity(payload);
  const cityEntry = ensureHierarchyEntry(storeHierarchy, normalizedStore.state, normalizedStore.city);
  const storeIndex = cityEntry.stores.length + 1;
  const createdStore = {
    ...normalizedStore,
    branchCode: normalizedStore.branchCode || createBranchCode(
      normalizedStore.state,
      normalizedStore.city,
      normalizedStore.location,
      storeIndex
    )
  };

  cityEntry.stores.push(createdStore);
  await saveStoreHierarchy(cleanStoreHierarchy(storeHierarchy));
  console.log(`[store-service] Created store ${createdStore.name} (${createdStore.id}).`);
  return createdStore;
}

async function updateStore(storeId, payload = {}) {
  const storeHierarchy = await getStoreHierarchy();
  const storeNode = findStoreNode(storeHierarchy, storeId);

  if (!storeNode) {
    throw createHttpError("Store not found.", 404);
  }

  const normalizedStore = validateStoreEntity(payload, storeNode.store);

  storeHierarchy[storeNode.stateIndex].cities[storeNode.cityIndex].stores.splice(storeNode.storeIndex, 1);

  const targetCityEntry = ensureHierarchyEntry(storeHierarchy, normalizedStore.state, normalizedStore.city);
  const storeIndex = targetCityEntry.stores.length + 1;
  const updatedStore = {
    ...normalizedStore,
    branchCode: normalizedStore.branchCode || storeNode.store.branchCode || createBranchCode(
      normalizedStore.state,
      normalizedStore.city,
      normalizedStore.location,
      storeIndex
    )
  };

  targetCityEntry.stores.push(updatedStore);
  await saveStoreHierarchy(cleanStoreHierarchy(storeHierarchy));
  console.log(`[store-service] Updated store ${updatedStore.name} (${updatedStore.id}).`);
  return updatedStore;
}

async function deleteStore(storeId) {
  const storeHierarchy = await getStoreHierarchy();
  const storeNode = findStoreNode(storeHierarchy, storeId);

  if (!storeNode) {
    throw createHttpError("Store not found.", 404);
  }

  const [deletedStore] = storeHierarchy[storeNode.stateIndex].cities[storeNode.cityIndex].stores.splice(storeNode.storeIndex, 1);
  await saveStoreHierarchy(cleanStoreHierarchy(storeHierarchy));
  console.log(`[store-service] Deleted store ${deletedStore.name} (${deletedStore.id}).`);
  return deletedStore;
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  buildRecommendationExplanation,
  createStore,
  deleteStore,
  detectAvailabilityChanges,
  detectStockRestocks,
  detectLowStockAlerts,
  detectPriceDrops,
  enforceIntentAccuracy,
  filterStores,
  filterStoresByAvailability,
  getAllStores,
  getAvailableStores,
  getBestRecommendation,
  getFallbackAlternatives,
  getNearbyStores,
  getTrendAnalytics,
  getUnavailableStores,
  isStoreAvailable,
  pickBestRecommendation,
  searchStores,
  searchStoresForIntent,
  sortByDistanceThenPrice,
  updateStore
};
