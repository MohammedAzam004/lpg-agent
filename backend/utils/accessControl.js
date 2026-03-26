const { ensureOtpVerified } = require("../services/authService");
const { DEFAULT_ADMIN_EMAIL, isAdminEmail, normalizeEmail } = require("./adminAccess");

function sendAccessError(response, message, statusCode) {
  response.status(statusCode).json({
    success: false,
    message
  });
}

async function requireAuthenticatedUser(request, response, next) {
  const requesterEmail = normalizeEmail(request.firebaseUser?.email);

  if (!request.firebaseUser || !requesterEmail) {
    sendAccessError(response, "Please login to continue.", 401);
    return;
  }

  try {
    await ensureOtpVerified(request.firebaseUser);
  } catch (error) {
    sendAccessError(response, error.message || "Please verify your login session before continuing.", error.statusCode || 403);
    return;
  }

  request.requesterEmail = requesterEmail;
  request.requesterUid = request.firebaseUser.uid;
  request.requesterName = request.firebaseUser.name || null;
  request.authProvider = request.firebaseUser.firebase?.sign_in_provider || "password";
  request.isAdmin = isAdminEmail(requesterEmail);
  next();
}

async function requireAdminAccess(request, response, next) {
  const requesterEmail = normalizeEmail(request.firebaseUser?.email);

  if (!request.firebaseUser || !requesterEmail) {
    sendAccessError(response, "Please login to continue.", 401);
    return;
  }

  try {
    await ensureOtpVerified(request.firebaseUser);
  } catch (error) {
    sendAccessError(response, error.message || "Please verify your login session before continuing.", error.statusCode || 403);
    return;
  }

  if (!isAdminEmail(requesterEmail)) {
    sendAccessError(response, "Admin access only.", 403);
    return;
  }

  request.requesterEmail = requesterEmail;
  request.requesterUid = request.firebaseUser.uid;
  request.requesterName = request.firebaseUser.name || null;
  request.authProvider = request.firebaseUser.firebase?.sign_in_provider || "password";
  request.isAdmin = true;
  next();
}

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  isAdminEmail,
  normalizeEmail,
  requireAdminAccess,
  requireAuthenticatedUser
};
