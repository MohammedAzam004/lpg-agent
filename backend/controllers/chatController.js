const { processChatMessage } = require("../services/chatService");

async function handleChat(request, response, next) {
  try {
    const { message, location, language, userEmail, sessionId } = request.body;
    console.log("[chat-controller] POST /chat called");
    const chatResponse = await processChatMessage(message, location, language, {
      userEmail,
      sessionId
    });
    response.json(chatResponse || {
      success: true,
      reply: "No chat response available.",
      stores: [],
      recommendation: null,
      alternatives: []
    });
  } catch (error) {
    console.error("[chat-controller] Failed to handle /chat request:", error.message);
    next(error);
  }
}

module.exports = {
  handleChat
};
