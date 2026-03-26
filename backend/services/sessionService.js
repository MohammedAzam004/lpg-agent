const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const sessionFilePath = path.join(__dirname, "..", "data", "authSessions.json");
const SESSION_TTL_IN_DAYS = 30;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function normalizeToken(token = "") {
  return token.toString().trim();
}

function getExpiryDate() {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + SESSION_TTL_IN_DAYS);
  return nextDate.toISOString();
}

function isSessionExpired(session) {
  if (!session?.expiresAt) {
    return true;
  }

  const expiresAt = new Date(session.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

async function readSessions() {
  try {
    const rawContent = await fs.readFile(sessionFilePath, "utf-8");
    const parsedContent = JSON.parse(rawContent);

    if (!Array.isArray(parsedContent)) {
      console.error("[session-service] Invalid authSessions.json structure. Expected an array.");
      return [];
    }

    return parsedContent;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    console.error("[session-service] Failed to read authSessions.json:", error.message);
    throw createHttpError("Unable to validate the current session.", 500);
  }
}

async function writeSessions(sessions) {
  try {
    await fs.writeFile(sessionFilePath, JSON.stringify(sessions, null, 2), "utf-8");
  } catch (error) {
    console.error("[session-service] Failed to write authSessions.json:", error.message);
    throw createHttpError("Unable to update the current session.", 500);
  }
}

async function purgeExpiredSessions() {
  const sessions = await readSessions();
  const activeSessions = sessions.filter((session) => !isSessionExpired(session));

  if (activeSessions.length !== sessions.length) {
    await writeSessions(activeSessions);
  }

  return activeSessions;
}

async function createSession(userEmail) {
  const normalizedEmail = normalizeEmail(userEmail);

  if (!normalizedEmail) {
    throw createHttpError("User email is required to create a session.");
  }

  const activeSessions = await purgeExpiredSessions();
  const nextSession = {
    id: randomUUID(),
    token: randomUUID(),
    userEmail: normalizedEmail,
    createdAt: new Date().toISOString(),
    expiresAt: getExpiryDate()
  };

  const sessionsForOtherUsers = activeSessions.filter((session) => normalizeEmail(session.userEmail) !== normalizedEmail);
  sessionsForOtherUsers.push(nextSession);
  await writeSessions(sessionsForOtherUsers);

  return nextSession;
}

async function getSessionByToken(token) {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    return null;
  }

  const activeSessions = await purgeExpiredSessions();
  const matchingSession = activeSessions.find((session) => normalizeToken(session.token) === normalizedToken);
  return matchingSession || null;
}

async function revokeSession(token) {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    return false;
  }

  const sessions = await readSessions();
  const nextSessions = sessions.filter((session) => normalizeToken(session.token) !== normalizedToken);

  if (nextSessions.length === sessions.length) {
    return false;
  }

  await writeSessions(nextSessions);
  return true;
}

module.exports = {
  createSession,
  getSessionByToken,
  revokeSession
};
