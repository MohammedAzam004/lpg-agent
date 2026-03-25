const { deleteUserById, getAllUsers } = require("../services/userService");
const { deleteRequestById, getAllRequests } = require("../services/requestService");
const { getAdminInsights } = require("../services/agents/orchestrator");

async function listUsers(request, response, next) {
  try {
    console.log("[admin-controller] GET /admin/users called");
    const users = await getAllUsers();

    response.json({
      success: true,
      totalUsers: users.length,
      users
    });
  } catch (error) {
    console.error("[admin-controller] Failed to load users:", error.message);
    next(error);
  }
}

async function removeUser(request, response, next) {
  try {
    console.log(`[admin-controller] DELETE /admin/user/${request.params.id} called`);
    const deletedUser = await deleteUserById(request.params.id);

    response.json({
      success: true,
      message: "User deleted successfully.",
      user: deletedUser
    });
  } catch (error) {
    console.error("[admin-controller] Failed to delete user:", error.message);
    next(error);
  }
}

async function listRequests(request, response, next) {
  try {
    console.log("[admin-controller] GET /admin/requests called");
    const requests = await getAllRequests();

    response.json({
      success: true,
      totalRequests: requests.length,
      requests
    });
  } catch (error) {
    console.error("[admin-controller] Failed to load admin requests:", error.message);
    next(error);
  }
}

async function getInsights(request, response, next) {
  try {
    console.log("[admin-controller] GET /admin/insights called");
    const insights = await getAdminInsights();

    response.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error("[admin-controller] Failed to load admin insights:", error.message);
    next(error);
  }
}

async function removeRequest(request, response, next) {
  try {
    console.log(`[admin-controller] DELETE /admin/request/${request.params.id} called`);
    const deletedRequest = await deleteRequestById(request.params.id);

    response.json({
      success: true,
      message: "Request deleted successfully.",
      request: deletedRequest
    });
  } catch (error) {
    console.error("[admin-controller] Failed to delete request:", error.message);
    next(error);
  }
}

module.exports = {
  getInsights,
  listRequests,
  listUsers,
  removeRequest,
  removeUser
};
