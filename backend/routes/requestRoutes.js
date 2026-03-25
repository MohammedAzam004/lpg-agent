const express = require("express");
const { createRequest, deleteRequest, listRequests } = require("../controllers/requestController");

const router = express.Router();

router.get("/", listRequests);
router.post("/", createRequest);
router.delete("/:id", deleteRequest);

module.exports = router;
