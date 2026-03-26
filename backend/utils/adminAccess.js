const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "admin@example.com")
  .toString()
  .trim()
  .toLowerCase();

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function isAdminEmail(email = "") {
  return normalizeEmail(email) === DEFAULT_ADMIN_EMAIL;
}

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  isAdminEmail,
  normalizeEmail
};
