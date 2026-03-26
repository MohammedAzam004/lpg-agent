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
  fetchRequestHistory,
  fetchRecommendedStore,
  fetchStoreAnalytics,
  fetchStores,
  fetchUserProfile,
  importStoresFromPdf,
  registerOrLoginUser,
  sendChatMessage,
  updateStoreRecord,
  updateUserProfile
} from "./services/api";
import AdminPage from "./pages/AdminPage";
import BookingsPage from "./pages/BookingsPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import RequestsPage from "./pages/RequestsPage";

const USER_EMAIL_STORAGE_KEY = "lpg-smart-user-email";
const USER_PROFILE_STORAGE_KEY = "lpg-smart-user-profile";
const LANGUAGE_STORAGE_KEY = "lpg-smart-language";
const CHAT_SESSION_STORAGE_KEY = "lpg-smart-chat-session";
const CHAT_MESSAGES_STORAGE_KEY = "lpg-smart-chat-messages";

const initialProfileForm = {
  name: "",
  email: "",
  phone: "",
  address: ""
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

function loadStoredUser() {
  try {
    const rawUser = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);

    if (!rawUser) {
      return null;
    }

    const parsedUser = JSON.parse(rawUser);
    return parsedUser && typeof parsedUser === "object" && parsedUser.email ? parsedUser : null;
  } catch (error) {
    return null;
  }
}

function persistStoredUser(user) {
  if (!user?.email) {
    return;
  }

  window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, user.email);
  window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(user));
}

function clearStoredUser() {
  window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
}

function buildProfileForm(user = null) {
  if (!user) {
    return initialProfileForm;
  }

  return {
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    address: user.address || ""
  };
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const storedUser = useMemo(() => loadStoredUser(), []);
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
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(storedUser));
  const [preferenceForm, setPreferenceForm] = useState(() => buildPreferenceForm(storedUser));
  const [user, setUser] = useState(storedUser);
  const [authInitializing, setAuthInitializing] = useState(true);
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
    let ignore = false;

    async function restoreUserProfile() {
      const savedEmail = window.localStorage.getItem(USER_EMAIL_STORAGE_KEY);
      const cachedUser = loadStoredUser();

      if (!savedEmail) {
        if (!ignore) {
          setAuthInitializing(false);
        }
        return;
      }

      if (!ignore && cachedUser?.email) {
        setUser(cachedUser);
        setProfileForm(buildProfileForm(cachedUser));
        setPreferenceForm(buildPreferenceForm(cachedUser));
      }

      setProfileLoading(true);

      try {
        const savedUser = await fetchUserProfile(savedEmail);

        if (!ignore && savedUser) {
          setProfileError("");
          setUser(savedUser);
          setProfileForm(buildProfileForm(savedUser));
          setPreferenceForm(buildPreferenceForm(savedUser));
          setLanguage(savedUser.preferredLanguage || language);
          persistStoredUser(savedUser);
          setProfileNotice(
            getUiText(savedUser.preferredLanguage || language).messages.welcomeBack(savedUser.name)
          );
        } else if (!ignore) {
          clearStoredUser();
          setUser(null);
          setProfileForm(initialProfileForm);
          setPreferenceForm(initialPreferenceForm);
        }
      } catch (restoreError) {
        if (!ignore) {
          console.error("[app] Failed to restore saved profile:", restoreError.message);

          if (!cachedUser?.email) {
            clearStoredUser();
            setProfileError("Unable to restore the saved user profile right now.");
          }
        }
      } finally {
        if (!ignore) {
          setProfileLoading(false);
          setAuthInitializing(false);
        }
      }
    }

    restoreUserProfile();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setError("");

      try {
        const [trackedStores, liveAvailableStores, featuredStore, analytics] = await Promise.all([
          fetchStores(activeLocation),
          fetchAvailableStores(activeLocation),
          fetchRecommendedStore(activeLocation),
          fetchStoreAnalytics(activeLocation)
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
  }, [activeLocation, uiText.messages.dashboardLoadError]);

  useEffect(() => {
    let ignore = false;

    async function loadBookingHistory() {
      if (!user?.email) {
        setBookingHistory([]);
        return;
      }

      setBookingLoading(true);

      try {
        const bookings = await fetchBookingHistory(user.email);

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
  }, [user?.email, uiText.messages.bookingLoadError]);

  useEffect(() => {
    let ignore = false;

    async function loadRequestHistory() {
      if (!user?.email) {
        setRequestHistory([]);
        return;
      }

      setRequestHistoryLoading(true);

      try {
        const requests = await fetchRequestHistory(user.email);

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
  }, [user?.email]);

  useEffect(() => {
    let ignore = false;

    async function loadAdminInsights() {
      if (!user?.email || !isAdmin) {
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
          fetchAdminUsers(user.email),
          fetchAdminRequests(user.email),
          fetchAdminInsights(user.email)
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
  }, [isAdmin, user?.email]);

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
    const [trackedStores, liveAvailableStores, featuredStore, analytics] = await Promise.all([
      fetchStores(activeLocation),
      fetchAvailableStores(activeLocation),
      fetchRecommendedStore(activeLocation),
      fetchStoreAnalytics(activeLocation)
    ]);

    setStores(trackedStores);
    setAvailableStores(liveAvailableStores);
    setRecommendedStore(preferredRecommendation || featuredStore);
    setTrendData(analytics);
  }

  async function refreshAdminInsights(activeUser = user) {
    if (!activeUser?.email || !(activeUser?.isAdmin || activeUser?.role === "admin")) {
      setAdminUsers([]);
      setAdminRequests([]);
      setAdminInsights(null);
      return;
    }

    const [usersPayload, requestsPayload, insightsPayload] = await Promise.all([
      fetchAdminUsers(activeUser.email),
      fetchAdminRequests(activeUser.email),
      fetchAdminInsights(activeUser.email)
    ]);

    setAdminUsers(usersPayload.users || []);
    setAdminRequests(requestsPayload.requests || []);
    setAdminInsights(insightsPayload);
  }

  async function refreshRequestHistory(activeEmail = user?.email) {
    if (!activeEmail) {
      setRequestHistory([]);
      return;
    }

    const requests = await fetchRequestHistory(activeEmail);
    setRequestHistory(dedupeStoreRequests(requests));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError("");
    setProfileNotice("");

    if (!isValidEmailFormat(profileForm.email)) {
      setProfileError(uiText.messages.invalidEmail);
      return;
    }

    if (profileForm.phone && !isValidPhoneFormat(profileForm.phone)) {
      setProfileError(uiText.messages.invalidPhone);
      return;
    }

    setProfileLoading(true);

    try {
      const response = await registerOrLoginUser({
        ...profileForm,
        preferredLanguage: language
      });
      const resolvedUser = response?.user || null;

      if (!resolvedUser) {
        throw new Error(uiText.messages.noUserReturned);
      }

      setProfileError("");
      setUser(resolvedUser);
      setProfileForm(buildProfileForm(resolvedUser));
      setPreferenceForm(buildPreferenceForm(resolvedUser));
      setLanguage(resolvedUser.preferredLanguage || language);
      persistStoredUser(resolvedUser);
      setProfileNotice(
        response?.action === "register"
          ? uiText.messages.welcomeCreated(resolvedUser.name)
          : uiText.messages.welcomeBack(resolvedUser.name)
      );
      await refreshAdminInsights(resolvedUser);

      const redirectPath = typeof location.state?.from === "string" ? location.state.from : "/";
      navigate(redirectPath, { replace: true });
    } catch (submitError) {
      setProfileError(submitError.message || uiText.messages.profileSubmitError);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePreferenceSubmit(event) {
    event.preventDefault();
    if (preferenceSaving) {
      return;
    }

    setNotificationFeedback(null);

    if (!user?.email) {
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
      });

      if (!updatedUser) {
        throw new Error(uiText.messages.noUpdatedProfile);
      }

      setProfileError("");
      setUser(updatedUser);
      setProfileForm(buildProfileForm(updatedUser));
      setPreferenceForm(buildPreferenceForm(updatedUser));
      setLanguage(updatedUser.preferredLanguage || language);
      persistStoredUser(updatedUser);
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
    setUser(null);
    setProfileForm(initialProfileForm);
    setPreferenceForm(initialPreferenceForm);
    setProfileError("");
    setProfileNotice("");
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
    clearStoredUser();
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
    if (!isAdmin || !user?.email || adminImportingPdf) {
      setAdminError(uiText.admin.accessDenied);
      return;
    }

    setAdminImportingPdf(true);
    setAdminError("");
    setAdminNotice("");

    try {
      const importResponse = await importStoresFromPdf(file, user.email);
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
    if (!user?.email) {
      navigate("/profile", { state: { reason: "login", from: location.pathname }, replace: true });
      return;
    }

    setBookingPendingStoreId(store.id);
    setError("");

    try {
      const savedBooking = await createBooking({
        userEmail: user.email,
        storeId: store.id,
        quantity: 1
      });
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
    if (!user?.email) {
      navigate("/profile", { state: { reason: "login", from: location.pathname }, replace: true });
      return;
    }

    setRequestFeedback(null);
    setNotifyPendingStoreId(store.id);

    try {
      const savedRequest = await createRequestAlert({
        email: user.email,
        storeId: store.id
      });

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
    if (!user?.email || !requestId || requestDeletingId) {
      return;
    }

    setRequestDeletingId(requestId);
    setRequestFeedback(null);

    try {
      await deleteRequestAlert(requestId, user.email);
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

    if (!isAdmin || !user?.email) {
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
        await updateStoreRecord(editingStoreId, payload, user.email);
      } else {
        await createStoreRecord(payload, user.email);
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
    if (!isAdmin || !user?.email) {
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
      await deleteStoreRecord(store.id, user.email);
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
    if (!isAdmin || !user?.email) {
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
      await deleteAdminUser(adminUser.id, user.email);
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
    if (!isAdmin || !user?.email) {
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
      await deleteAdminRequest(adminRequest.id, user.email);
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

    if (!user?.email) {
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
        sessionId: chatSessionId
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
              {[recommendedStore.city, recommendedStore.state].filter(Boolean).join(", ")} | {recommendedStore.location} | {recommendedStore.distance} km | Rs. {recommendedStore.price}
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
