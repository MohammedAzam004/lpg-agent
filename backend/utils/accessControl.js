const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "admin@example.com";

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function isAdminEmail(email = "") {
  return normalizeEmail(email) === normalizeEmail(DEFAULT_ADMIN_EMAIL);
}

function extractRequesterEmail(request) {
  return normalizeEmail(
    request.headers["x-user-email"]
      || request.body?.userEmail
      || request.body?.email
      || request.query?.email
  );
}

function sendAccessError(response, message, statusCode) {
  response.status(statusCode).json({
    success: false,
    message
  });
}

function requireAuthenticatedUser(request, response, next) {
  const requesterEmail = extractRequesterEmail(request);

  if (!requesterEmail) {
    sendAccessError(response, "Please login to continue.", 401);
    return;
  }

  request.requesterEmail = requesterEmail;
  request.isAdmin = isAdminEmail(requesterEmail);
  next();
}

function requireAdminAccess(request, response, next) {
  const requesterEmail = extractRequesterEmail(request);

  if (!requesterEmail) {
    sendAccessError(response, "Please login to continue.", 401);
    return;
  }

  if (!isAdminEmail(requesterEmail)) {
    sendAccessError(response, "Admin access only.", 403);
    return;
  }

  request.requesterEmail = requesterEmail;
  request.isAdmin = true;
  next();
}

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  extractRequesterEmail,
  isAdminEmail,
  normalizeEmail,
  requireAdminAccess,
  requireAuthenticatedUser
};
