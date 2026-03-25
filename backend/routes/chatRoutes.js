const express = require("express");
const { handleChat } = require("../controllers/chatController");

const router = express.Router();

router.get("/", (request, response) => {
  response.json({
    message: "Use POST method for chat"
  });
});

router.post("/", handleChat);

module.exports = router;
