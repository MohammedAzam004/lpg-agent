const { getAdminInsights } = require("./adminInsightsAgent");
const { runNotificationAgent, runImmediateRequestNotificationAgent } = require("./notificationAgent");
const { runRecommendationAgent } = require("./recommendationAgent");
const { runSearchAgent } = require("./searchAgent");

async function runChatAgents({ intent, searchFilters }) {
  const searchResult = await runSearchAgent({
    intent,
    filters: searchFilters,
    limit: 5
  });
  const recommendationResult = runRecommendationAgent({
    intent,
    stores: searchResult.stores
  });

  return {
    ...searchResult,
    ...recommendationResult
  };
}

module.exports = {
  getAdminInsights,
  runChatAgents,
  runImmediateRequestNotificationAgent,
  runNotificationAgent
};
