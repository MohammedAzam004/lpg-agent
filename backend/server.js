const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = require("./app");
const { startAvailabilityScheduler } = require("./services/schedulerService");

const port = Number(process.env.PORT) || 5001;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[startup] Port ${port} is already in use. Stop the conflicting process and restart the backend.`);
  } else {
    console.error("[startup] Failed to start backend server:", error);
  }

  process.exit(1);
});

startAvailabilityScheduler();

process.on("unhandledRejection", (error) => {
  console.error("[process] Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("[process] Uncaught exception:", error);
  process.exit(1);
});
