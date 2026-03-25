const fs = require("fs/promises");
const path = require("path");
const { createHash, randomUUID } = require("crypto");
const pdfParse = require("pdf-parse");
const { savePreviousStores, saveStoreHierarchy } = require("./dataService");

const DEFAULT_DATA_PDF_PATH = path.join(__dirname, "..", "..", "Data.pdf");
const DEFAULT_COORDINATES = [20.5937, 78.9629];
const CITY_COORDINATES = {
  mumbai: [19.076, 72.8777],
  pune: [18.5204, 73.8567],
  nagpur: [21.1458, 79.0882],
  hyderabad: [17.385, 78.4867],
  warangal: [17.9689, 79.5941],
  bengaluru: [12.9716, 77.5946],
  mysuru: [12.2958, 76.6394],
  ahmedabad: [23.0225, 72.5714],
  surat: [21.1702, 72.8311],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558]
};
const STATE_COORDINATES = {
  maharashtra: [19.7515, 75.7139],
  telangana: [18.1124, 79.0193],
  karnataka: [15.3173, 75.7139],
  gujarat: [22.2587, 71.1924],
  tamilnadu: [11.1271, 78.6569]
};

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value = "") {
  return value.toString().trim();
}

function normalizeLower(value = "") {
  return normalizeText(value).toLowerCase();
}

function normalizeNumber(value) {
  const numericValue = Number(
    value
      ?.toString()
      .replace(/[^\d.]/g, "")
  );

  return Number.isFinite(numericValue) ? numericValue : null;
}

function slugifySegment(value, fallbackValue) {
  const normalizedValue = normalizeLower(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalizedValue || fallbackValue;
}

function createBranchCode(state, city, location, index) {
  const stateCode = slugifySegment(state, "st").slice(0, 2).toUpperCase();
  const cityCode = slugifySegment(city, "cty").slice(0, 3).toUpperCase();
  const locationCode = slugifySegment(location, "loc").slice(0, 3).toUpperCase();
  return `${stateCode}-${cityCode}-${locationCode}-${String(index).padStart(2, "0")}`;
}

function hashToNumber(value) {
  const hash = createHash("sha1").update(value).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function resolveBaseCoordinates(city, state) {
  return CITY_COORDINATES[normalizeLower(city)]
    || STATE_COORDINATES[normalizeLower(state)]
    || DEFAULT_COORDINATES;
}

function createApproximateCoordinates(city, state, name, index) {
  const [baseLatitude, baseLongitude] = resolveBaseCoordinates(city, state);
  const seed = hashToNumber(`${state}|${city}|${name}|${index}`);
  const latitudeOffset = ((seed % 1800) / 10000) - 0.09;
  const longitudeOffset = (((Math.floor(seed / 1800)) % 1800) / 10000) - 0.09;

  return {
    latitude: Number((baseLatitude + latitudeOffset).toFixed(4)),
    longitude: Number((baseLongitude + longitudeOffset).toFixed(4))
  };
}

function createApproximateDistance(city, state, name, index) {
  const seed = hashToNumber(`distance|${state}|${city}|${name}|${index}`);
  return Number((1 + (seed % 90) / 10).toFixed(1));
}

function splitTextIntoBlocks(text) {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseLabeledBlock(block) {
  const normalizedBlock = block.replace(/\s*\r?\n\s*/g, " ").trim();

  const fieldDefinitions = [
    { key: "name", aliases: ["store name", "store", "name"] },
    { key: "location", aliases: ["location", "area", "branch location"] },
    { key: "city", aliases: ["city"] },
    { key: "state", aliases: ["state"] },
    { key: "price", aliases: ["price", "rate", "amount"] },
    { key: "stockCount", aliases: ["stock count", "stock", "quantity"] },
    { key: "availability", aliases: ["availability", "status"] }
  ];

  const parsedRecord = {};

  for (let index = 0; index < fieldDefinitions.length; index += 1) {
    const currentField = fieldDefinitions[index];
    const nextAliases = fieldDefinitions
      .slice(index + 1)
      .flatMap((field) => field.aliases)
      .join("|");

    const aliasPattern = currentField.aliases.join("|");
    const lookaheadPattern = nextAliases ? `(?=\\s+(?:${nextAliases})\\s*[:\\-]|$)` : "$";
    const match = normalizedBlock.match(new RegExp(`(?:${aliasPattern})\\s*[:\\-]\\s*(.+?)${lookaheadPattern}`, "i"));

    if (match?.[1]) {
      parsedRecord[currentField.key] = normalizeText(match[1]);
    }
  }

  if (!parsedRecord.name || !parsedRecord.city || !parsedRecord.state || !parsedRecord.price || !parsedRecord.stockCount) {
    return null;
  }

  return parsedRecord;
}

function parseTabularLine(line) {
  const trimmedLine = normalizeText(line);

  if (!trimmedLine || /store\s+name|stock\s+count|availability/i.test(trimmedLine)) {
    return null;
  }

  const patterns = [
    /^(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*([\d.,]+)\s*\|\s*(\d+)(?:\s*\|\s*(available|not available|out of stock))?$/i,
    /^(.*?),\s*(.*?),\s*(.*?),\s*(.*?),\s*([\d.,]+)\s*,\s*(\d+)(?:\s*,\s*(available|not available|out of stock))?$/i,
    /^(.*?)\s{2,}(.*?)\s{2,}(.*?)\s{2,}(.*?)\s{2,}([\d.,]+)\s{2,}(\d+)(?:\s{2,}(available|not available|out of stock))?$/i
  ];

  for (const pattern of patterns) {
    const match = trimmedLine.match(pattern);

    if (match) {
      return {
        name: normalizeText(match[1]),
        location: normalizeText(match[2]),
        city: normalizeText(match[3]),
        state: normalizeText(match[4]),
        price: normalizeText(match[5]),
        stockCount: normalizeText(match[6]),
        availability: normalizeText(match[7] || "")
      };
    }
  }

  return null;
}

function normalizeImportedRecord(record, indexByCity) {
  const stockCount = normalizeNumber(record.stockCount);
  const price = normalizeNumber(record.price);

  if (!record.name || !record.city || !record.state || !Number.isFinite(price) || !Number.isFinite(stockCount)) {
    return null;
  }

  const location = record.location || record.city;
  const availability = stockCount > 0;
  const cityKey = `${normalizeLower(record.state)}|${normalizeLower(record.city)}`;
  const itemIndex = (indexByCity.get(cityKey) || 0) + 1;
  indexByCity.set(cityKey, itemIndex);

  const coordinates = createApproximateCoordinates(record.city, record.state, record.name, itemIndex);

  return {
    id: randomUUID(),
    branchCode: createBranchCode(record.state, record.city, location, itemIndex),
    name: normalizeText(record.name),
    location: normalizeText(location),
    city: normalizeText(record.city),
    state: normalizeText(record.state),
    price,
    stockCount,
    availability,
    distance: createApproximateDistance(record.city, record.state, record.name, itemIndex),
    lastUpdated: new Date().toISOString(),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
}

function dedupeImportedRecords(records = []) {
  const seen = new Set();

  return records.filter((record) => {
    const key = [
      normalizeLower(record.name),
      normalizeLower(record.location),
      normalizeLower(record.city),
      normalizeLower(record.state)
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parsePdfStoreText(text) {
  const blocks = splitTextIntoBlocks(text);
  const blockRecords = blocks
    .map(parseLabeledBlock)
    .filter(Boolean);

  if (blockRecords.length) {
    return blockRecords;
  }

  return text
    .split(/\r?\n/)
    .map(parseTabularLine)
    .filter(Boolean);
}

function buildHierarchyFromImportedStores(stores) {
  const hierarchyMap = new Map();

  for (const store of stores) {
    const stateKey = normalizeText(store.state);
    const cityKey = normalizeText(store.city);

    if (!hierarchyMap.has(stateKey)) {
      hierarchyMap.set(stateKey, new Map());
    }

    const cities = hierarchyMap.get(stateKey);

    if (!cities.has(cityKey)) {
      cities.set(cityKey, []);
    }

    cities.get(cityKey).push({
      id: store.id,
      branchCode: store.branchCode,
      name: store.name,
      location: store.location,
      distance: store.distance,
      price: store.price,
      availability: store.availability,
      stockCount: store.stockCount,
      lastUpdated: store.lastUpdated,
      latitude: store.latitude,
      longitude: store.longitude
    });
  }

  return [...hierarchyMap.entries()].map(([state, cities]) => ({
    state,
    cities: [...cities.entries()].map(([city, cityStores]) => ({
      city,
      stores: cityStores
    }))
  }));
}

async function resolvePdfBuffer(uploadedFile) {
  if (uploadedFile?.buffer?.length) {
    return {
      buffer: uploadedFile.buffer,
      sourceName: uploadedFile.originalname || "uploaded.pdf"
    };
  }

  try {
    const buffer = await fs.readFile(DEFAULT_DATA_PDF_PATH);
    return {
      buffer,
      sourceName: path.basename(DEFAULT_DATA_PDF_PATH)
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createHttpError("Please upload a PDF file named Data.pdf or provide a PDF through the admin panel.", 400);
    }

    throw error;
  }
}

async function importStoresFromPdf(uploadedFile) {
  const { buffer, sourceName } = await resolvePdfBuffer(uploadedFile);

  try {
    const parsedPdf = await pdfParse(buffer);
    const rawRecords = parsePdfStoreText(parsedPdf.text || "");

    if (!rawRecords.length) {
      throw createHttpError("No LPG store records could be extracted from the PDF.", 400);
    }

    const indexByCity = new Map();
    const importedStores = dedupeImportedRecords(
      rawRecords
        .map((record) => normalizeImportedRecord(record, indexByCity))
        .filter(Boolean)
    );

    if (!importedStores.length) {
      throw createHttpError("The PDF was parsed, but none of the rows contained complete LPG store details.", 400);
    }

    const hierarchy = buildHierarchyFromImportedStores(importedStores);
    await saveStoreHierarchy(hierarchy);
    await savePreviousStores(importedStores);

    const states = new Set(importedStores.map((store) => store.state));
    const cities = new Set(importedStores.map((store) => `${store.state}|${store.city}`));

    console.log(`[pdf-import] Imported ${importedStores.length} LPG stores from ${sourceName}.`);

    return {
      sourceName,
      importedCount: importedStores.length,
      stateCount: states.size,
      cityCount: cities.size,
      stores: importedStores
    };
  } catch (error) {
    console.error("[pdf-import] Failed to import LPG data from PDF:", error.message);

    if (error.statusCode) {
      throw error;
    }

    throw createHttpError("Unable to parse the PDF. Existing LPG data was kept unchanged.", 400);
  }
}

module.exports = {
  importStoresFromPdf
};
