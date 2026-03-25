const express = require("express");
const {
  createStoreEntry,
  deleteStoreEntry,
  getStoreAnalytics,
  listAvailableStores,
  listNearbyStores,
  listStores,
  recommendStore,
  updateStoreEntry
} = require("../controllers/storeController");

const router = express.Router();

router.get("/", listStores);
router.get("/analytics", getStoreAnalytics);
router.get("/nearby", listNearbyStores);
router.get("/available", listAvailableStores);
router.get("/recommend", recommendStore);
router.post("/", createStoreEntry);
router.put("/:id", updateStoreEntry);
router.delete("/:id", deleteStoreEntry);

module.exports = router;
