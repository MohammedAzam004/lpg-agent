const express = require("express");
const { createBooking, listBookings } = require("../controllers/bookingController");

const router = express.Router();

router.get("/", listBookings);
router.post("/", createBooking);

module.exports = router;
