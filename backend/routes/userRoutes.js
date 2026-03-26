const express = require("express");
const { getProfile, registerUser, updatePreferences, updateProfile } = require("../controllers/userController");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.post("/register", registerUser);
router.get("/profile", verifyFirebaseToken, requireAuthenticatedUser, getProfile);
router.post("/preferences", verifyFirebaseToken, requireAuthenticatedUser, updatePreferences);
router.put("/profile", verifyFirebaseToken, requireAuthenticatedUser, updateProfile);

module.exports = router;
