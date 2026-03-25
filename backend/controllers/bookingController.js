const { createBookingRequest, getBookingHistory } = require("../services/bookingService");

async function createBooking(request, response, next) {
  try {
    console.log("[booking-controller] POST /bookings called");
    const booking = await createBookingRequest(request.body);
    response.status(201).json({
      success: true,
      message: "LPG request created successfully.",
      booking
    });
  } catch (error) {
    console.error("[booking-controller] Failed to create booking:", error.message);
    next(error);
  }
}

async function listBookings(request, response, next) {
  try {
    console.log("[booking-controller] GET /bookings called");
    const bookings = await getBookingHistory(request.query.email);
    response.json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error("[booking-controller] Failed to load bookings:", error.message);
    next(error);
  }
}

module.exports = {
  createBooking,
  listBookings
};
