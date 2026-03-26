const express = require("express");
const { createRequest, deleteRequest, listRequests } = require("../controllers/requestController");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.get("/", verifyFirebaseToken, requireAuthenticatedUser, listRequests);
router.post("/", verifyFirebaseToken, requireAuthenticatedUser, createRequest);
router.delete("/:id", verifyFirebaseToken, requireAuthenticatedUser, deleteRequest);

module.exports = router;
