const express = require("express");
const { handleChat } = require("../controllers/chatController");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.get("/", (request, response) => {
  response.json({
    message: "Use POST method for chat"
  });
});

router.post("/", requireAuthenticatedUser, handleChat);

module.exports = router;
