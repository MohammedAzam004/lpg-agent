const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { isAdminEmail } = require("../utils/accessControl");

const usersFilePath = path.join(__dirname, "..", "data", "users.json");

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function normalizePhone(phone = "") {
  return phone.toString().replace(/\D/g, "");
}

function normalizeAddress(address = "") {
  return address.toString().trim();
}

function normalizeLanguage(language = "en") {
  return ["en", "hi", "te"].includes(language) ? language : "en";
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isValidPhone(phone) {
  return /^\d{10}$/.test(normalizePhone(phone));
}

async function readUsers() {
  try {
    const rawContent = await fs.readFile(usersFilePath, "utf-8");
    const parsedContent = JSON.parse(rawContent);

    if (!Array.isArray(parsedContent)) {
      console.error("[user-service] Invalid users.json structure. Expected an array.");
      return [];
    }

    return parsedContent;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn("[user-service] users.json not found. Starting with an empty user list.");
      return [];
    }

    console.error("[user-service] Failed to read users.json:", error.message);
    throw createHttpError("Unable to load user data right now.", 500);
  }
}

async function writeUsers(users) {
  try {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
  } catch (error) {
    console.error("[user-service] Failed to write users.json:", error.message);
    throw createHttpError("Unable to save user data right now.", 500);
  }
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: isAdminEmail(user.email) ? "admin" : "user",
    phone: user.phone,
    address: user.address || "",
    createdAt: user.createdAt,
    maxPrice: user.maxPrice ?? null,
    maxDistance: user.maxDistance ?? null,
    notificationsEnabled: user.notificationsEnabled !== false,
    preferredLanguage: normalizeLanguage(user.preferredLanguage),
    isAdmin: isAdminEmail(user.email)
  };
}

async function getAllUsers() {
  const users = await readUsers();
  return users
    .map(sanitizeUser)
    .sort((leftUser, rightUser) => new Date(rightUser.createdAt) - new Date(leftUser.createdAt));
}

async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const users = await readUsers();
  const existingUser = users.find((user) => normalizeEmail(user.email) === normalizedEmail);
  return existingUser ? sanitizeUser(existingUser) : null;
}

async function getUserProfile(email) {
  const users = await readUsers();

  if (email) {
    if (!isValidEmail(email)) {
      throw createHttpError("Email must be a valid format.");
    }

    const normalizedEmail = normalizeEmail(email);
    const matchingUser = users.find((user) => normalizeEmail(user.email) === normalizedEmail);

    if (!matchingUser) {
      return null;
    }

    return sanitizeUser(matchingUser);
  }

  if (!users.length) {
    return null;
  }

  return sanitizeUser(users[users.length - 1]);
}

async function registerOrLoginUser(payload = {}) {
  const name = payload.name?.toString().trim() || "";
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const address = normalizeAddress(payload.address);
  const maxPrice = normalizeOptionalNumber(payload.maxPrice);
  const maxDistance = normalizeOptionalNumber(payload.maxDistance);
  const notificationsEnabled = payload.notificationsEnabled !== false;
  const preferredLanguage = payload.preferredLanguage === undefined
    ? "en"
    : normalizeLanguage(payload.preferredLanguage);

  if (!isValidEmail(email)) {
    throw createHttpError("Email must be a valid format.");
  }

  if (Number.isNaN(maxPrice)) {
    throw createHttpError("Max price must be a valid number.");
  }

  if (Number.isNaN(maxDistance)) {
    throw createHttpError("Max distance must be a valid number.");
  }

  const users = await readUsers();
  const existingUser = users.find((user) => normalizeEmail(user.email) === email);

  if (existingUser) {
    console.log(`[user-service] Existing user login for ${email}`);
    return {
      action: "login",
      user: sanitizeUser(existingUser)
    };
  }

  if (!name) {
    throw createHttpError("Name is required for new registration.");
  }

  if (!isValidPhone(phone)) {
    throw createHttpError("Phone number must be exactly 10 digits.");
  }

  const newUser = {
    id: randomUUID(),
    name,
    email,
    phone,
    address,
    createdAt: new Date().toISOString(),
    maxPrice,
    maxDistance,
    notificationsEnabled,
    preferredLanguage
  };

  users.push(newUser);
  await writeUsers(users);
  console.log(`[user-service] Registered new user ${email}`);

  return {
    action: "register",
    user: sanitizeUser(newUser)
  };
}

async function updateUserPreferences(payload = {}) {
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    throw createHttpError("Email must be a valid format.");
  }

  const maxPrice = normalizeOptionalNumber(payload.maxPrice);
  const maxDistance = normalizeOptionalNumber(payload.maxDistance);
  if (Number.isNaN(maxPrice)) {
    throw createHttpError("Max price must be a valid number.");
  }

  if (Number.isNaN(maxDistance)) {
    throw createHttpError("Max distance must be a valid number.");
  }

  const notificationsEnabled = payload.notificationsEnabled !== false;
  const users = await readUsers();
  const userIndex = users.findIndex((user) => normalizeEmail(user.email) === email);

  if (userIndex === -1) {
    throw createHttpError("User profile not found.", 404);
  }

  users[userIndex] = {
    ...users[userIndex],
    maxPrice,
    maxDistance,
    notificationsEnabled,
    preferredLanguage: payload.preferredLanguage === undefined
      ? normalizeLanguage(users[userIndex].preferredLanguage)
      : normalizeLanguage(payload.preferredLanguage)
  };

  await writeUsers(users);
  console.log(`[user-service] Updated notification settings for ${email}`);
  return sanitizeUser(users[userIndex]);
}

async function deleteUserById(userId) {
  const normalizedUserId = userId?.toString().trim();

  if (!normalizedUserId) {
    throw createHttpError("User id is required.");
  }

  const users = await readUsers();
  const userIndex = users.findIndex((user) => user.id === normalizedUserId);

  if (userIndex === -1) {
    throw createHttpError("User not found.", 404);
  }

  const [deletedUser] = users.splice(userIndex, 1);
  await writeUsers(users);
  console.log(`[user-service] Deleted user ${deletedUser.email} (${deletedUser.id}).`);
  return sanitizeUser(deletedUser);
}

function filterStoresForUserPreferences(stores, user = {}) {
  if (user.notificationsEnabled === false) {
    return [];
  }

  return stores.filter((store) => {
    const matchesPrice = user.maxPrice == null ? true : Number(store.price) <= Number(user.maxPrice);
    const matchesDistance = user.maxDistance == null ? true : Number(store.distance) <= Number(user.maxDistance);
    return matchesPrice && matchesDistance;
  });
}

module.exports = {
  deleteUserById,
  filterStoresForUserPreferences,
  findUserByEmail,
  getAllUsers,
  getUserProfile,
  registerOrLoginUser,
  updateUserPreferences
};
