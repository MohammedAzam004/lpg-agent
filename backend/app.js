const express = require("express");
const cors = require("cors");
const storeRoutes = require("./routes/storeRoutes");
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const requestRoutes = require("./routes/requestRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());
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
