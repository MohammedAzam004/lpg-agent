const {
  detectAvailabilityChanges,
  detectLowStockAlerts,
  detectPriceDrops,
  detectStockRestocks,
  isStoreAvailable,
  pickBestRecommendation
} = require("../storeService");
const { filterStoresForUserPreferences, getAllUsers } = require("../userService");
const { processPendingRequests } = require("../requestService");
const {
  sendAvailabilityDigestEmail,
  sendUserLpgDigestEmail
} = require("../../utils/emailService");

function normalizeEmail(email = "") {
  return email.toString().trim().toLowerCase();
}

function getCurrentlyAvailableStores(stores) {
  return stores.filter((store) => isStoreAvailable(store));
}

function getStoresToNotify(previousStores, currentStores, testMode) {
  const newlyAvailableStores = detectAvailabilityChanges(previousStores, currentStores);
  const availableStores = getCurrentlyAvailableStores(currentStores);

  if (testMode) {
    console.log("[notification-agent] TEST MODE: notifying all available stores.");
    return availableStores;
  }

  return newlyAvailableStores;
}

function buildAlertsForUser(alerts, user) {
  return alerts.filter((alert) => {
    const [matchedStore] = filterStoresForUserPreferences([alert.store], user);
    return Boolean(matchedStore);
  });
}

async function sendAvailabilityNotifications(stores) {
  if (!stores.length) {
    console.log("[notification-agent] No system-wide availability digest to send.");
    return 0;
  }

  console.log(`[notification-agent] Sending a single availability digest for ${stores.length} store(s).`);
  await sendAvailabilityDigestEmail(stores);
  return 1;
}

function buildDigestSummaryForUser({
  user,
  availableStores,
  restocks,
  smartAlerts,
  requestMatches
}) {
  const preferredStores = filterStoresForUserPreferences(availableStores, user);
  const matchingRestocks = buildAlertsForUser(restocks, user).map((alert) => alert.store);
  const matchingAlerts = buildAlertsForUser(smartAlerts, user);
  const matchingRequestMatches = requestMatches.filter((match) => normalizeEmail(match.user.email) === normalizeEmail(user.email));

  return {
    preferredStores,
    matchingRestocks,
    matchingAlerts,
    matchingRequestMatches,
    recommendation: pickBestRecommendation(preferredStores)
  };
}

async function sendUserDigestNotifications(previousStores, currentStores) {
  const users = await getAllUsers();
  const restocks = detectStockRestocks(previousStores, currentStores);
  const smartAlerts = [
    ...detectPriceDrops(previousStores, currentStores),
    ...detectLowStockAlerts(previousStores, currentStores)
  ];
  const requestMatches = await processPendingRequests(previousStores, currentStores);
  const availableStores = getCurrentlyAvailableStores(currentStores);

  if (!users.length) {
    console.log("[notification-agent] No registered users found for LPG digest emails.");
    return {
      userDigestCount: 0,
      stockAlertCount: 0,
      periodicUpdateCount: 0,
      smartAlertCount: 0,
      requestMatchCount: requestMatches.length
    };
  }

  let userDigestCount = 0;
  let stockAlertCount = 0;
  let periodicUpdateCount = 0;
  let smartAlertCount = 0;
  let requestMatchCount = 0;

  for (const user of users) {
    if (user.notificationsEnabled === false) {
      console.log(`[notification-agent] Skipping LPG digest for ${user.email} because notifications are disabled.`);
      continue;
    }

    const {
      preferredStores,
      matchingRestocks,
      matchingAlerts,
      matchingRequestMatches,
      recommendation
    } = buildDigestSummaryForUser({
      user,
      availableStores,
      restocks,
      smartAlerts,
      requestMatches
    });

    if (!matchingRestocks.length && !preferredStores.length && !matchingAlerts.length && !matchingRequestMatches.length) {
      console.log(`[notification-agent] No digest content matched notification settings for ${user.email}.`);
      continue;
    }

    await sendUserLpgDigestEmail(user, {
      restockStores: matchingRestocks,
      availableStores: preferredStores,
      smartAlerts: matchingAlerts,
      requestMatches: matchingRequestMatches,
      recommendation
    });

    stockAlertCount += matchingRestocks.length;
    periodicUpdateCount += preferredStores.length ? 1 : 0;
    smartAlertCount += matchingAlerts.length;
    requestMatchCount += matchingRequestMatches.length;
    userDigestCount += 1;
    console.log(`[notification-agent] Sent a single LPG digest email to ${user.email}.`);
  }

  return {
    userDigestCount,
    stockAlertCount,
    periodicUpdateCount,
    smartAlertCount,
    requestMatchCount
  };
}

async function runNotificationAgent({ previousStores = [], currentStores = [], testMode = false } = {}) {
  const storesToNotify = getStoresToNotify(previousStores, currentStores, testMode);
  const systemDigestCount = await sendAvailabilityNotifications(storesToNotify);
  const userSummary = await sendUserDigestNotifications(previousStores, currentStores);

  return {
    storesToNotifyCount: storesToNotify.length,
    systemDigestCount,
    userDigestCount: userSummary.userDigestCount,
    stockAlertCount: userSummary.stockAlertCount,
    periodicUpdateCount: userSummary.periodicUpdateCount,
    smartAlertCount: userSummary.smartAlertCount,
    requestMatchCount: userSummary.requestMatchCount
  };
}

async function runImmediateRequestNotificationAgent(previousStores, currentStores) {
  console.log("[notification-agent] Immediate request notifications are disabled. Waiting for the next scheduled digest cycle.");
  return 0;
}

module.exports = {
  runImmediateRequestNotificationAgent,
  runNotificationAgent
};
