const { randomUUID } = require("crypto");
const { getBookings, getStores, saveBookings } = require("./dataService");
const { findUserByEmail } = require("./userService");

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function sanitizeBooking(booking) {
  return {
    id: booking.id,
    userEmail: booking.userEmail,
    userName: booking.userName,
    storeId: booking.storeId,
    storeName: booking.storeName,
    location: booking.location,
    city: booking.city,
    state: booking.state,
    price: booking.price,
    quantity: booking.quantity,
    status: booking.status,
    requestedAt: booking.requestedAt
  };
}

async function createBookingRequest(payload = {}) {
  const userEmail = normalizeEmail(payload.userEmail || payload.email);
  const storeId = payload.storeId?.toString().trim();
  const quantity = Number(payload.quantity || 1);

  if (!isValidEmail(userEmail)) {
    throw createHttpError("A valid user email is required to request LPG.");
  }

  if (!storeId) {
    throw createHttpError("Store id is required for an LPG request.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createHttpError("Quantity must be a valid positive number.");
  }

  const [user, stores, bookings] = await Promise.all([
    findUserByEmail(userEmail),
    getStores(),
    getBookings()
  ]);

  if (!user) {
    throw createHttpError("Please register or log in before requesting LPG.", 404);
  }

  const store = stores.find((entry) => entry.id === storeId);

  if (!store) {
    throw createHttpError("Selected LPG store was not found.", 404);
  }

  const booking = {
    id: randomUUID(),
    userEmail: user.email,
    userName: user.name,
    storeId: store.id,
    storeName: store.name,
    location: store.location,
    city: store.city,
    state: store.state,
    price: store.price,
    quantity,
    status: store.availability ? "requested" : "waiting_for_stock",
    requestedAt: new Date().toISOString()
  };

  bookings.unshift(booking);
  await saveBookings(bookings);
  console.log(`[booking-service] Created LPG request ${booking.id} for ${user.email} at ${store.name}.`);
  return sanitizeBooking(booking);
}

async function getBookingHistory(email) {
  if (!isValidEmail(email)) {
    throw createHttpError("Email must be a valid format.");
  }

  const bookings = await getBookings();
  return bookings
    .filter((booking) => normalizeEmail(booking.userEmail) === normalizeEmail(email))
    .sort((leftBooking, rightBooking) => new Date(rightBooking.requestedAt) - new Date(leftBooking.requestedAt))
    .map(sanitizeBooking);
}

module.exports = {
  createBookingRequest,
  getBookingHistory
};
