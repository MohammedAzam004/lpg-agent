const cron = require("node-cron");
const { getPreviousStores, getStores, savePreviousStores } = require("./dataService");
const {
  detectAvailabilityChanges,
  detectStockRestocks,
  isStoreAvailable
} = require("./storeService");
const { runImmediateRequestNotificationAgent, runNotificationAgent } = require("./agents/orchestrator");

// TEST MODE: set SCHEDULER_TEST_MODE=false to revert to the production schedule below.
const TEST_MODE = process.env.SCHEDULER_TEST_MODE === "true";
const TEST_CRON_EXPRESSION = "*/30 * * * * *";
const PRODUCTION_CRON_EXPRESSION = "0 */2 * * *";

function logAvailabilityChanges(stores) {
  if (!stores.length) {
    console.log("[scheduler] No availability changes detected.");
    return;
  }

  for (const store of stores) {
    console.log(
      `[scheduler] Availability changed: ${store.name} in ${store.city || store.location} is now available at Rs. ${store.price} with stock ${store.stockCount || 0}.`
    );
  }
}

function getCurrentlyAvailableStores(stores) {
  return stores.filter((store) => isStoreAvailable(store));
}

async function processImmediateRequestNotifications() {
  const [previousStores, currentStores] = await Promise.all([getPreviousStores(), getStores()]);
  const sentCount = await runImmediateRequestNotificationAgent(previousStores, currentStores);

  if (sentCount > 0) {
    console.log(`[scheduler] Sent ${sentCount} immediate request notification(s).`);
  }

  await savePreviousStores(currentStores);
}

async function syncSnapshotWithoutNotifications() {
  const previousStores = await getPreviousStores();

  if (previousStores.length) {
    console.log("[scheduler] Previous snapshot already exists. Skipping initial sync.");
    return;
  }

  const currentStores = await getStores();
  await savePreviousStores(currentStores);
  console.log("[scheduler] Initial LPG snapshot created.");
}

async function checkAvailabilityChanges() {
  console.log("Scheduler running...");
  console.log("Checking availability...");
  const [previousStores, currentStores] = await Promise.all([getPreviousStores(), getStores()]);

  const stockRestocks = detectStockRestocks(previousStores, currentStores);
  const newlyAvailableStores = detectAvailabilityChanges(previousStores, currentStores);
  const availableStores = getCurrentlyAvailableStores(currentStores);

  console.log(`[scheduler] Detected ${stockRestocks.length} stock restock alert(s).`);
  console.log(`[scheduler] Detected ${newlyAvailableStores.length} newly available store(s).`);
  logAvailabilityChanges(newlyAvailableStores);
  console.log(`[scheduler] Found ${availableStores.length} currently available store(s).`);

  if (!previousStores.length) {
    console.log("[scheduler] No previous snapshot found. Running with current JSON data.");
  }

  const notificationSummary = await runNotificationAgent({
    previousStores,
    currentStores,
    testMode: TEST_MODE
  });

  console.log(
    `[scheduler] Notification Agent summary: systemDigest=${notificationSummary.systemDigestCount}, userDigests=${notificationSummary.userDigestCount}, stores=${notificationSummary.storesToNotifyCount}, stock=${notificationSummary.stockAlertCount}, periodic=${notificationSummary.periodicUpdateCount}, smart=${notificationSummary.smartAlertCount}, requests=${notificationSummary.requestMatchCount}`
  );

  await savePreviousStores(currentStores);
  console.log("[scheduler] Snapshot updated after availability check.");
}

function startAvailabilityScheduler() {
  const activeCronExpression = TEST_MODE ? TEST_CRON_EXPRESSION : PRODUCTION_CRON_EXPRESSION;

  console.log("Scheduler running...");
  console.log(`[scheduler] TEST MODE is ${TEST_MODE ? "ENABLED" : "DISABLED"}.`);
  console.log(`[scheduler] Starting LPG availability scheduler. Cron: ${activeCronExpression}`);
  syncSnapshotWithoutNotifications().catch((error) => {
    console.error("Unable to initialize LPG snapshot:", error);
  });

  const task = cron.schedule(activeCronExpression, async () => {
    try {
      await checkAvailabilityChanges();
    } catch (error) {
      console.error("LPG scheduler failed:", error);
    }
  });

  return task;
}

module.exports = {
  checkAvailabilityChanges,
  processImmediateRequestNotifications,
  startAvailabilityScheduler
};
