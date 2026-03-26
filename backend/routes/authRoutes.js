const express = require("express");
const { getSession, sendOtp, syncUser, verifyOtp } = require("../controllers/authController");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");

const router = express.Router();

router.get("/session", verifyFirebaseToken, getSession);
router.post("/sync-user", verifyFirebaseToken, syncUser);
router.post("/send-otp", verifyFirebaseToken, sendOtp);
router.post("/verify-otp", verifyFirebaseToken, verifyOtp);

module.exports = router;
