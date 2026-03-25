const {
  sendLoginGreetingEmail,
  sendPreferenceSummaryEmail,
  sendWelcomeEmail
} = require("../utils/emailService");
const { getUserProfile, registerOrLoginUser, updateUserPreferences } = require("../services/userService");

async function registerUser(request, response, next) {
  try {
    console.log("[user-controller] POST /user/register called");
    const result = await registerOrLoginUser(request.body);

    if (result.action === "register") {
      await sendWelcomeEmail(result.user);
      await sendPreferenceSummaryEmail(result.user, "summary");
    } else {
      await sendLoginGreetingEmail(result.user);
      await sendPreferenceSummaryEmail(result.user, "summary");
    }

    response.status(result.action === "register" ? 201 : 200).json({
      success: true,
      action: result.action,
      message: result.action === "register" ? "User registered successfully." : "Login successful.",
      user: result.user
    });
  } catch (error) {
    console.error("[user-controller] Failed to register/login user:", error.message);
    next(error);
  }
}

async function getProfile(request, response, next) {
  try {
    const { email } = request.query;
    console.log(`[user-controller] GET /user/profile called for ${email || "latest user"}`);
    const user = await getUserProfile(email);

    if (!user) {
      response.status(404).json({
        success: false,
        message: "User profile not found."
      });
      return;
    }

    response.json({
      success: true,
      user
    });
  } catch (error) {
    console.error("[user-controller] Failed to fetch user profile:", error.message);
    next(error);
  }
}

async function handleNotificationSettingsUpdate(request, response, next, routeLabel) {
  try {
    console.log(`[user-controller] ${routeLabel} called`);
    const user = await updateUserPreferences(request.body);
    await sendPreferenceSummaryEmail(user, "updated");

    response.json({
      success: true,
      message: "Notification settings updated successfully.",
      user
    });
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
