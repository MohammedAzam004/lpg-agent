const {
  createStore,
  deleteStore,
  getAllStores,
  getAvailableStores,
  getBestRecommendation,
  getNearbyStores,
  getTrendAnalytics,
  updateStore
} = require("../services/storeService");
const { importStoresFromPdf } = require("../services/pdfImportService");
const { processImmediateRequestNotifications } = require("../services/schedulerService");

async function listStores(request, response, next) {
  try {
    const stores = await getAllStores();
    console.log("GET /stores called");

    if (!Array.isArray(stores) || stores.length === 0) {
      response.json({
        message: "No store data available.",
        stores: []
      });
      return;
    }

    console.log(`[stores] Returning ${stores.length} stores`);
    response.json({ stores });
  } catch (error) {
    console.error("[stores] Failed to list stores:", error.message);
    next(error);
  }
}

async function listNearbyStores(request, response, next) {
  try {
    const { location, maxDistance } = request.query;
    console.log("GET /stores/nearby called");

    if (maxDistance !== undefined && Number.isNaN(Number(maxDistance))) {
      response.status(400).json({ message: "maxDistance must be a valid number." });
      return;
    }

    const stores = await getNearbyStores(location, maxDistance);

    if (!Array.isArray(stores) || stores.length === 0) {
      response.json({
        message: "No nearby stores found.",
        stores: []
      });
      return;
    }

    console.log(
      `[stores] Nearby lookup completed for location="${location || "all"}" maxDistance="${maxDistance || "none"}" with ${stores.length} result(s)`
    );
    response.json({ stores });
  } catch (error) {
    console.error("[stores] Failed to list nearby stores:", error.message);
    next(error);
  }
}

async function listAvailableStores(request, response, next) {
  try {
    console.log("GET /stores/available called");
    const stores = await getAvailableStores(request.query.location);

    if (!Array.isArray(stores) || stores.length === 0) {
      response.json({
        message: "No available LPG stores found.",
        stores: []
      });
      return;
    }

    console.log(
      `[stores] Returning ${stores.length} available store(s) for location="${request.query.location || "all"}"`
    );
    response.json({ stores });
  } catch (error) {
    console.error("[stores] Failed to list available stores:", error.message);
    next(error);
  }
}

async function recommendStore(request, response, next) {
  try {
    console.log("GET /stores/recommend called");
    const store = await getBestRecommendation(request.query.location);

    if (!store) {
      console.warn(
        `[stores] No recommendation found for location="${request.query.location || "all"}"`
      );
      response.json({
        success: true,
        message: "No recommended LPG store found.",
        store: null,
        recommendation: null
      });
      return;
    }

    console.log(
      `[stores] Recommended store "${store.name}" for location="${request.query.location || "all"}"`
    );
    response.json({
      success: true,
      store,
      recommendation: store
    });
  } catch (error) {
    console.error("[stores] Failed to recommend store:", error.message);
    next(error);
  }
}

async function getStoreAnalytics(request, response, next) {
  try {
    console.log("GET /stores/analytics called");
    const analytics = await getTrendAnalytics(request.query.location || null);
    response.json({
      success: true,
      ...analytics
    });
  } catch (error) {
    console.error("[stores] Failed to load analytics:", error.message);
    next(error);
  }
}

async function createStoreEntry(request, response, next) {
  try {
    console.log("POST /stores called");
    const store = await createStore(request.body);
    response.status(201).json({
      success: true,
      message: "Store created successfully.",
      store
    });
  } catch (error) {
    console.error("[stores] Failed to create store:", error.message);
    next(error);
  }
}

async function updateStoreEntry(request, response, next) {
  try {
    console.log(`PUT /stores/${request.params.id} called`);
    const store = await updateStore(request.params.id, request.body);
    await processImmediateRequestNotifications();
    response.json({
      success: true,
      message: "Store updated successfully.",
      store
    });
  } catch (error) {
    console.error("[stores] Failed to update store:", error.message);
    next(error);
  }
}

async function deleteStoreEntry(request, response, next) {
  try {
    console.log(`DELETE /stores/${request.params.id} called`);
    const store = await deleteStore(request.params.id);
    response.json({
      success: true,
      message: "Store deleted successfully.",
      store
    });
  } catch (error) {
    console.error("[stores] Failed to delete store:", error.message);
    next(error);
  }
}

async function importStorePdfEntry(request, response, next) {
  try {
    console.log(`POST /stores/import/pdf called by ${request.requesterEmail || "unknown user"}`);
    const importSummary = await importStoresFromPdf(request.file);
    response.status(201).json({
      success: true,
      message: `Imported ${importSummary.importedCount} LPG stores from ${importSummary.sourceName}.`,
      ...importSummary
    });
  } catch (error) {
    console.error("[stores] Failed to import stores from PDF:", error.message);
    next(error);
  }
}

module.exports = {
  createStoreEntry,
  deleteStoreEntry,
  getStoreAnalytics,
  importStorePdfEntry,
  listAvailableStores,
  listNearbyStores,
  listStores,
  recommendStore,
  updateStoreEntry
};
