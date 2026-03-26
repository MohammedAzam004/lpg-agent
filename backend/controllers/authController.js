const {
  getAuthenticatedSession,
  sendOtpForFirebaseUser,
  syncAuthenticatedUser,
  verifyOtpForFirebaseUser
} = require("../services/authService");
const {
  sendAppOverviewEmail,
  sendLoginGreetingEmail,
  sendWelcomeEmail
} = require("../utils/emailService");

function dispatchAuthEmails(session, authFlow = "login") {
  if (!session?.user) {
    return;
  }

  const emailTasks = authFlow === "register" || session.isNewUser
    ? [sendWelcomeEmail(session.user), sendAppOverviewEmail(session.user)]
    : [sendLoginGreetingEmail(session.user), sendAppOverviewEmail(session.user)];

  Promise.allSettled(emailTasks).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[auth-controller] Background auth email ${index + 1} failed:`, result.reason?.message || result.reason);
      }
    });
  });
}

async function getSession(request, response, next) {
  try {
    console.log("[auth-controller] GET /auth/session called");
    const session = await getAuthenticatedSession(request.firebaseUser);

    response.json({
      success: true,
      ...session
    });
  } catch (error) {
    console.error("[auth-controller] Failed to load auth session:", error.message);
    next(error);
  }
}

async function syncUser(request, response, next) {
  try {
    console.log("[auth-controller] POST /auth/sync-user called");
    const session = await syncAuthenticatedUser(request.firebaseUser, request.body || {});

    response.json({
      success: true,
      message: "Authenticated user synced successfully.",
      ...session
    });

    if (request.body?.sendProfileEmails) {
      dispatchAuthEmails(session, request.body?.authFlow || "login");
    }
  } catch (error) {
    console.error("[auth-controller] Failed to sync authenticated user:", error.message);
    next(error);
  }
}

async function sendOtp(request, response, next) {
  try {
    console.log("[auth-controller] POST /auth/send-otp called");
    const result = await sendOtpForFirebaseUser(request.firebaseUser);

    response.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("[auth-controller] Failed to send OTP:", error.message);
    next(error);
  }
}

async function verifyOtp(request, response, next) {
  try {
    console.log("[auth-controller] POST /auth/verify-otp called");
    const verification = await verifyOtpForFirebaseUser(request.firebaseUser, request.body?.otp);
    const session = await syncAuthenticatedUser(request.firebaseUser, request.body || {});

    response.json({
      success: true,
      message: verification.message,
      requiresOtp: verification.requiresOtp,
      otpVerified: verification.otpVerified,
      user: session.user,
      role: session.role
    });
  } catch (error) {
    console.error("[auth-controller] Failed to verify OTP:", error.message);
    next(error);
  }
}

module.exports = {
  getSession,
  sendOtp,
  syncUser,
  verifyOtp
};
