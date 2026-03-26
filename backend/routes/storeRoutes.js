const express = require("express");
const multer = require("multer");
const {
  createStoreEntry,
  deleteStoreEntry,
  getStoreAnalytics,
  importStorePdfEntry,
  listAvailableStores,
  listNearbyStores,
  listStores,
  recommendStore,
  updateStoreEntry
} = require("../controllers/storeController");
const { requireAdminAccess } = require("../utils/accessControl");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter(request, file, callback) {
    const isPdfFile = file?.mimetype === "application/pdf" || /\.pdf$/i.test(file?.originalname || "");

    if (!isPdfFile) {
      callback(new Error("Only PDF files are supported for LPG store import."));
      return;
    }

    callback(null, true);
  }
});

router.get("/", listStores);
router.get("/analytics", getStoreAnalytics);
router.get("/nearby", listNearbyStores);
router.get("/available", listAvailableStores);
router.get("/recommend", recommendStore);
router.post("/import/pdf", requireAdminAccess, upload.single("file"), importStorePdfEntry);
router.post("/", requireAdminAccess, createStoreEntry);
router.put("/:id", requireAdminAccess, updateStoreEntry);
router.delete("/:id", requireAdminAccess, deleteStoreEntry);

module.exports = router;
