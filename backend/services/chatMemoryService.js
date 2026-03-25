const fs = require("fs/promises");
const path = require("path");

const chatMemoryFilePath = path.join(__dirname, "..", "data", "chatMemory.json");
const MAX_TURNS = 10;

function normalizeEmail(email = "") {
  if (email === null || email === undefined) {
    return "";
  }

  return email.toString().trim().toLowerCase();
}

function normalizeString(value, fallbackValue = null) {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  const normalizedValue = value.toString().trim();
  return normalizedValue || fallbackValue;
}

function normalizeOptionalNumber(value, fallbackValue = null) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function buildIdentity({ userEmail, sessionId } = {}) {
  const normalizedEmail = normalizeEmail(userEmail);
  const normalizedSessionId = normalizeString(sessionId, null);

  if (normalizedEmail) {
    return {
      key: `user:${normalizedEmail}`,
      userEmail: normalizedEmail,
      sessionId: normalizedSessionId
    };
  }

  if (normalizedSessionId) {
    return {
      key: `session:${normalizedSessionId}`,
      userEmail: null,
      sessionId: normalizedSessionId
    };
  }

  return null;
}

async function readMemoryRecords() {
  try {
    const rawContent = await fs.readFile(chatMemoryFilePath, "utf-8");
    const parsedContent = JSON.parse(rawContent);

    if (!Array.isArray(parsedContent)) {
      console.error("[chat-memory] Invalid chatMemory.json structure. Expected an array.");
      return [];
    }

    return parsedContent;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn("[chat-memory] chatMemory.json not found. Starting with empty memory.");
      return [];
    }

    console.error("[chat-memory] Failed to read chat memory:", error.message);
    return [];
  }
}

async function writeMemoryRecords(records) {
  try {
    await fs.writeFile(chatMemoryFilePath, JSON.stringify(records, null, 2), "utf-8");
  } catch (error) {
    console.error("[chat-memory] Failed to write chat memory:", error.message);
  }
}

function sanitizeMemoryRecord(record) {
  if (!record) {
    return null;
  }

  return {
    key: record.key,
    userEmail: normalizeEmail(record.userEmail),
    sessionId: normalizeString(record.sessionId, null),
    lastUpdated: record.lastUpdated || null,
    context: {
      lastIntent: normalizeString(record.context?.lastIntent, "general"),
      state: normalizeString(record.context?.state, null),
      city: normalizeString(record.context?.city, null),
      locationQuery: normalizeString(record.context?.locationQuery, null),
      maxPrice: normalizeOptionalNumber(record.context?.maxPrice, null),
      maxDistance: normalizeOptionalNumber(record.context?.maxDistance, null),
      language: normalizeString(record.context?.language, "en")
    },
    messages: Array.isArray(record.messages) ? record.messages.slice(-MAX_TURNS) : []
  };
}

async function getConversationMemory(identityInput = {}) {
  const identity = buildIdentity(identityInput);

  if (!identity) {
    return null;
  }

  const records = await readMemoryRecords();
  const matchingRecord = records.find((record) => record.key === identity.key);

  if (!matchingRecord) {
    return null;
  }

  return sanitizeMemoryRecord(matchingRecord);
}

function buildMessageEntry(role, text, metadata = {}) {
  return {
    role,
    text: normalizeString(text, ""),
    createdAt: new Date().toISOString(),
    intent: normalizeString(metadata.intent || metadata.lastIntent, null),
    city: normalizeString(metadata.city, null),
    state: normalizeString(metadata.state, null),
    maxPrice: normalizeOptionalNumber(metadata.maxPrice, null),
    maxDistance: normalizeOptionalNumber(metadata.maxDistance, null)
  };
}

function mergeContext(previousContext = {}, nextContext = {}) {
  return {
    lastIntent: normalizeString(nextContext.lastIntent, previousContext.lastIntent || "general"),
    state: normalizeString(nextContext.state, previousContext.state || null),
    city: normalizeString(nextContext.city, previousContext.city || null),
    locationQuery: normalizeString(nextContext.locationQuery, previousContext.locationQuery || null),
    maxPrice: nextContext.maxPrice === null
      ? null
      : normalizeOptionalNumber(nextContext.maxPrice, previousContext.maxPrice ?? null),
    maxDistance: nextContext.maxDistance === null
      ? null
      : normalizeOptionalNumber(nextContext.maxDistance, previousContext.maxDistance ?? null),
    language: normalizeString(nextContext.language, previousContext.language || "en")
  };
}

async function saveConversationTurn(identityInput = {}, payload = {}) {
  const identity = buildIdentity(identityInput);

  if (!identity) {
    return null;
  }

  const records = await readMemoryRecords();
  const recordIndex = records.findIndex((record) => record.key === identity.key);
  const existingRecord = recordIndex >= 0 ? sanitizeMemoryRecord(records[recordIndex]) : null;
  const nextContext = mergeContext(existingRecord?.context || {}, payload.context || {});
  const nextMessages = [
    ...(existingRecord?.messages || []),
    buildMessageEntry("user", payload.userMessage, payload.context || {}),
    buildMessageEntry("assistant", payload.botReply, payload.context || {})
  ].slice(-MAX_TURNS);

  const nextRecord = {
    key: identity.key,
    userEmail: identity.userEmail,
    sessionId: identity.sessionId,
    lastUpdated: new Date().toISOString(),
    context: nextContext,
    messages: nextMessages
  };

  if (recordIndex >= 0) {
    records[recordIndex] = nextRecord;
  } else {
    records.push(nextRecord);
  }

  await writeMemoryRecords(records);
  console.log(`[chat-memory] Saved memory for ${identity.key}`);
  return sanitizeMemoryRecord(nextRecord);
}

module.exports = {
  getConversationMemory,
  saveConversationTurn
};
