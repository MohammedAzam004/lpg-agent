import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminPanel from "./components/AdminPanel";
import AnalyticsPanel from "./components/AnalyticsPanel";
import AppNavigation from "./components/AppNavigation";
import BookingPanel from "./components/BookingPanel";
import ChatWorkspace from "./components/ChatWorkspace";
import FloatingChatbot from "./components/FloatingChatbot";
import NotificationSettingsPanel from "./components/NotificationSettingsPanel";
import ProfilePanel from "./components/ProfilePanel";
import RequestHistoryPanel from "./components/RequestHistoryPanel";
import StoreBoard from "./components/StoreBoard";
import TrendCharts from "./components/TrendCharts";
import { getUiText } from "./i18n";
import {
  createBooking,
  createRequestAlert,
  createStoreRecord,
  deleteAdminRequest,
  deleteAdminUser,
  deleteRequestAlert,
  deleteStoreRecord,
  fetchAdminInsights,
  fetchAdminRequests,
  fetchAdminUsers,
  fetchAvailableStores,
  fetchBookingHistory,
  fetchAuthSession,
  fetchRequestHistory,
  fetchRecommendedStore,
  fetchStoreAnalytics,
  fetchStores,
  importStoresFromPdf,
  sendOtpCode,
  sendChatMessage,
  syncAuthenticatedUser,
  updateStoreRecord,
  updateUserProfile,
  verifyOtpCode
} from "./services/api";
import {
  getFirebaseIdToken,
  loginWithEmailPassword,
  loginWithGoogle,
  logoutFirebaseUser,
  onFirebaseAuthChange,
  registerWithEmailPassword
} from "./services/firebaseService";
import AdminPage from "./pages/AdminPage";
import BookingsPage from "./pages/BookingsPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import RequestsPage from "./pages/RequestsPage";

const USER_EMAIL_STORAGE_KEY = "lpg-smart-user-email";
const LANGUAGE_STORAGE_KEY = "lpg-smart-language";
const CHAT_SESSION_STORAGE_KEY = "lpg-smart-chat-session";
const CHAT_MESSAGES_STORAGE_KEY = "lpg-smart-chat-messages";

const initialProfileForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  password: ""
};

const initialPreferenceForm = {
  maxPrice: "",
  maxDistance: "",
  notificationsEnabled: true
};

const initialAdminForm = {
  state: "",
  city: "",
  location: "",
  name: "",
  branchCode: "",
  distance: "",
  price: "",
  stockCount: "",
  availability: true
};

function RequireAuth({ isAuthenticated, authLoading = false, children }) {
  const location = useLocation();

  if (authLoading) {
    return <div className="page-state">{getUiText("en").profile?.loading || "Loading session..."}</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/profile"
        replace
        state={{ reason: "login", from: location.pathname }}
      />
    );
  }

  return children;
}

function RequireAdmin({ isAuthenticated, isAdmin, authLoading = false, children }) {
  const location = useLocation();

  if (authLoading) {
    return <div className="page-state">{getUiText("en").profile?.loading || "Loading session..."}</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/profile"
        replace
        state={{ reason: "login", from: location.pathname }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace state={{ reason: "admin" }} />;
  }

  return children;
}

function getUniqueCount(items, key) {
  return new Set(items.map((item) => item[key]).filter(Boolean)).size;
}

function dedupeStoreRequests(requests = []) {
  const seen = new Set();

  return requests.filter((request) => {
    if (!request?.storeId) {
      return false;
    }

    const requestKey = `${request.userEmail || ""}|${request.storeId}`;

    if (seen.has(requestKey)) {
      return false;
    }

    seen.add(requestKey);
    return true;
  });
}

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhoneFormat(phone) {
  return /^\d{10}$/.test(phone.replace(/\D/g, ""));
}

function isPositiveNumberOrEmpty(value) {
  if (value === "") {
    return true;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0;
}

function buildPreferenceForm(user) {
  return {
    maxPrice: user?.maxPrice ?? "",
    maxDistance: user?.maxDistance ?? "",
    notificationsEnabled: user?.notificationsEnabled !== false
  };
}

function buildAdminForm(store = null) {
  if (!store) {
    return initialAdminForm;
  }

  return {
    state: store.state || "",
    city: store.city || "",
    location: store.location || "",
    name: store.name || "",
    branchCode: store.branchCode || "",
    distance: store.distance ?? "",
    price: store.price ?? "",
    stockCount: store.stockCount ?? "",
    availability: Boolean(store.availability)
  };
}

function buildLocationContext(locationQuery, user = null) {
  return {
    locationQuery: locationQuery || "",
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null
  };
}

function getPreferredDisplayName(user = {}, fallbackForm = {}) {
  return user?.name || user?.displayName || fallbackForm?.name || "there";
}

function createInitialMessage(language) {
  const initialMessageByLanguage = {
    en: "Ask about nearby LPG, cheapest cylinders, current availability, or the best recommendation for your area.",
    hi: "पास के LPG, सबसे सस्ते सिलेंडर, वर्तमान उपलब्धता, या आपके क्षेत्र के लिए सबसे अच्छे सुझाव के बारे में पूछें।",
    te: "మీ ప్రాంతానికి దగ్గరలో ఉన్న LPG, తక్కువ ధర సిలిండర్లు, ప్రస్తుత లభ్యత, లేదా ఉత్తమ సిఫారసు గురించి అడగండి."
  };

  return {
    id: "welcome-message",
    role: "bot",
    text: initialMessageByLanguage[language] || initialMessageByLanguage.en,
    explanation: null,
    stores: [],
    recommendation: null,
    alternatives: [],
    sectionTarget: null,
    sectionLabel: null
  };
}

function normalizeStoredMessage(message) {
  if (!message || (message.role !== "user" && message.role !== "bot") || typeof message.text !== "string") {
    return null;
  }

  return {
    id: message.id || `${message.role}-${Date.now()}-${Math.random()}`,
    role: message.role,
    text: message.text,
    explanation: message.explanation || null,
    stores: Array.isArray(message.stores) ? message.stores : [],
    recommendation: message.recommendation || null,
    alternatives: Array.isArray(message.alternatives) ? message.alternatives : [],
    sectionTarget: message.sectionTarget || null,
    sectionLabel: message.sectionLabel || null
  };
}

function loadStoredMessages(language) {
  try {
    const rawMessages = window.localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);

    if (!rawMessages) {
      return [createInitialMessage(language)];
    }

    const parsedMessages = JSON.parse(rawMessages);

    if (!Array.isArray(parsedMessages) || !parsedMessages.length) {
      return [createInitialMessage(language)];
    }

    const normalizedMessages = parsedMessages
      .map(normalizeStoredMessage)
      .filter(Boolean)
      .slice(-30);

    return normalizedMessages.length ? normalizedMessages : [createInitialMessage(language)];
  } catch (error) {
    return [createInitialMessage(language)];
  }
}

function getOrCreateChatSessionId() {
  const savedSessionId = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);

  if (savedSessionId) {
    return savedSessionId;
  }

  const generatedSessionId = window.crypto?.randomUUID?.() || `chat-${Date.now()}`;
  window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, generatedSessionId);
  return generatedSessionId;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [chatSessionId] = useState(() => getOrCreateChatSessionId());
  const [language, setLanguage] = useState(() => window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en");
  const uiText = useMemo(() => getUiText(language), [language]);
  const [locationInput, setLocationInput] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(() => loadStoredMessages(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en"));
  const [stores, setStores] = useState([]);
  const [availableStores, setAvailableStores] = useState([]);
  const [recommendedStore, setRecommendedStore] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [preferenceForm, setPreferenceForm] = useState(initialPreferenceForm);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [locationStatus, setLocationStatus] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [notificationFeedback, setNotificationFeedback] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingPendingStoreId, setBookingPendingStoreId] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [requestHistoryLoading, setRequestHistoryLoading] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState(null);
  const [requestDeletingId, setRequestDeletingId] = useState(null);
  const [notifyPendingStoreId, setNotifyPendingStoreId] = useState(null);
  const [adminForm, setAdminForm] = useState(initialAdminForm);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminDeletingId, setAdminDeletingId] = useState(null);
  const [adminImportingPdf, setAdminImportingPdf] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminInsights, setAdminInsights] = useState(null);
  const [adminUsersLoading, setAdminUsersLoading] = useState(true);
  const [adminRequestsLoading, setAdminRequestsLoading] = useState(true);
  const [adminUserDeletingId, setAdminUserDeletingId] = useState(null);
  const [adminRequestDeletingId, setAdminRequestDeletingId] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [highlightedStoreId, setHighlightedStoreId] = useState(null);
  const [floatingChatOpen, setFloatingChatOpen] = useState(false);
  const [pendingStoreFocusId, setPendingStoreFocusId] = useState(null);
  const [pendingSectionFocus, setPendingSectionFocus] = useState(null);
  const chatWindowRef = useRef(null);
  const recognitionRef = useRef(null);
  const storeCardRefs = useRef({});
  const highlightTimeoutRef = useRef(null);
  const homePageRef = useRef(null);
  const storesPageRef = useRef(null);
  const profilePageRef = useRef(null);
  const notificationPageRef = useRef(null);
  const chatPageRef = useRef(null);
  const requestsPageRef = useRef(null);
  const bookingsPageRef = useRef(null);
  const adminPageRef = useRef(null);
  const isAuthenticated = Boolean(user?.email);
  const isAdmin = Boolean(user?.isAdmin || user?.role === "admin");
  const stateCount = getUniqueCount(stores, "state");
  const cityCount = getUniqueCount(stores, "city");
  const unavailableStoresCount = stores.filter((store) => !store.availability).length;
  const openAdminRequestsCount = adminRequests.filter((request) => request.status !== "matched").length;

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages]);

  useEffect(() => {
    if (messages.length === 1 && messages[0].id === "welcome-message") {
      setMessages([createInitialMessage(language)]);
    }
  }, [language]);

  useEffect(() => {
    if (!notificationFeedback?.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotificationFeedback(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notificationFeedback]);

  useEffect(() => (
    () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    }
  ), []);

  useEffect(() => {
    if (!requestFeedback?.message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRequestFeedback(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [requestFeedback]);

  useEffect(() => {
    chatWindowRef.current?.scrollTo({
      top: chatWindowRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, chatLoading, floatingChatOpen, location.pathname]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      recognitionRef.current = null;
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "te" ? "te-IN" : language === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setDraft(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setError(uiText.voiceUnsupported);
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.stop();
    };
  }, [language, uiText.voiceUnsupported]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    try {
      unsubscribe = onFirebaseAuthChange(async (firebaseUser) => {
        if (!active) {
          return;
        }

        if (!firebaseUser) {
          setAuthToken("");
          setUser(null);
          setOtpRequired(false);
          setOtpCode("");
          setProfileLoading(false);
          setAuthInitializing(false);
          window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
          return;
        }

        setProfileLoading(true);

        try {
          const nextAuthToken = await firebaseUser.getIdToken();

          if (!active) {
            return;
          }

          setAuthToken(nextAuthToken);
          await restoreAuthenticatedSession(nextAuthToken, firebaseUser);
        } catch (restoreError) {
          if (!active) {
            return;
          }

          setProfileError(restoreError.message || "Could not restore the saved user profile.");
        } finally {
          if (active) {
            setProfileLoading(false);
            setAuthInitializing(false);
          }
        }
      });
    } catch (authBootstrapError) {
      setProfileError(authBootstrapError.message || "Firebase authentication is not configured.");
      setAuthInitializing(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setError("");

      try {
        const locationContext = buildLocationContext(activeLocation, user);
        const [trackedStores, liveAvailableStores, featuredStore, analytics] = await Promise.all([
          fetchStores(locationContext),
          fetchAvailableStores(locationContext),
          fetchRecommendedStore(locationContext),
          fetchStoreAnalytics(locationContext)
        ]);

        if (!ignore) {
          setStores(trackedStores);
          setAvailableStores(liveAvailableStores);
          setRecommendedStore(featuredStore);
          setTrendData(analytics);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || uiText.messages.dashboardLoadError);
        }
      } finally {
        if (!ignore) {
          setDashboardLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [activeLocation, uiText.messages.dashboardLoadError, user?.latitude, user?.longitude]);

  useEffect(() => {
    let ignore = false;

    async function loadBookingHistory() {
      if (!authToken || !user?.email) {
        setBookingHistory([]);
        return;
      }

      setBookingLoading(true);

      try {
        const bookings = await fetchBookingHistory(authToken);

        if (!ignore) {
          setBookingHistory(bookings);
        }
      } catch (bookingError) {
        if (!ignore) {
          setError(bookingError.message || uiText.messages.bookingLoadError);
        }
      } finally {
        if (!ignore) {
          setBookingLoading(false);
        }
      }
    }

    loadBookingHistory();

    return () => {
      ignore = true;
    };
  }, [authToken, user?.email, uiText.messages.bookingLoadError]);

  useEffect(() => {
    let ignore = false;

    async function loadRequestHistory() {
      if (!authToken || !user?.email) {
        setRequestHistory([]);
        return;
      }

      setRequestHistoryLoading(true);

      try {
        const requests = await fetchRequestHistory(authToken);

        if (!ignore) {
          setRequestHistory(dedupeStoreRequests(requests));
        }
      } catch (requestError) {
        if (!ignore) {
          setRequestFeedback({
            type: "error",
            message: requestError.message || "Unable to load your LPG requests right now."
          });
        }
      } finally {
        if (!ignore) {
          setRequestHistoryLoading(false);
        }
      }
    }

    loadRequestHistory();

    return () => {
      ignore = true;
    };
  }, [authToken, user?.email]);

  useEffect(() => {
    let ignore = false;

    async function loadAdminInsights() {
      if (!authToken || !user?.email || !isAdmin) {
        if (!ignore) {
          setAdminUsers([]);
          setAdminRequests([]);
          setAdminInsights(null);
          setAdminUsersLoading(false);
          setAdminRequestsLoading(false);
          setAdminError("");
        }
        return;
      }

      setAdminUsersLoading(true);
      setAdminRequestsLoading(true);

      try {
        const [usersPayload, requestsPayload, insightsPayload] = await Promise.all([
          fetchAdminUsers(authToken),
          fetchAdminRequests(authToken),
          fetchAdminInsights(authToken)
        ]);

        if (!ignore) {
          setAdminUsers(usersPayload.users || []);
          setAdminRequests(requestsPayload.requests || []);
          setAdminInsights(insightsPayload);
        }
      } catch (loadError) {
        if (!ignore) {
          setAdminError(loadError.message || "Unable to load admin insights right now.");
        }
      } finally {
        if (!ignore) {
          setAdminUsersLoading(false);
          setAdminRequestsLoading(false);
        }
      }
    }

    loadAdminInsights();

    return () => {
      ignore = true;
    };
  }, [authToken, isAdmin, user?.email]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setFloatingChatOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const sectionMap = {
      home: homePageRef,
      profile: profilePageRef,
      alerts: notificationPageRef,
      chat: chatPageRef,
      stores: storesPageRef,
      requests: requestsPageRef,
      bookings: bookingsPageRef,
      admin: adminPageRef
    };

    if (!pendingSectionFocus) {
      return;
    }

    const targetRef = sectionMap[pendingSectionFocus];

    if (targetRef?.current) {
      targetRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      setPendingSectionFocus(null);
    }
  }, [pendingSectionFocus, location.pathname, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!pendingStoreFocusId) {
      return;
    }

    const targetCard = storeCardRefs.current[pendingStoreFocusId];

    if (!targetCard) {
      return;
    }

    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    setHighlightedStoreId(pendingStoreFocusId);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedStoreId(null);
    }, 2200);

    setPendingStoreFocusId(null);
  }, [pendingStoreFocusId, location.pathname, stores.length]);

  function handleProfileInputChange(event) {
    const { name, value } = event.target;
    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  }

  function handlePreferenceChange(event) {
    const { name, type, checked, value } = event.target;
    setPreferenceForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function handleAdminInputChange(event) {
    const { name, type, checked, value } = event.target;
    setAdminForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function refreshDashboard(preferredRecommendation = null) {
    const locationContext = buildLocationContext(activeLocation, user);
    const [trackedStores, liveAvailableStores, featuredStore, analytics] = await Promise.all([
      fetchStores(locationContext),
      fetchAvailableStores(locationContext),
      fetchRecommendedStore(locationContext),
      fetchStoreAnalytics(locationContext)
    ]);

    setStores(trackedStores);
    setAvailableStores(liveAvailableStores);
    setRecommendedStore(preferredRecommendation || featuredStore);
    setTrendData(analytics);
  }

  async function refreshAdminInsights(activeUser = user) {
    if (!authToken || !activeUser?.email || !(activeUser?.isAdmin || activeUser?.role === "admin")) {
      setAdminUsers([]);
      setAdminRequests([]);
      setAdminInsights(null);
      return;
    }

    const [usersPayload, requestsPayload, insightsPayload] = await Promise.all([
      fetchAdminUsers(authToken),
      fetchAdminRequests(authToken),
      fetchAdminInsights(authToken)
    ]);

    setAdminUsers(usersPayload.users || []);
    setAdminRequests(requestsPayload.requests || []);
    setAdminInsights(insightsPayload);
  }

  async function refreshRequestHistory(activeEmail = user?.email) {
    if (!activeEmail || !authToken) {
      setRequestHistory([]);
      return;
    }

    const requests = await fetchRequestHistory(authToken);
    setRequestHistory(dedupeStoreRequests(requests));
  }

  function applyAuthenticatedUserState(resolvedUser, noticeMessage = "") {
    if (!resolvedUser) {
      return;
    }

    setProfileError("");
    setUser(resolvedUser);
    setProfileForm({
      name: resolvedUser.name || "",
      email: resolvedUser.email || "",
      phone: resolvedUser.phone || "",
      address: resolvedUser.address || "",
      password: ""
    });
    setPreferenceForm(buildPreferenceForm(resolvedUser));
    setLanguage(resolvedUser.preferredLanguage || language);
    setOtpRequired(false);
    setOtpCode("");
    window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, resolvedUser.email);

    if (noticeMessage) {
      setProfileNotice(noticeMessage);
    }
  }

  function applyPendingOtpState(sessionUser, noticeMessage = "") {
    setUser(null);
    setOtpRequired(true);
    setOtpCode("");
    setProfileForm((currentForm) => ({
      ...currentForm,
      name: sessionUser?.name || currentForm.name,
      email: sessionUser?.email || currentForm.email,
      phone: sessionUser?.phone || currentForm.phone,
      address: sessionUser?.address || currentForm.address,
      password: currentForm.password
    }));
    setPreferenceForm(buildPreferenceForm(sessionUser));

    if (noticeMessage) {
      setProfileNotice(noticeMessage);
    }
  }

  async function requestAndSyncLocation(nextAuthToken, currentUser) {
    if (!nextAuthToken || !currentUser || currentUser.latitude != null || currentUser.longitude != null) {
      return currentUser;
    }

    if (!navigator.geolocation) {
      setLocationStatus(uiText.profile.locationUnsupported || "Location access is not supported on this device.");
      return currentUser;
    }

    setLocationStatus(uiText.profile.locationPending || "Requesting location permission...");

    try {
      const coordinates = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          (error) => reject(error),
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 5 * 60 * 1000
          }
        );
      });
      const syncedSession = await syncAuthenticatedUser(nextAuthToken, {
        preferredLanguage: currentUser.preferredLanguage || language,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      });

      if (syncedSession?.user) {
        setLocationStatus(uiText.profile.locationSuccess || "Location saved for better nearby LPG recommendations.");
        return syncedSession.user;
      }
    } catch (locationError) {
      console.warn("[app] Location sync skipped:", locationError.message);
      setLocationStatus(uiText.profile.locationSkipped || "Location permission was skipped. You can still search manually.");
    }

    return currentUser;
  }

  async function restoreAuthenticatedSession(nextAuthToken, firebaseUser) {
    const existingSession = await fetchAuthSession(nextAuthToken);
    const hydratedSession = existingSession?.user
      ? existingSession
      : await syncAuthenticatedUser(nextAuthToken, {
        name: firebaseUser.displayName || profileForm.name,
        phone: profileForm.phone,
        address: profileForm.address,
        preferredLanguage: language
      });

    if (hydratedSession?.requiresOtp && !hydratedSession?.otpVerified) {
      applyPendingOtpState(hydratedSession.user || {
        name: firebaseUser.displayName || profileForm.name,
        email: firebaseUser.email || profileForm.email,
        phone: profileForm.phone,
        address: profileForm.address
      }, uiText.profile.otpNotice || "Enter the OTP sent to your email to continue.");
      return null;
    }

    if (!hydratedSession?.user) {
      return null;
    }

    const syncedUserWithLocation = await requestAndSyncLocation(nextAuthToken, hydratedSession.user);
    applyAuthenticatedUserState(syncedUserWithLocation);
    await refreshAdminInsights(syncedUserWithLocation);
    return syncedUserWithLocation;
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");
    setProfileNotice("");
    setLocationStatus("");

    if (!isValidEmailFormat(profileForm.email)) {
      setProfileError(uiText.messages.invalidEmail);
      return;
    }

    if (!profileForm.password || profileForm.password.length < 6) {
      setProfileError(uiText.profile.passwordValidation || "Password must be at least 6 characters.");
      return;
    }

    if (authMode === "register" && !profileForm.name.trim()) {
      setProfileError(uiText.profile.fullNamePlaceholder || "Name is required for registration.");
      return;
    }

    if (authMode === "register" && profileForm.phone && !isValidPhoneFormat(profileForm.phone)) {
      setProfileError(uiText.messages.invalidPhone);
      return;
    }

    setProfileLoading(true);

    try {
      const firebaseUser = authMode === "register"
        ? await registerWithEmailPassword({
          email: profileForm.email.trim(),
          password: profileForm.password,
          displayName: profileForm.name.trim()
        })
        : await loginWithEmailPassword({
          email: profileForm.email.trim(),
          password: profileForm.password
        });
      const nextAuthToken = await getFirebaseIdToken(true);

      if (!nextAuthToken) {
        throw new Error(uiText.profile.sessionError || "Unable to create a secure session.");
      }

      setAuthToken(nextAuthToken);
      const session = await syncAuthenticatedUser(nextAuthToken, {
        ...profileForm,
        preferredLanguage: language,
        sendProfileEmails: true,
        authFlow: authMode
      });

      if (session?.requiresOtp && !session?.otpVerified) {
        applyPendingOtpState(session.user, uiText.profile.otpNotice || "Enter the OTP sent to your email to continue.");
        await sendOtpCode(nextAuthToken);
        setProfileNotice(uiText.profile.otpSent || "OTP sent to your email.");
        navigate("/profile", { replace: true });
        return;
      } else if (session?.user) {
        const userWithLocation = await requestAndSyncLocation(nextAuthToken, session.user);
        applyAuthenticatedUserState(
          userWithLocation,
          `Hello ${getPreferredDisplayName(userWithLocation, profileForm)}, welcome back 👋`
        );
        await refreshAdminInsights(userWithLocation);
      } else {
        throw new Error(uiText.messages.noUserReturned);
      }

      const redirectPath = typeof location.state?.from === "string" ? location.state.from : "/";
      navigate(redirectPath, { replace: true });
    } catch (submitError) {
      setProfileError(submitError.message || uiText.messages.profileSubmitError);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setProfileError("");
    setProfileNotice("");
    setLocationStatus("");
    setGoogleLoading(true);

    try {
      const firebaseUser = await loginWithGoogle();
      const nextAuthToken = await getFirebaseIdToken(true);

      if (!nextAuthToken) {
        throw new Error(uiText.profile.sessionError || "Unable to create a secure session.");
      }

      setAuthToken(nextAuthToken);
      const session = await syncAuthenticatedUser(nextAuthToken, {
        name: firebaseUser.displayName || profileForm.name,
        phone: profileForm.phone,
        address: profileForm.address,
        preferredLanguage: language,
        sendProfileEmails: true,
        authFlow: "google"
      });

      if (!session?.user) {
        throw new Error(uiText.messages.noUserReturned);
      }

      const userWithLocation = await requestAndSyncLocation(nextAuthToken, session.user);
      applyAuthenticatedUserState(
        userWithLocation,
        `Hello ${getPreferredDisplayName(userWithLocation, profileForm)}, welcome back 👋`
      );
      await refreshAdminInsights(userWithLocation);

      const redirectPath = typeof location.state?.from === "string" ? location.state.from : "/";
      navigate(redirectPath, { replace: true });
    } catch (googleError) {
      setProfileError(googleError.message || uiText.profile.googleError || "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!authToken || otpSending) {
      return;
    }

    setOtpSending(true);
    setProfileError("");

    try {
      await sendOtpCode(authToken);
      setProfileNotice(uiText.profile.otpSent || "OTP sent to your email.");
    } catch (otpError) {
      setProfileError(otpError.message || uiText.profile.otpError || "Unable to send OTP right now.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (!authToken || otpVerifying) {
      return;
    }

    if (!/^\d{6}$/.test(String(otpCode).trim())) {
      setProfileError(uiText.profile.invalidOtp || "Please enter a valid 6-digit OTP.");
      return;
    }

    setOtpVerifying(true);
    setProfileError("");

    try {
      const verification = await verifyOtpCode(authToken, {
        otp: String(otpCode).trim(),
        preferredLanguage: language
      });

      if (!verification?.user) {
        throw new Error(uiText.messages.noUserReturned);
      }

      const userWithLocation = await requestAndSyncLocation(authToken, verification.user);
      applyAuthenticatedUserState(
        userWithLocation,
        `Hello ${getPreferredDisplayName(userWithLocation, profileForm)}, welcome back 👋`
      );
      await refreshAdminInsights(userWithLocation);

      const redirectPath = typeof location.state?.from === "string" ? location.state.from : "/";
      navigate(redirectPath, { replace: true });
    } catch (otpError) {
      setProfileError(otpError.message || uiText.profile.otpVerifyError || "Unable to verify OTP right now.");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handlePreferenceSubmit(event) {
    event.preventDefault();
    if (preferenceSaving) {
      return;
    }

    setNotificationFeedback(null);

    if (!user?.email || !authToken) {
      setNotificationFeedback({
        type: "error",
        message: uiText.notification.connectionError
      });
      return;
    }

    if (!isPositiveNumberOrEmpty(preferenceForm.maxPrice)) {
      setNotificationFeedback({
        type: "error",
        message: uiText.notification.invalidPrice
      });
      return;
    }

    if (!isPositiveNumberOrEmpty(preferenceForm.maxDistance)) {
      setNotificationFeedback({
        type: "error",
        message: uiText.notification.invalidDistance
      });
      return;
    }

    setPreferenceSaving(true);

    try {
      const updatedUser = await updateUserProfile({
        email: user.email,
        maxPrice: preferenceForm.maxPrice,
        maxDistance: preferenceForm.maxDistance,
        notificationsEnabled: preferenceForm.notificationsEnabled,
        preferredLanguage: language
      }, authToken);

      if (!updatedUser) {
        throw new Error(uiText.messages.noUpdatedProfile);
      }

      setProfileError("");
      setUser(updatedUser);
      setPreferenceForm(buildPreferenceForm(updatedUser));
      setLanguage(updatedUser.preferredLanguage || language);
      setNotificationFeedback({
        type: "success",
        message: uiText.notification.saved
      });
    } catch (submitError) {
      setNotificationFeedback({
        type: "error",
        message: uiText.notification.connectionError
      });
    } finally {
      setPreferenceSaving(false);
    }
  }

  function handleProfileReset() {
    logoutFirebaseUser().catch((logoutError) => {
      console.warn("[app] Failed to sign out Firebase session:", logoutError.message);
    });
    setAuthToken("");
    setAuthMode("login");
    setOtpRequired(false);
    setOtpCode("");
    setGoogleLoading(false);
    setUser(null);
    setProfileForm(initialProfileForm);
    setPreferenceForm(initialPreferenceForm);
    setProfileError("");
    setProfileNotice("");
    setLocationStatus("");
    setNotificationFeedback(null);
    setBookingHistory([]);
    setRequestHistory([]);
    setRequestFeedback(null);
    setRequestDeletingId(null);
    setNotifyPendingStoreId(null);
    setAdminUsers([]);
    setAdminRequests([]);
    setAdminInsights(null);
    setAdminError("");
    setAdminNotice("");
    setMessages([createInitialMessage(language)]);
    setDraft("");
    window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
    window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
    navigate("/profile", { replace: true });
  }

  function handleLocationFilterSubmit(event) {
    event.preventDefault();
    setActiveLocation(locationInput.trim());
  }

  function handleLocationFilterReset() {
    setLocationInput("");
    setActiveLocation("");
  }

  async function handleImportPdf(file) {
    if (!isAdmin || !user?.email || !authToken || adminImportingPdf) {
      setAdminError(uiText.admin.accessDenied);
      return;
    }

    setAdminImportingPdf(true);
    setAdminError("");
    setAdminNotice("");

    try {
      const importResponse = await importStoresFromPdf(file, authToken);
      await refreshDashboard();
      await refreshRequestHistory();
      await refreshAdminInsights();
      setAdminNotice(
        importResponse?.message
          || (uiText.admin.importSuccess ? uiText.admin.importSuccess(importResponse?.importedCount || 0) : "LPG PDF imported successfully.")
      );
      setEditingStoreId(null);
      setAdminForm(initialAdminForm);
    } catch (importError) {
      setAdminError(importError.message || "Unable to import LPG PDF data right now.");
      throw importError;
    } finally {
      setAdminImportingPdf(false);
    }
  }

  async function handleRequestStore(store) {
    if (!user?.email || !authToken) {
      navigate("/profile", { state: { reason: "login", from: location.pathname }, replace: true });
      return;
    }

    setBookingPendingStoreId(store.id);
    setError("");

    try {
      const savedBooking = await createBooking({
        storeId: store.id,
        quantity: 1
      }, authToken);
      if (savedBooking) {
        setBookingHistory((currentBookings) => [savedBooking, ...currentBookings.filter((booking) => booking.id !== savedBooking.id)]);
      }
      setProfileNotice(uiText.bookingSuccess);
    } catch (requestError) {
      setError(requestError.message || uiText.messages.bookingLoadError);
    } finally {
      setBookingPendingStoreId(null);
    }
  }

  async function handleNotifyWhenAvailable(store) {
    if (!user?.email || !authToken) {
      navigate("/profile", { state: { reason: "login", from: location.pathname }, replace: true });
      return;
    }

    setRequestFeedback(null);
    setNotifyPendingStoreId(store.id);

    try {
      const savedRequest = await createRequestAlert({
        storeId: store.id
      }, authToken);

      if (!savedRequest) {
        throw new Error(uiText.messages.noRequestReturned);
      }

      setRequestHistory((currentRequests) => dedupeStoreRequests([savedRequest, ...currentRequests]));
      refreshAdminInsights().catch(() => {
        // Keep request creation responsive even if admin widgets fail to refresh.
      });
      setRequestFeedback({
        type: "success",
        message: savedRequest.duplicate
          ? uiText.requestAlreadyTracking
          : uiText.requestNotifySuccess
      });
    } catch (requestError) {
      setRequestFeedback({
        type: "error",
        message: requestError.message || uiText.requestSaveError
      });
    } finally {
      setNotifyPendingStoreId(null);
    }
  }

  async function handleRemoveRequest(requestId) {
    if (!user?.email || !authToken || !requestId || requestDeletingId) {
      return;
    }

    setRequestDeletingId(requestId);
    setRequestFeedback(null);

    try {
      await deleteRequestAlert(requestId, authToken);
      setRequestHistory((currentRequests) => currentRequests.filter((request) => request.id !== requestId));
      await refreshAdminInsights();
      setRequestFeedback({
        type: "success",
        message: uiText.requestRemoved
      });
    } catch (requestError) {
      setRequestFeedback({
        type: "error",
        message: requestError.message || uiText.requestRemoveError
      });
    } finally {
      setRequestDeletingId(null);
    }
  }

  function handleEditStore(store) {
    setEditingStoreId(store.id);
    setAdminForm(buildAdminForm(store));
    setAdminNotice("");
    setAdminError("");
  }

  function handleCancelAdminEdit() {
    setEditingStoreId(null);
    setAdminForm(initialAdminForm);
    setAdminError("");
  }

  async function handleAdminSubmit(event) {
    event.preventDefault();

    if (!isAdmin || !user?.email || !authToken) {
      setAdminError(uiText.admin.accessDenied);
      return;
    }

    setAdminSaving(true);
    setAdminError("");
    setAdminNotice("");

    try {
      const payload = {
        ...adminForm,
        distance: Number(adminForm.distance),
        price: Number(adminForm.price),
        stockCount: Number(adminForm.stockCount)
      };

      if (editingStoreId) {
        await updateStoreRecord(editingStoreId, payload, authToken);
      } else {
        await createStoreRecord(payload, authToken);
      }

      await refreshDashboard();
      await refreshRequestHistory();
      await refreshAdminInsights();
      setAdminNotice(
        editingStoreId
          ? uiText.admin.storeUpdated
          : uiText.admin.storeAdded
      );
      setEditingStoreId(null);
      setAdminForm(initialAdminForm);
    } catch (saveError) {
      setAdminError(saveError.message || uiText.messages.adminSaveError);
    } finally {
      setAdminSaving(false);
    }
  }

  async function handleDeleteStore(store) {
    if (!isAdmin || !user?.email || !authToken) {
      setAdminError(uiText.admin.accessDenied);
      return;
    }

    const shouldDelete = window.confirm(uiText.admin.deleteStoreConfirm(store.name));

    if (!shouldDelete) {
      return;
    }

    setAdminDeletingId(store.id);
    setAdminError("");
    setAdminNotice("");

    try {
      await deleteStoreRecord(store.id, authToken);
      await refreshDashboard();
      await refreshRequestHistory();
      await refreshAdminInsights();
      setAdminNotice(uiText.admin.storeDeleted);

      if (editingStoreId === store.id) {
        setEditingStoreId(null);
        setAdminForm(initialAdminForm);
      }
    } catch (deleteError) {
      setAdminError(deleteError.message || uiText.messages.adminDeleteError);
    } finally {
      setAdminDeletingId(null);
    }
  }

  async function handleDeleteAdminUser(adminUser) {
    if (!isAdmin || !user?.email || !authToken) {
      setAdminError(uiText.admin.accessDenied);
      return;
    }

    const shouldDelete = window.confirm(uiText.admin.deleteUserConfirm(adminUser.email));

    if (!shouldDelete) {
      return;
    }

    setAdminUserDeletingId(adminUser.id);
    setAdminError("");
    setAdminNotice("");

    try {
      await deleteAdminUser(adminUser.id, authToken);
      setAdminUsers((currentUsers) => currentUsers.filter((userItem) => userItem.id !== adminUser.id));
      await refreshAdminInsights();
      setAdminNotice(uiText.admin.userDeleted);

      if (user?.id === adminUser.id) {
        handleProfileReset();
      }
    } catch (deleteError) {
      setAdminError(deleteError.message || uiText.admin.userDeleteError);
    } finally {
      setAdminUserDeletingId(null);
    }
  }

  async function handleDeleteAdminRequest(adminRequest) {
    if (!isAdmin || !user?.email || !authToken) {
      setAdminError(uiText.admin.accessDenied);
      return;
    }

    const shouldDelete = window.confirm(uiText.admin.deleteRequestConfirm);

    if (!shouldDelete) {
      return;
    }

    setAdminRequestDeletingId(adminRequest.id);
    setAdminError("");
    setAdminNotice("");

    try {
      await deleteAdminRequest(adminRequest.id, authToken);
      setAdminRequests((currentRequests) => currentRequests.filter((requestItem) => requestItem.id !== adminRequest.id));
      await refreshAdminInsights();
      setAdminNotice(uiText.admin.requestDeleted);

      if (user?.email && adminRequest.userEmail === user.email) {
        await refreshRequestHistory();
      }
    } catch (deleteError) {
      setAdminError(deleteError.message || uiText.admin.requestDeleteError);
    } finally {
      setAdminRequestDeletingId(null);
    }
  }

  async function submitMessage(message) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    if (!user?.email || !authToken) {
      navigate("/profile", { state: { reason: "login", from: location.pathname }, replace: true });
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedMessage,
      explanation: null,
      stores: [],
      recommendation: null,
      alternatives: [],
      sectionTarget: null,
      sectionLabel: null
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraft("");
    setChatLoading(true);
    setError("");

    try {
      const response = await sendChatMessage({
        message: trimmedMessage,
        location: activeLocation,
        language,
        userEmail: user?.email || null,
        sessionId: chatSessionId,
        authToken
      });

      const botMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: response?.reply || uiText.messages.noAssistantResponse,
        explanation: response?.explanation || null,
        stores: Array.isArray(response?.stores) ? response.stores : [],
        recommendation: response?.recommendation || null,
        alternatives: Array.isArray(response?.alternatives) ? response.alternatives : [],
        sectionTarget: response?.sectionTarget || null,
        sectionLabel: response?.sectionLabel || null
      };

      setMessages((currentMessages) => [...currentMessages, botMessage]);
      await refreshDashboard(response?.recommendation || null);

      if (response?.sectionTarget) {
        window.setTimeout(() => {
          handleOpenSection(response.sectionTarget);
        }, 180);
      }
    } catch (submitError) {
      setError(submitError.message || uiText.messages.chatError);
    } finally {
      setChatLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitMessage(draft);
  }

  function handleVoiceInput() {
    if (!voiceSupported || !recognitionRef.current) {
      setError(uiText.voiceUnsupported);
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      return;
    }

    recognitionRef.current.start();
  }

  function registerStoreCardRef(storeId, element) {
    if (!storeId) {
      return;
    }

    if (element) {
      storeCardRefs.current[storeId] = element;
      return;
    }

    delete storeCardRefs.current[storeId];
  }

  function handleOpenStoreFromResponse(store) {
    const storeId = store?.id;

    if (!storeId) {
      return;
    }

    setPendingStoreFocusId(storeId);

    if (location.pathname !== "/" && location.pathname !== "/chat") {
      navigate("/");
    }
  }

  function handleOpenSection(sectionTarget) {
    const sectionMap = {
      home: { route: "/", focus: "home" },
      profile: { route: "/profile", focus: "profile" },
      alerts: { route: "/profile", focus: "alerts" },
      chat: { route: "/chat", focus: "chat" },
      stores: { route: "/", focus: "stores" },
      requests: { route: "/requests", focus: "requests" },
      bookings: { route: "/bookings", focus: "bookings" },
      admin: { route: "/admin", focus: "admin" }
    };

    const target = sectionMap[sectionTarget] || sectionMap.home;
    setPendingSectionFocus(target.focus);
    navigate(target.route);
  }

  const requestStatusByStoreId = useMemo(() => (
    requestHistory.reduce((statusMap, request) => {
      if (request.storeId) {
        statusMap[request.storeId] = request.status;
      }

      return statusMap;
    }, {})
  ), [requestHistory]);

  const bookingStatusByStoreId = useMemo(() => (
    bookingHistory.reduce((statusMap, booking) => {
      if (booking.storeId) {
        statusMap[booking.storeId] = booking.status || "requested";
      }

      return statusMap;
    }, {})
  ), [bookingHistory]);

  const topBanner = error
    ? <div className="banner banner--error">{error}</div>
    : null;

  const loginRedirectNotice = location.pathname === "/profile" && location.state?.reason === "login";

  const heroSection = (
    <section ref={homePageRef} className="hero-panel hero-panel--page">
      <div className="hero-panel__content">
        <h1>{uiText.heroTitle}</h1>
        <p className="hero-panel__copy">{uiText.heroCopy}</p>
      </div>

      <form className="hero-panel__filters" onSubmit={handleLocationFilterSubmit}>
        <label htmlFor="location">{uiText.filterLabel}</label>
        <input
          id="location"
          type="text"
          placeholder={uiText.filterPlaceholder}
          value={locationInput}
          onChange={(event) => setLocationInput(event.target.value)}
        />
        <div className="hero-panel__filter-actions">
          <button type="submit">{uiText.applyFilter}</button>
          <button type="button" className="hero-panel__secondary-button" onClick={handleLocationFilterReset}>
            {uiText.clearFilter}
          </button>
        </div>
        <p>
          {activeLocation
            ? uiText.activeFilter(activeLocation)
            : uiText.filterTip}
        </p>
      </form>
    </section>
  );

  const dashboardSummaries = (
    <section className="dashboard-grid">
      <article className="summary-card">
        <p className="summary-card__label">{uiText.summaryRecommended}</p>
        {dashboardLoading ? (
          <div className="summary-card__loading">
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--text" />
            <div className="skeleton skeleton--text" />
          </div>
        ) : recommendedStore ? (
          <>
            <h2>{recommendedStore.name}</h2>
            <p>
              {[recommendedStore.city, recommendedStore.state].filter(Boolean).join(", ")} | {recommendedStore.location} | {recommendedStore.distanceFromUser ?? recommendedStore.distance} km | Rs. {recommendedStore.price}
            </p>
            <p className="summary-card__detail">
              {uiText.stockLabel}: {typeof recommendedStore.stockCount === "number" ? `${recommendedStore.stockCount} ${uiText.cylinders}` : uiText.available}
            </p>
            {recommendedStore.prediction && (
              <p className="summary-card__detail">{uiText.predictionLabel}: {recommendedStore.prediction}</p>
            )}
          </>
        ) : (
          <>
            <h2>{uiText.noStockTitle}</h2>
            <p>{uiText.noStockCopy}</p>
          </>
        )}
      </article>
      <article className="summary-card">
        <p className="summary-card__label">{uiText.summaryLive}</p>
        <h2>{dashboardLoading ? "..." : availableStores.length}</h2>
        <p>{uiText.liveStoresCopy(activeLocation)}</p>
      </article>

      <article className="summary-card">
        <p className="summary-card__label">{uiText.summaryTracked}</p>
        <h2>{dashboardLoading ? "..." : stores.length}</h2>
        <p>{uiText.trackedCopy(activeLocation)}</p>
        {!dashboardLoading && !!stores.length && (
          <p className="summary-card__detail">{stateCount} states | {cityCount} cities</p>
        )}
      </article>
    </section>
  );

  const storeBoardElement = (
    <div ref={storesPageRef}>
      <StoreBoard
        uiText={uiText}
        activeLocation={activeLocation}
        dashboardLoading={dashboardLoading}
        stores={stores}
        stateCount={stateCount}
        cityCount={cityCount}
        recommendedStore={recommendedStore}
        highlightedStoreId={highlightedStoreId}
        registerStoreCardRef={registerStoreCardRef}
        onRequestStore={handleRequestStore}
        bookingStatusByStoreId={bookingStatusByStoreId}
        bookingPendingStoreId={bookingPendingStoreId}
        onNotifyStore={handleNotifyWhenAvailable}
        notifyPendingStoreId={notifyPendingStoreId}
        requestStatusByStoreId={requestStatusByStoreId}
        language={language}
      />
    </div>
  );

  const chatWorkspaceElement = (
    <div ref={chatPageRef}>
      <ChatWorkspace
        uiText={uiText}
        language={language}
        messages={messages}
        chatLoading={chatLoading}
        chatWindowRef={chatWindowRef}
        isAuthenticated={isAuthenticated}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        onSelectQuickAction={submitMessage}
        onVoiceInput={handleVoiceInput}
        voiceSupported={voiceSupported}
        listening={listening}
        onOpenSection={handleOpenSection}
        onOpenStore={handleOpenStoreFromResponse}
        onRequestStore={handleRequestStore}
        bookingStatusByStoreId={bookingStatusByStoreId}
        bookingPendingStoreId={bookingPendingStoreId}
        onNotifyStore={handleNotifyWhenAvailable}
        notifyPendingStoreId={notifyPendingStoreId}
        requestStatusByStoreId={requestStatusByStoreId}
      />
    </div>
  );

  const adminHeader = (
    <section ref={adminPageRef} className="admin-workspace-hero">
      <div>
        <p className="analytics-panel__eyebrow">{uiText.adminPortalLabel || "Admin Portal"}</p>
        <h2>{uiText.admin.portalTitle || "Admin control center"}</h2>
        <p className="admin-workspace-hero__copy">
          {uiText.admin.portalCopy || "Manage LPG branches, imports, users, requests, and platform insights from a dedicated operations workspace."}
        </p>
      </div>
      <div className="admin-workspace-hero__badge">{user?.email}</div>
    </section>
  );

  const adminSummaries = (
    <section className="dashboard-grid dashboard-grid--admin">
      <article className="summary-card summary-card--admin">
        <p className="summary-card__label">{uiText.admin.trackedStoresLabel || "Tracked Stores"}</p>
        <h2>{dashboardLoading ? "..." : stores.length}</h2>
        <p>{uiText.trackedCopy(activeLocation)}</p>
      </article>
      <article className="summary-card summary-card--admin">
        <p className="summary-card__label">{uiText.admin.availableStoresLabel || "Available Now"}</p>
        <h2>{dashboardLoading ? "..." : availableStores.length}</h2>
        <p>{uiText.liveStoresCopy(activeLocation)}</p>
      </article>
      <article className="summary-card summary-card--admin">
        <p className="summary-card__label">{uiText.admin.outOfStockLabel || "Out of Stock"}</p>
        <h2>{dashboardLoading ? "..." : unavailableStoresCount}</h2>
        <p>{stateCount} states | {cityCount} cities</p>
      </article>
      <article className="summary-card summary-card--admin">
        <p className="summary-card__label">{uiText.admin.registeredUsersLabel || "Registered Users"}</p>
        <h2>{adminUsersLoading ? "..." : adminUsers.length}</h2>
        <p>{uiText.admin.totalUsersCount ? uiText.admin.totalUsersCount(adminUsers.length) : `${adminUsers.length} users`}</p>
      </article>
      <article className="summary-card summary-card--admin">
        <p className="summary-card__label">{uiText.admin.activeRequestsLabel || "Open Requests"}</p>
        <h2>{adminRequestsLoading ? "..." : openAdminRequestsCount}</h2>
        <p>{uiText.admin.requestCount ? uiText.admin.requestCount(adminRequests.length) : `${adminRequests.length} requests`}</p>
      </article>
    </section>
  );

  return (
    <main className="app-shell app-shell--routed">
      <AppNavigation
        uiText={uiText}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        user={user}
        language={language}
        onLanguageChange={setLanguage}
      />

      <div className="app-page">
        {topBanner}
        {adminNotice && location.pathname === "/admin" && <div className="banner banner--success banner--animated">{adminNotice}</div>}
        {adminError && location.pathname === "/admin" && <div className="banner banner--error">{adminError}</div>}

        <Routes>
          <Route
            path="/"
            element={(
              <RequireAuth isAuthenticated={isAuthenticated} authLoading={authInitializing}>
                <HomePage
                  hero={heroSection}
                  summaries={dashboardSummaries}
                  analytics={<AnalyticsPanel stores={stores} loading={dashboardLoading} language={language} />}
                  trends={<TrendCharts trends={trendData} loading={dashboardLoading} language={language} />}
                  storeBoard={storeBoardElement}
                />
              </RequireAuth>
            )}
          />

          <Route
            path="/chat"
            element={(
              <RequireAuth isAuthenticated={isAuthenticated} authLoading={authInitializing}>
                <ChatPage
                  intro={(
                    <section className="page-hero page-hero--chat">
                      <div>
                        <p className="page-hero__eyebrow">{uiText.aiAssistant || "Assistant"}</p>
                        <h1>{uiText.assistantTitle}</h1>
                        <p>{uiText.heroCopy}</p>
                      </div>
                    </section>
                  )}
                  content={(
                    <>
                      {chatWorkspaceElement}
                      {storeBoardElement}
                    </>
                  )}
                />
              </RequireAuth>
            )}
          />

          <Route
            path="/requests"
            element={(
              <RequireAuth isAuthenticated={isAuthenticated} authLoading={authInitializing}>
                <RequestsPage
                  header={(
                    <section ref={requestsPageRef} className="page-hero">
                      <div>
                        <p className="page-hero__eyebrow">{uiText.nav?.requests || "Requests"}</p>
                        <h1>{uiText.requestHistoryTitle}</h1>
                        <p>{uiText.requestHistoryCopy}</p>
                      </div>
                    </section>
                  )}
                  content={(
                    <RequestHistoryPanel
                      user={user}
                      loading={requestHistoryLoading}
                      deletingId={requestDeletingId}
                      requests={requestHistory}
                      feedback={requestFeedback}
                      language={language}
                      onRemove={handleRemoveRequest}
                    />
                  )}
                />
              </RequireAuth>
            )}
          />

          <Route
            path="/bookings"
            element={(
              <RequireAuth isAuthenticated={isAuthenticated} authLoading={authInitializing}>
                <BookingsPage
                  header={(
                    <section ref={bookingsPageRef} className="page-hero">
                      <div>
                        <p className="page-hero__eyebrow">{uiText.nav?.bookings || "Bookings"}</p>
                        <h1>{uiText.requestHistoryTitle}</h1>
                        <p>{uiText.requestHistoryCopy}</p>
                      </div>
                    </section>
                  )}
                  content={(
                    <BookingPanel
                      user={user}
                      loading={bookingLoading}
                      bookings={bookingHistory}
                      language={language}
                    />
                  )}
                />
              </RequireAuth>
            )}
          />

          <Route
            path="/admin"
            element={(
              <RequireAdmin isAuthenticated={isAuthenticated} isAdmin={isAdmin} authLoading={authInitializing}>
                <AdminPage
                  header={adminHeader}
                  summaries={adminSummaries}
                  content={(
                    <AdminPanel
                      language={language}
                      stores={stores}
                      users={adminUsers}
                      requests={adminRequests}
                      insights={adminInsights}
                      usersLoading={adminUsersLoading}
                      requestsLoading={adminRequestsLoading}
                      userDeletingId={adminUserDeletingId}
                      requestDeletingId={adminRequestDeletingId}
                      form={adminForm}
                      saving={adminSaving}
                      deletingId={adminDeletingId}
                      editingStoreId={editingStoreId}
                      importingPdf={adminImportingPdf}
                      onChange={handleAdminInputChange}
                      onImportPdf={handleImportPdf}
                      onSubmit={handleAdminSubmit}
                      onEdit={handleEditStore}
                      onDelete={handleDeleteStore}
                      onCancelEdit={handleCancelAdminEdit}
                      onDeleteUser={handleDeleteAdminUser}
                      onDeleteRequest={handleDeleteAdminRequest}
                    />
                  )}
                />
              </RequireAdmin>
            )}
          />

          <Route
            path="/profile"
            element={(
              <ProfilePage
                header={loginRedirectNotice ? (
                  <section className="login-gate-panel">
                    <div className="banner banner--info banner--animated">
                      <strong>{uiText.loginRequiredPrompt}</strong>
                      <p>{uiText.loginRequiredCopy}</p>
                    </div>
                  </section>
                ) : null}
                content={(
                  <div ref={profilePageRef}>
                    <ProfilePanel
                      form={profileForm}
                      user={user}
                      isAdmin={isAdmin}
                      loading={profileLoading}
                      error={profileError}
                      notice={profileNotice}
                      language={language}
                      authMode={authMode}
                      onAuthModeChange={setAuthMode}
                      onGoogleLogin={handleGoogleLogin}
                      googleLoading={googleLoading}
                      otpRequired={otpRequired}
                      otpCode={otpCode}
                      onOtpChange={setOtpCode}
                      onSendOtp={handleSendOtp}
                      onVerifyOtp={handleVerifyOtp}
                      otpSending={otpSending}
                      otpVerifying={otpVerifying}
                      authGreeting={user ? `Hello ${getPreferredDisplayName(user)}, welcome back 👋` : ""}
                      locationStatus={locationStatus}
                      onChange={handleProfileInputChange}
                      onSubmit={handleProfileSubmit}
                      onReset={handleProfileReset}
                    />
                  </div>
                )}
                alerts={isAuthenticated ? (
                  <div ref={notificationPageRef}>
                    <NotificationSettingsPanel
                      user={user}
                      settings={preferenceForm}
                      saving={preferenceSaving}
                      feedback={notificationFeedback}
                      language={language}
                      onChange={handlePreferenceChange}
                      onSubmit={handlePreferenceSubmit}
                    />
                  </div>
                ) : null}
              />
            )}
          />

          <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/profile"} replace />} />
        </Routes>
      </div>

      {location.pathname !== "/chat" && (
        <FloatingChatbot
          uiText={uiText}
          isOpen={floatingChatOpen}
          onToggle={() => setFloatingChatOpen((currentState) => !currentState)}
          onClose={() => setFloatingChatOpen(false)}
        >
          <ChatWorkspace
            uiText={uiText}
            language={language}
            messages={messages}
            chatLoading={chatLoading}
            chatWindowRef={chatWindowRef}
            isAuthenticated={isAuthenticated}
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleSubmit}
            onSelectQuickAction={submitMessage}
            onVoiceInput={handleVoiceInput}
            voiceSupported={voiceSupported}
            listening={listening}
            onOpenSection={handleOpenSection}
            onOpenStore={handleOpenStoreFromResponse}
            onRequestStore={handleRequestStore}
            bookingStatusByStoreId={bookingStatusByStoreId}
            bookingPendingStoreId={bookingPendingStoreId}
            onNotifyStore={handleNotifyWhenAvailable}
            notifyPendingStoreId={notifyPendingStoreId}
            requestStatusByStoreId={requestStatusByStoreId}
            compact
            onExpand={() => {
              setFloatingChatOpen(false);
              navigate("/chat");
            }}
            onClose={() => setFloatingChatOpen(false)}
          />
        </FloatingChatbot>
      )}
    </main>
  );
}

export default App;
