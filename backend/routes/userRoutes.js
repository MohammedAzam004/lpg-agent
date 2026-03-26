const express = require("express");
const { getProfile, registerUser, updatePreferences, updateProfile } = require("../controllers/userController");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.post("/register", registerUser);
router.get("/profile", requireAuthenticatedUser, getProfile);
router.post("/preferences", requireAuthenticatedUser, updatePreferences);
router.put("/profile", requireAuthenticatedUser, updateProfile);

module.exports = router;
