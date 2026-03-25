const { searchStoresForIntent } = require("../storeService");

async function runSearchAgent({ intent = "search", filters = {}, limit = 5 } = {}) {
  console.log(
    `[search-agent] Searching stores for intent="${intent}" location="${filters.locationQuery || filters.city || filters.state || "all"}"`
  );

  const stores = await searchStoresForIntent(intent, filters);

  return {
    intent,
    filters,
    totalMatches: stores.length,
    stores,
    visibleStores: stores.slice(0, limit)
  };
}

module.exports = {
  runSearchAgent
};
