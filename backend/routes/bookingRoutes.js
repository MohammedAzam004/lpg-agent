const express = require("express");
const { createBooking, listBookings } = require("../controllers/bookingController");
const { verifyFirebaseToken } = require("../middleware/verifyFirebaseToken");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.get("/", verifyFirebaseToken, requireAuthenticatedUser, listBookings);
router.post("/", verifyFirebaseToken, requireAuthenticatedUser, createBooking);

module.exports = router;
