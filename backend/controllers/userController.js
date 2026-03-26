const {
  sendLoginGreetingEmail,
  sendPreferenceSummaryEmail,
  sendWelcomeEmail
} = require("../utils/emailService");
const { isAdminEmail } = require("../utils/accessControl");
const { getUserProfile, registerOrLoginUser, updateUserPreferences } = require("../services/userService");

function buildUserPayload(user) {
  return {
    user,
    role: isAdminEmail(user?.email) ? "admin" : "user"
  };
}

function dispatchProfileEmails(mode, user, preferenceMode = "summary") {
  const emailTasks = mode === "register"
    ? [sendWelcomeEmail(user), sendPreferenceSummaryEmail(user, preferenceMode)]
    : mode === "login"
      ? [sendLoginGreetingEmail(user), sendPreferenceSummaryEmail(user, preferenceMode)]
      : [sendPreferenceSummaryEmail(user, preferenceMode)];

  Promise.allSettled(emailTasks)
    .then((results) => {
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`[user-controller] Background email task ${index + 1} failed:`, result.reason?.message || result.reason);
        }
      });
    })
    .catch((error) => {
      console.error("[user-controller] Background email dispatch failed:", error.message);
    });
}

async function registerUser(request, response, next) {
  try {
    console.log("[user-controller] POST /user/register called");
    const result = await registerOrLoginUser(request.body);

    response.status(result.action === "register" ? 201 : 200).json({
      success: true,
      action: result.action,
      message: result.action === "register" ? "User registered successfully." : "Login successful.",
      ...buildUserPayload(result.user)
    });

    dispatchProfileEmails(result.action, result.user, "summary");
  } catch (error) {
    console.error("[user-controller] Failed to register/login user:", error.message);
    next(error);
  }
}

async function getProfile(request, response, next) {
  try {
    const requestedEmail = request.query.email;
    const lookupEmail = request.isAdmin && requestedEmail ? requestedEmail : request.requesterEmail;
    console.log(`[user-controller] GET /user/profile called for ${lookupEmail || "unknown user"}`);
    const user = await getUserProfile(lookupEmail);

    if (!user) {
      response.status(404).json({
        success: false,
        message: "User profile not found."
      });
      return;
    }

    response.json({
      success: true,
      ...buildUserPayload(user)
    });
  } catch (error) {
    console.error("[user-controller] Failed to fetch user profile:", error.message);
    next(error);
  }
}

async function handleNotificationSettingsUpdate(request, response, next, routeLabel) {
  try {
    console.log(`[user-controller] ${routeLabel} called`);
    const user = await updateUserPreferences({
      ...request.body,
      email: request.requesterEmail
    });
    await sendPreferenceSummaryEmail(user, "updated");

    response.json({
      success: true,
      message: "Notification settings updated successfully.",
      ...buildUserPayload(user)
    });

    dispatchProfileEmails("preferences", user, "updated");
  } catch (error) {
    console.error("[user-controller] Failed to update notification settings:", error.message);
    next(error);
  }
}

async function updateProfile(request, response, next) {
  return handleNotificationSettingsUpdate(request, response, next, "PUT /user/profile");
}

async function updatePreferences(request, response, next) {
  return handleNotificationSettingsUpdate(request, response, next, "POST /user/preferences");
}

module.exports = {
  getProfile,
  registerUser,
  updatePreferences,
  updateProfile
};
