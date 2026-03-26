const fs = require("fs/promises");
const path = require("path");

const storesFilePath = path.join(__dirname, "..", "data", "stores.json");
const previousStoresFilePath = path.join(__dirname, "..", "data", "previousStores.json");
const bookingsFilePath = path.join(__dirname, "..", "data", "bookings.json");
const requestsFilePath = path.join(__dirname, "..", "data", "requests.json");

function flattenStoresHierarchy(records) {
  if (!Array.isArray(records) || !records.length) {
    return [];
  }

  const isFlatStoreArray = records.every((record) => record && typeof record === "object" && record.id);

  if (isFlatStoreArray) {
    return records;
  }

  return records.flatMap((stateEntry) => {
    const state = stateEntry?.state || null;
    const cities = Array.isArray(stateEntry?.cities) ? stateEntry.cities : [];

    return cities.flatMap((cityEntry) => {
      const city = cityEntry?.city || null;
      const stores = Array.isArray(cityEntry?.stores) ? cityEntry.stores : [];

      return stores.map((store) => ({
        ...store,
        state: store.state || state,
        city: store.city || city,
        location: store.location || city || state || "Unknown"
      }));
    });
  });
}

async function readJsonFile(filePath, fallbackValue = []) {
  try {
    const rawContent = await fs.readFile(filePath, "utf-8");
    const parsedContent = JSON.parse(rawContent);

    if (!Array.isArray(parsedContent)) {
      console.error(`[data] Invalid JSON structure in ${filePath}. Expected an array.`);
      return fallbackValue;
    }

    return parsedContent;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`[data] File not found, using fallback value: ${filePath}`);
      return fallbackValue;
    }

    console.error(`[data] Failed to load JSON from ${filePath}:`, error.message);
    return fallbackValue;
  }
}

async function writeJsonFile(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function getStores() {
  const storeRecords = await readJsonFile(storesFilePath, []);
  return flattenStoresHierarchy(storeRecords);
}

async function getStoreHierarchy() {
  return readJsonFile(storesFilePath, []);
}

async function getPreviousStores() {
  const previousStoreRecords = await readJsonFile(previousStoresFilePath, []);
  return flattenStoresHierarchy(previousStoreRecords);
}

async function saveStoreHierarchy(storeHierarchy) {
  return writeJsonFile(storesFilePath, storeHierarchy);
}

async function savePreviousStores(stores) {
  return writeJsonFile(previousStoresFilePath, stores);
}

async function getBookings() {
  return readJsonFile(bookingsFilePath, []);
}

async function saveBookings(bookings) {
  return writeJsonFile(bookingsFilePath, bookings);
}

async function getRequests() {
  return readJsonFile(requestsFilePath, []);
}

async function saveRequests(requests) {
  return writeJsonFile(requestsFilePath, requests);
}

module.exports = {
  getBookings,
  getRequests,
  getStoreHierarchy,
  getStores,
  getPreviousStores,
  saveBookings,
  saveRequests,
  saveStoreHierarchy,
  savePreviousStores
};
