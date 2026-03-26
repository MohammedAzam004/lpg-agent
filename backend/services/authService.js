const { createHash, randomInt } = require("crypto");
const { getOtpSessions, saveOtpSessions } = require("./dataService");
const { sendOtpEmail } = require("../utils/emailService");
const { findUserByEmail, syncFirebaseUser } = require("./userService");

const OTP_LIFETIME_MINUTES = 10;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function hashOtpCode(otpCode) {
  return createHash("sha256").update(String(otpCode)).digest("hex");
}

function getAuthProvider(firebaseUser = {}) {
  return firebaseUser.firebase?.sign_in_provider || firebaseUser.sign_in_provider || "password";
}

function requiresOtpVerification(firebaseUser = {}) {
  return getAuthProvider(firebaseUser) === "password";
}

function buildOtpSessionKey(firebaseUser = {}) {
  const authTime = firebaseUser.auth_time || firebaseUser.iat || 0;
  return `${firebaseUser.uid}:${authTime}`;
}

function createOtpCode() {
  return String(randomInt(100000, 999999));
}

function removeExpiredOtpSessions(otpSessions = []) {
  const now = Date.now();
  return otpSessions.filter((session) => new Date(session.expiresAt).getTime() > now);
}

async function readActiveOtpSessions() {
  const otpSessions = removeExpiredOtpSessions(await getOtpSessions());
  await saveOtpSessions(otpSessions);
  return otpSessions;
}

function getUserIdentity(firebaseUser = {}) {
  const email = normalizeEmail(firebaseUser.email);

  if (!email) {
    throw createHttpError("Authenticated Firebase user is missing an email address.", 400);
  }

  return {
    uid: firebaseUser.uid,
    email,
    name: firebaseUser.name || email.split("@")[0],
    authProvider: getAuthProvider(firebaseUser),
    emailVerified: Boolean(firebaseUser.email_verified)
  };
}

async function getOtpVerificationState(firebaseUser) {
  if (!requiresOtpVerification(firebaseUser)) {
    return {
      requiresOtp: false,
      otpVerified: true
    };
  }

  const otpSessions = await readActiveOtpSessions();
  const sessionKey = buildOtpSessionKey(firebaseUser);
  const session = otpSessions.find((entry) => entry.sessionKey === sessionKey);

  return {
    requiresOtp: true,
    otpVerified: Boolean(session?.verifiedAt)
  };
}

async function ensureOtpVerified(firebaseUser) {
  const { requiresOtp, otpVerified } = await getOtpVerificationState(firebaseUser);

  if (requiresOtp && !otpVerified) {
    throw createHttpError("Please verify the OTP sent to your email before continuing.", 403);
  }

  return true;
}

async function sendOtpForFirebaseUser(firebaseUser) {
  const identity = getUserIdentity(firebaseUser);
  const verificationState = await getOtpVerificationState(firebaseUser);

  if (!verificationState.requiresOtp) {
    return {
      requiresOtp: false,
      otpVerified: true,
      message: "OTP verification is not required for this sign-in method."
    };
  }

  const otpSessions = await readActiveOtpSessions();
  const sessionKey = buildOtpSessionKey(firebaseUser);
  const nextOtpCode = createOtpCode();
  const nextSession = {
    sessionKey,
    uid: identity.uid,
    email: identity.email,
    provider: identity.authProvider,
    authTime: firebaseUser.auth_time || firebaseUser.iat || null,
    otpHash: hashOtpCode(nextOtpCode),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + OTP_LIFETIME_MINUTES * 60 * 1000).toISOString(),
    verifiedAt: null
  };
  const otherSessions = otpSessions.filter((session) => session.sessionKey !== sessionKey);

  otherSessions.unshift(nextSession);
  await saveOtpSessions(otherSessions);
  await sendOtpEmail({ email: identity.email, name: identity.name }, nextOtpCode);
  console.log(`[auth-service] OTP generated for ${identity.email} (${sessionKey}).`);

  return {
    requiresOtp: true,
    otpVerified: false,
    message: "OTP sent successfully."
  };
}

async function verifyOtpForFirebaseUser(firebaseUser, otpCode) {
  if (!String(otpCode || "").trim()) {
    throw createHttpError("OTP is required.");
  }

  const identity = getUserIdentity(firebaseUser);

  if (!requiresOtpVerification(firebaseUser)) {
    return {
      requiresOtp: false,
      otpVerified: true,
      message: "OTP verification is not required for this sign-in method."
    };
  }

  const otpSessions = await readActiveOtpSessions();
  const sessionKey = buildOtpSessionKey(firebaseUser);
  const sessionIndex = otpSessions.findIndex((entry) => entry.sessionKey === sessionKey);

  if (sessionIndex === -1) {
    throw createHttpError("OTP session not found. Please request a new OTP.", 404);
  }

  const session = otpSessions[sessionIndex];

  if (session.verifiedAt) {
    return {
      requiresOtp: true,
      otpVerified: true,
      message: "OTP already verified."
    };
  }

  if (session.otpHash !== hashOtpCode(otpCode)) {
    throw createHttpError("Invalid OTP. Please try again.", 401);
  }

  otpSessions[sessionIndex] = {
    ...session,
    verifiedAt: new Date().toISOString()
  };
  await saveOtpSessions(otpSessions);
  console.log(`[auth-service] OTP verified for ${identity.email} (${sessionKey}).`);

  return {
    requiresOtp: true,
    otpVerified: true,
    message: "OTP verified successfully."
  };
}

async function syncAuthenticatedUser(firebaseUser, payload = {}) {
  const identity = getUserIdentity(firebaseUser);
  const syncResult = await syncFirebaseUser({
    firebaseUid: identity.uid,
    email: identity.email,
    name: payload.name || firebaseUser.name || null,
    phone: payload.phone || firebaseUser.phone_number || null,
    address: payload.address || null,
    preferredLanguage: payload.preferredLanguage,
    authProvider: identity.authProvider,
    emailVerified: identity.emailVerified,
    maxPrice: payload.maxPrice,
    maxDistance: payload.maxDistance,
    notificationsEnabled: payload.notificationsEnabled,
    latitude: payload.latitude,
    longitude: payload.longitude
  });
  const savedUser = syncResult.user;
  const otpState = await getOtpVerificationState(firebaseUser);

  return {
    user: savedUser,
    isNewUser: syncResult.isNewUser,
    role: savedUser?.isAdmin ? "admin" : "user",
    requiresOtp: otpState.requiresOtp,
    otpVerified: otpState.otpVerified
  };
}

async function getAuthenticatedSession(firebaseUser) {
  const identity = getUserIdentity(firebaseUser);
  const savedUser = await findUserByEmail(identity.email);
  const otpState = await getOtpVerificationState(firebaseUser);

  return {
    user: savedUser,
    role: savedUser?.isAdmin ? "admin" : "user",
    requiresOtp: otpState.requiresOtp,
    otpVerified: otpState.otpVerified
  };
}

module.exports = {
  ensureOtpVerified,
  getAuthenticatedSession,
  getAuthProvider,
  sendOtpForFirebaseUser,
  syncAuthenticatedUser,
  verifyOtpForFirebaseUser
};
