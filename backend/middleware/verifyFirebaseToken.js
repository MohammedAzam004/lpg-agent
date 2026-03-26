const { extractBearerToken, verifyFirebaseIdToken } = require("../services/firebaseAdminService");

async function verifyFirebaseToken(request, response, next) {
  try {
    const idToken = extractBearerToken(request);

    if (!idToken) {
      response.status(401).json({
        success: false,
        message: "Please login to continue."
      });
      return;
    }

    request.firebaseUser = await verifyFirebaseIdToken(idToken);
    next();
  } catch (error) {
    console.error("[auth] Firebase token verification failed:", error.message);
    response.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Unable to verify the current session."
    });
  }
}

module.exports = {
  verifyFirebaseToken
};
