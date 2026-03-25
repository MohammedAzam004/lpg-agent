const { createRequestAlert, deleteRequestAlert, getRequestHistory } = require("../services/requestService");

async function createRequest(request, response, next) {
  try {
    console.log("[request-controller] POST /request called");
    const savedRequest = await createRequestAlert({
      ...request.body,
      userEmail: request.requesterEmail
    });

    response.status(savedRequest?.duplicate ? 200 : 201).json({
      success: true,
      message: savedRequest?.duplicate
        ? "LPG availability request already exists for this store."
        : "LPG request saved successfully.",
      request: savedRequest
    });
  } catch (error) {
    console.error("[request-controller] Failed to save LPG request:", error.message);
    next(error);
  }
}

async function listRequests(request, response, next) {
  try {
    console.log("[request-controller] GET /request called");
    const requests = await getRequestHistory(request.requesterEmail);

    response.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error("[request-controller] Failed to load LPG requests:", error.message);
    next(error);
  }
}

async function deleteRequest(request, response, next) {
  try {
    console.log(`[request-controller] DELETE /request/${request.params.id} called`);
    const deletedRequest = await deleteRequestAlert(request.params.id, request.requesterEmail);

    response.json({
      success: true,
      message: "LPG request removed successfully.",
      request: deletedRequest
    });
  } catch (error) {
    console.error("[request-controller] Failed to remove LPG request:", error.message);
    next(error);
  }
}

module.exports = {
  createRequest,
  deleteRequest,
  listRequests
};
