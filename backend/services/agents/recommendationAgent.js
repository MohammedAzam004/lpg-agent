const { buildRecommendationExplanation, pickBestRecommendation } = require("../storeService");

function runRecommendationAgent({ intent = "search", stores = [] } = {}) {
  if (!stores.length || intent === "not_available") {
    console.log(`[recommendation-agent] No recommendation generated for intent="${intent}"`);
    return {
      recommendation: null,
      explanation: null
    };
  }

  const recommendation = intent === "cheapest"
    ? stores[0] || null
    : pickBestRecommendation(stores);

  const explanation = recommendation
    ? buildRecommendationExplanation(recommendation, stores)
    : null;

  console.log(
    `[recommendation-agent] intent="${intent}" recommendation="${recommendation?.name || "none"}"`
  );

  return {
    recommendation,
    explanation
  };
}

module.exports = {
  runRecommendationAgent
};
