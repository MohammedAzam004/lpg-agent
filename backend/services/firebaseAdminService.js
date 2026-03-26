const admin = require("firebase-admin");

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
      return JSON.parse(rawJson);
    } catch (error) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
}

function getFirebaseAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = parseServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

function getFirebaseAdminAuth() {
  return getFirebaseAdminApp().auth();
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken) {
    const error = new Error("Missing Firebase ID token.");
    error.statusCode = 401;
    throw error;
  }

  try {
    return await getFirebaseAdminAuth().verifyIdToken(idToken, true);
  } catch (error) {
    const authError = new Error("Invalid or expired Firebase session. Please login again.");
    authError.statusCode = 401;
    authError.cause = error;
    throw authError;
  }
}

function extractBearerToken(request) {
  const authorizationHeader = request.headers.authorization || "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

module.exports = {
  extractBearerToken,
  getFirebaseAdminAuth,
  verifyFirebaseIdToken
};
