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
  sendAvailabilityEmail,
  sendPeriodicUpdateEmail,
  sendRequestedLpgAvailableEmail,
  sendStockAvailabilityEmail,
  sendSmartNotificationEmail
} = require("../../utils/emailService");

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
  for (const store of stores) {
    console.log(`[notification-agent] Email triggered for ${store.name}`);
    await sendAvailabilityEmail(store);
  }
}

async function sendStockNotificationsToUsers(previousStores, currentStores) {
  const users = await getAllUsers();
  const stockRestocks = detectStockRestocks(previousStores, currentStores);

  if (!stockRestocks.length) {
    console.log("[notification-agent] No stock restock alerts detected for user notifications.");
    return 0;
  }

  if (!users.length) {
    console.log("[notification-agent] Stock restocks detected, but there are no registered users to notify.");
    return 0;
  }

  let sentCount = 0;

  for (const user of users) {
    if (user.notificationsEnabled === false) {
      console.log(`[notification-agent] Stock alerts skipped for ${user.email} because notifications are disabled.`);
      continue;
    }

    const matchingRestocks = buildAlertsForUser(stockRestocks, user);

    if (!matchingRestocks.length) {
      console.log(`[notification-agent] No stock alerts matched notification settings for ${user.email}.`);
      continue;
    }

    for (const alert of matchingRestocks) {
      console.log(
        `[notification-agent] Sending stock alert to ${user.email} for ${alert.store.name} at Rs. ${alert.store.price} (${alert.store.distance} km).`
      );
      await sendStockAvailabilityEmail(user, alert.store);
      sentCount += 1;
    }
  }

  return sentCount;
}

async function sendPeriodicNotificationsToUsers(currentStores) {
  const users = await getAllUsers();

  if (!users.length) {
    console.log("[notification-agent] No registered users found for periodic LPG updates.");
    return 0;
  }

  const availableStores = getCurrentlyAvailableStores(currentStores);
  let sentCount = 0;

  for (const user of users) {
    if (user.notificationsEnabled === false) {
      console.log(`[notification-agent] Notifications are disabled for ${user.email}. Skipping update email.`);
      continue;
    }

    const preferredStores = filterStoresForUserPreferences(availableStores, user);

    if (!preferredStores.length) {
      console.log(`[notification-agent] No stores matched preferences for ${user.email}. Skipping update email.`);
      continue;
    }

    const recommendation = pickBestRecommendation(preferredStores);
    console.log(`[notification-agent] Sending periodic LPG update to ${user.email}`);
    await sendPeriodicUpdateEmail(user, preferredStores, recommendation);
    sentCount += 1;
  }

  return sentCount;
}

async function sendSmartNotificationsToUsers(previousStores, currentStores) {
  const users = await getAllUsers();
  const alerts = [
    ...detectPriceDrops(previousStores, currentStores),
    ...detectLowStockAlerts(previousStores, currentStores)
  ];

  if (!alerts.length) {
    console.log("[notification-agent] No price-drop or low-stock smart alerts detected.");
    return 0;
  }

  if (!users.length) {
    console.log("[notification-agent] Smart alerts detected, but there are no registered users to notify.");
    return 0;
  }

  let sentCount = 0;

  for (const user of users) {
    if (user.notificationsEnabled === false) {
      console.log(`[notification-agent] Smart alerts skipped for ${user.email} because notifications are disabled.`);
      continue;
    }

    const matchingAlerts = buildAlertsForUser(alerts, user);

    if (!matchingAlerts.length) {
      console.log(`[notification-agent] No smart alerts matched preferences for ${user.email}.`);
      continue;
    }

    console.log(`[notification-agent] Sending ${matchingAlerts.length} smart alert(s) to ${user.email}.`);
    await sendSmartNotificationEmail(user, matchingAlerts);
    sentCount += matchingAlerts.length;
  }

  return sentCount;
}

async function sendRequestMatchNotifications(previousStores, currentStores) {
  const matches = await processPendingRequests(previousStores, currentStores);

  if (!matches.length) {
    console.log("[notification-agent] No smart LPG request matches to notify.");
    return 0;
  }

  for (const match of matches) {
    console.log(
      `[notification-agent] Sending request match alert to ${match.user.email} for request "${match.request.query}" via ${match.store.name}.`
    );
    await sendRequestedLpgAvailableEmail(match.user, match.request, match.store);
  }

  return matches.length;
}

async function runNotificationAgent({ previousStores = [], currentStores = [], testMode = false } = {}) {
  const storesToNotify = getStoresToNotify(previousStores, currentStores, testMode);

  await sendAvailabilityNotifications(storesToNotify);

  const [stockAlertCount, periodicUpdateCount, smartAlertCount, requestMatchCount] = await Promise.all([
    sendStockNotificationsToUsers(previousStores, currentStores),
    sendPeriodicNotificationsToUsers(currentStores),
    sendSmartNotificationsToUsers(previousStores, currentStores),
    sendRequestMatchNotifications(previousStores, currentStores)
  ]);

  return {
    storesToNotifyCount: storesToNotify.length,
    stockAlertCount,
    periodicUpdateCount,
    smartAlertCount,
    requestMatchCount
  };
}

async function runImmediateRequestNotificationAgent(previousStores, currentStores) {
  return sendRequestMatchNotifications(previousStores, currentStores);
}

module.exports = {
  runImmediateRequestNotificationAgent,
  runNotificationAgent
};
