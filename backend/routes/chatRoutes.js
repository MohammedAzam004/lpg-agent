const express = require("express");
const { handleChat } = require("../controllers/chatController");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.get("/", (request, response) => {
  response.json({
    message: "Use POST method for chat"
  });
});

router.post("/", verifyFirebaseToken, requireAuthenticatedUser, handleChat);

module.exports = router;
