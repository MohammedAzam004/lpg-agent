import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let persistencePromise = null;

function validateFirebaseConfig() {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];
  const missingKey = requiredKeys.find((key) => !firebaseConfig[key]);

  if (missingKey) {
    throw new Error(`Firebase is not configured. Missing ${missingKey}.`);
  }
}

function getFirebaseAuthInstance() {
  validateFirebaseConfig();

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn("[firebase] Failed to enable local persistence:", error.message);
    });
  }

  return auth;
}

function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export function onFirebaseAuthChange(callback) {
  return onAuthStateChanged(getFirebaseAuthInstance(), callback);
}

export function getCurrentFirebaseUser() {
  return getFirebaseAuthInstance().currentUser;
}

export async function getFirebaseIdToken(forceRefresh = false) {
  const auth = getFirebaseAuthInstance();

  if (!auth.currentUser) {
    return null;
  }

  return auth.currentUser.getIdToken(forceRefresh);
}

export async function registerWithEmailPassword({ email, password, displayName }) {
  const auth = getFirebaseAuthInstance();
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  await credential.user.reload();
  return getFirebaseAuthInstance().currentUser;
}

export async function loginWithEmailPassword({ email, password }) {
  const credential = await signInWithEmailAndPassword(getFirebaseAuthInstance(), email, password);
  return credential.user;
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(getFirebaseAuthInstance(), getGoogleProvider());
  return credential.user;
}

export async function logoutFirebaseUser() {
  await signOut(getFirebaseAuthInstance());
}
