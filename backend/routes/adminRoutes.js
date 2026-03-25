const express = require("express");
const {
  getInsights,
  listRequests,
  listUsers,
  removeRequest,
  removeUser
} = require("../controllers/adminController");
const { requireAdminAccess } = require("../utils/accessControl");

const router = express.Router();

router.use(requireAdminAccess);

router.get("/insights", getInsights);
router.get("/users", listUsers);
router.delete("/user/:id", removeUser);
router.get("/requests", listRequests);
router.delete("/request/:id", removeRequest);

module.exports = router;
