const express = require("express");
const cors = require("cors");
const storeRoutes = require("./routes/storeRoutes");
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const requestRoutes = require("./routes/requestRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

const normalizeOrigin = (value) => value?.replace(/\/+$/, "");

function isAllowedOrigin(origin) {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return true;
  }

  const explicitOrigins = [
    normalizeOrigin(process.env.FRONTEND_URL),
    "https://lpg-agent.vercel.app"
  ].filter(Boolean);

  if (explicitOrigins.includes(normalizedOrigin)) {
    return true;
  }

  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin)) {
    return true;
  }

  if (/^http:\/\/localhost(?::\d+)?$/i.test(normalizedOrigin)) {
    return true;
  }

  if (/^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`[cors] Blocked origin: ${origin}`);
    callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json());

app.get("/", (request, response) => {
  response.send("Server is working");
});

app.get("/health", (request, response) => {
  response.json({ status: "ok" });
});

app.use("/stores", storeRoutes);
app.use("/chat", chatRoutes);
app.use("/user", userRoutes);
app.use("/bookings", bookingRoutes);
app.use("/request", requestRoutes);
app.use("/admin", adminRoutes);

app.use((request, response) => {
  console.warn(`[404] ${request.method} ${request.originalUrl} was not found`);
  response.status(404).json({
    success: false,
    message: "Route not found."
  });
});

app.use((error, request, response, next) => {
  console.error(`[error] ${request.method} ${request.originalUrl}`, error);
  const isInvalidJson = error instanceof SyntaxError && error.status === 400 && "body" in error;
  const statusCode = isInvalidJson ? 400 : error.statusCode || 500;
  const message = isInvalidJson
    ? "Invalid JSON body. Please check the request payload."
    : error.message || "Something went wrong while processing the request.";

  response.status(statusCode).json({
    success: false,
    message
  });
});

module.exports = app;
