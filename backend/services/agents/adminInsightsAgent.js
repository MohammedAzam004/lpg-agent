const { getAllRequests } = require("../requestService");
const { getAllStores, isStoreAvailable, LOW_STOCK_THRESHOLD, pickBestRecommendation } = require("../storeService");
const { getAllUsers } = require("../userService");

function getTopEntry(counterMap) {
  return [...counterMap.entries()]
    .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])[0] || null;
}

function countBy(items, selector) {
  return items.reduce((counter, item) => {
    const key = selector(item);

    if (!key) {
      return counter;
    }

    counter.set(key, (counter.get(key) || 0) + 1);
    return counter;
  }, new Map());
}

async function getAdminInsights() {
  const [users, requests, stores] = await Promise.all([
    getAllUsers(),
    getAllRequests(),
    getAllStores()
  ]);

  const availableStores = stores.filter((store) => isStoreAvailable(store));
  const lowStockStores = availableStores.filter((store) => Number(store.stockCount || 0) <= LOW_STOCK_THRESHOLD);
  const alertUsers = users.filter((user) => user.notificationsEnabled !== false);
  const pendingRequests = requests.filter((request) => request.status !== "matched");
  const matchedRequests = requests.filter((request) => request.status === "matched");
  const topRequestedStoreEntry = getTopEntry(countBy(requests, (request) => request.storeName || request.matchedStoreName || request.query));
  const topCityEntry = getTopEntry(countBy(requests, (request) => request.storeCity || request.city));
  const bestRecommendation = pickBestRecommendation(availableStores);

  const overview = [
    {
      id: "search_agent",
      name: "Search Agent",
      value: `${stores.length} stores indexed`,
      detail: `Understands LPG search across ${new Set(stores.map((store) => store.city).filter(Boolean)).size} cities and ${new Set(stores.map((store) => store.state).filter(Boolean)).size} states.`
    },
    {
      id: "recommendation_agent",
      name: "Recommendation Agent",
      value: bestRecommendation?.name || "No live recommendation",
      detail: bestRecommendation
        ? `Best current option is ${bestRecommendation.name} at Rs. ${bestRecommendation.price} and ${bestRecommendation.distance} km.`
        : "Will recommend the strongest available LPG branch once stock is live."
    },
    {
      id: "notification_agent",
      name: "Notification Agent",
      value: `${alertUsers.length} users opted in`,
      detail: `${pendingRequests.length} pending requests and ${lowStockStores.length} low-stock branches are being watched for alerts.`
    },
    {
      id: "admin_insights_agent",
      name: "Admin Insights Agent",
      value: topCityEntry?.[0] || "No request hotspot yet",
      detail: topRequestedStoreEntry
        ? `${topRequestedStoreEntry[0]} is the most watched LPG branch right now.`
        : "Waiting for more request activity to surface demand insights."
    }
  ];

  const highlights = [
    {
      id: "pending_requests",
      label: "Pending Requests",
      value: String(pendingRequests.length),
      detail: `${matchedRequests.length} requests have already been fulfilled.`
    },
    {
      id: "low_stock",
      label: "Low Stock Stores",
      value: String(lowStockStores.length),
      detail: `Threshold is ${LOW_STOCK_THRESHOLD} cylinders or fewer.`
    },
    {
      id: "top_store",
      label: "Most Requested Store",
      value: topRequestedStoreEntry?.[0] || "N/A",
      detail: topRequestedStoreEntry ? `${topRequestedStoreEntry[1]} tracked requests` : "No tracked requests yet."
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: users.length,
      alertsEnabledUsers: alertUsers.length,
      totalRequests: requests.length,
      pendingRequests: pendingRequests.length,
      matchedRequests: matchedRequests.length
    },
    overview,
    highlights
  };
}

module.exports = {
  getAdminInsights
};
