const express = require("express");
const { getProfile, registerUser, updatePreferences, updateProfile } = require("../controllers/userController");

const router = express.Router();

router.post("/register", registerUser);
router.get("/profile", getProfile);
router.post("/preferences", updatePreferences);
router.put("/profile", updateProfile);

module.exports = router;
