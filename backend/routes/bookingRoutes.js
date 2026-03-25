const express = require("express");
const { createBooking, listBookings } = require("../controllers/bookingController");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.get("/", requireAuthenticatedUser, listBookings);
router.post("/", requireAuthenticatedUser, createBooking);

module.exports = router;
