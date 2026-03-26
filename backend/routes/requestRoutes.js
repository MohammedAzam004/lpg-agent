const express = require("express");
const { createRequest, deleteRequest, listRequests } = require("../controllers/requestController");
const { requireAuthenticatedUser } = require("../utils/accessControl");

const router = express.Router();

router.get("/", requireAuthenticatedUser, listRequests);
router.post("/", requireAuthenticatedUser, createRequest);
router.delete("/:id", requireAuthenticatedUser, deleteRequest);

module.exports = router;
