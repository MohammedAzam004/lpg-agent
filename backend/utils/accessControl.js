const { getSessionByToken } = require("../services/sessionService");

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "admin@example.com";

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function isAdminEmail(email = "") {
  return normalizeEmail(email) === normalizeEmail(DEFAULT_ADMIN_EMAIL);
}

function extractSessionToken(request) {
  const authorizationHeader = request.headers.authorization || "";

  if (/^bearer\s+/i.test(authorizationHeader)) {
    return authorizationHeader.replace(/^bearer\s+/i, "").trim();
  }

  return (request.headers["x-session-token"] || "").toString().trim();
}

function sendAccessError(response, message, statusCode) {
  response.status(statusCode).json({
    success: false,
    message
  });
}

async function requireAuthenticatedUser(request, response, next) {
  try {
    const sessionToken = extractSessionToken(request);

    if (!sessionToken) {
      sendAccessError(response, "Please login to continue.", 401);
      return;
    }

    const session = await getSessionByToken(sessionToken);

    if (!session?.userEmail) {
      sendAccessError(response, "Your session has expired. Please login again.", 401);
      return;
    }

    request.sessionToken = sessionToken;
    request.requesterEmail = normalizeEmail(session.userEmail);
    request.isAdmin = isAdminEmail(session.userEmail);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAdminAccess(request, response, next) {
  try {
    const sessionToken = extractSessionToken(request);

    if (!sessionToken) {
      sendAccessError(response, "Please login to continue.", 401);
      return;
    }

    const session = await getSessionByToken(sessionToken);

    if (!session?.userEmail) {
      sendAccessError(response, "Your session has expired. Please login again.", 401);
      return;
    }

    if (!isAdminEmail(session.userEmail)) {
      sendAccessError(response, "Admin access only.", 403);
      return;
    }

    request.sessionToken = sessionToken;
    request.requesterEmail = normalizeEmail(session.userEmail);
    request.isAdmin = true;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  extractSessionToken,
  isAdminEmail,
  normalizeEmail,
  requireAdminAccess,
  requireAuthenticatedUser
};
