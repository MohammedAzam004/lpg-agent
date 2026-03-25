import { useEffect, useMemo, useRef, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import AnalyticsPanel from "./components/AnalyticsPanel";
import ChatMessage from "./components/ChatMessage";
import CylinderLogo from "./components/CylinderLogo";
import NotificationSettingsPanel from "./components/NotificationSettingsPanel";
import ProfilePanel from "./components/ProfilePanel";
import QuickActions from "./components/QuickActions";
import RequestHistoryPanel from "./components/RequestHistoryPanel";
import StoreCard from "./components/StoreCard";
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
  registerOrLoginUser,
  sendChatMessage,
  updateStoreRecord,
  updateUserProfile
} from "./services/api";

const USER_EMAIL_STORAGE_KEY = "lpg-smart-user-email";
const LANGUAGE_STORAGE_KEY = "lpg-smart-language";
const CHAT_SESSION_STORAGE_KEY = "lpg-smart-chat-session";

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
    alternatives: []
  };
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
  const [chatSessionId] = useState(() => getOrCreateChatSessionId());
  const [language, setLanguage] = useState(() => window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en");
  const uiText = useMemo(() => getUiText(language), [language]);
  const [locationInput, setLocationInput] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(() => [createInitialMessage(language)]);
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
  const chatWindowRef = useRef(null);
  const recognitionRef = useRef(null);
  const storeCardRefs = useRef({});
  const highlightTimeoutRef = useRef(null);
  const stateCount = getUniqueCount(stores, "state");
  const cityCount = getUniqueCount(stores, "city");

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

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
  }, [messages, chatLoading]);

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

      if (!savedEmail) {
        return;
      }

      setProfileLoading(true);

      try {
        const savedUser = await fetchUserProfile(savedEmail);

        if (!ignore && savedUser) {
          setProfileError("");
          setUser(savedUser);
          setProfileForm({
            name: savedUser.name,
            email: savedUser.email,
            phone: savedUser.phone,
            address: savedUser.address || ""
          });
          setPreferenceForm(buildPreferenceForm(savedUser));
          setLanguage(savedUser.preferredLanguage || language);
          setProfileNotice(
            getUiText(savedUser.preferredLanguage || language).messages.welcomeBack(savedUser.name)
          );
        } else if (!ignore) {
          window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
        }
      } catch (restoreError) {
        window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);

        if (!ignore) {
          setProfileError(restoreError.message || "Could not restore the saved user profile.");
        }
      } finally {
        if (!ignore) {
          setProfileLoading(false);
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
      setAdminUsersLoading(true);
      setAdminRequestsLoading(true);

      try {
        const [usersPayload, requestsPayload, insightsPayload] = await Promise.all([
          fetchAdminUsers(),
          fetchAdminRequests(),
          fetchAdminInsights()
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
  }, []);

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

  async function refreshAdminInsights() {
    const [usersPayload, requestsPayload, insightsPayload] = await Promise.all([
      fetchAdminUsers(),
      fetchAdminRequests(),
      fetchAdminInsights()
    ]);

    setAdminUsers(usersPayload.users || []);
    setAdminRequests(requestsPayload.requests || []);
    setAdminInsights(insightsPayload);
  }

  async function refreshRequestHistory() {
    if (!user?.email) {
      setRequestHistory([]);
      return;
    }

    const requests = await fetchRequestHistory(user.email);
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
      setProfileForm({
        name: resolvedUser.name,
        email: resolvedUser.email,
        phone: resolvedUser.phone,
        address: resolvedUser.address || ""
      });
      setPreferenceForm(buildPreferenceForm(resolvedUser));
      setLanguage(resolvedUser.preferredLanguage || language);
      window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, resolvedUser.email);
      setProfileNotice(
        response?.action === "register"
          ? uiText.messages.welcomeCreated(resolvedUser.name)
          : uiText.messages.welcomeBack(resolvedUser.name)
      );
      await refreshAdminInsights();
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
    window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  }

  function handleLocationFilterSubmit(event) {
    event.preventDefault();
    setActiveLocation(locationInput.trim());
  }

  function handleLocationFilterReset() {
    setLocationInput("");
    setActiveLocation("");
  }

  async function handleRequestStore(store) {
    if (!user?.email) {
      setProfileError(uiText.loginToRequest);
      return;
    }

    setBookingPendingStoreId(store.id);
    setError("");

    try {
      await createBooking({
        userEmail: user.email,
        storeId: store.id,
        quantity: 1
      });
      setProfileNotice(uiText.bookingSuccess);
      const bookings = await fetchBookingHistory(user.email);
      setBookingHistory(bookings);
    } catch (requestError) {
      setError(requestError.message || uiText.messages.bookingLoadError);
    } finally {
      setBookingPendingStoreId(null);
    }
  }

  async function handleNotifyWhenAvailable(store) {
    if (!user?.email) {
      setProfileError(uiText.loginToRequest);
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
      await refreshAdminInsights();
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
        await updateStoreRecord(editingStoreId, payload);
      } else {
        await createStoreRecord(payload);
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
    const shouldDelete = window.confirm(uiText.admin.deleteStoreConfirm(store.name));

    if (!shouldDelete) {
      return;
    }

    setAdminDeletingId(store.id);
    setAdminError("");
    setAdminNotice("");

    try {
      await deleteStoreRecord(store.id);
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
    const shouldDelete = window.confirm(uiText.admin.deleteUserConfirm(adminUser.email));

    if (!shouldDelete) {
      return;
    }

    setAdminUserDeletingId(adminUser.id);
    setAdminError("");
    setAdminNotice("");

    try {
      await deleteAdminUser(adminUser.id);
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
    const shouldDelete = window.confirm(uiText.admin.deleteRequestConfirm);

    if (!shouldDelete) {
      return;
    }

    setAdminRequestDeletingId(adminRequest.id);
    setAdminError("");
    setAdminNotice("");

    try {
      await deleteAdminRequest(adminRequest.id);
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

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedMessage,
      explanation: null,
      stores: [],
      recommendation: null,
      alternatives: []
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
        alternatives: Array.isArray(response?.alternatives) ? response.alternatives : []
      };

      setMessages((currentMessages) => [...currentMessages, botMessage]);
      await refreshDashboard(response?.recommendation || null);
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
    const targetCard = storeId ? storeCardRefs.current[storeId] : null;

    if (!targetCard) {
      return;
    }

    targetCard.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    setHighlightedStoreId(storeId);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedStoreId(null);
    }, 2200);
  }

  const requestStatusByStoreId = useMemo(() => (
    requestHistory.reduce((statusMap, request) => {
      if (request.storeId) {
        statusMap[request.storeId] = request.status;
      }

      return statusMap;
    }, {})
  ), [requestHistory]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-panel__content">
          <div className="hero-panel__toolbar">
            <CylinderLogo />
            <div className="language-switch">
              <span>{uiText.languageLabel}</span>
              <div className="language-switch__controls">
                <button
                  type="button"
                  className={language === "en" ? "language-switch__button language-switch__button--active" : "language-switch__button"}
                  onClick={() => setLanguage("en")}
                >
                  {uiText.english}
                </button>
                <button
                  type="button"
                  className={language === "hi" ? "language-switch__button language-switch__button--active" : "language-switch__button"}
                  onClick={() => setLanguage("hi")}
                >
                  {uiText.hindi}
                </button>
                <button
                  type="button"
                  className={language === "te" ? "language-switch__button language-switch__button--active" : "language-switch__button"}
                  onClick={() => setLanguage("te")}
                >
                  {uiText.telugu}
                </button>
              </div>
            </div>
          </div>

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

      <ProfilePanel
        form={profileForm}
        user={user}
        loading={profileLoading}
        error={profileError}
        notice={profileNotice}
        language={language}
        onChange={handleProfileInputChange}
        onSubmit={handleProfileSubmit}
        onReset={handleProfileReset}
      />

      <NotificationSettingsPanel
        user={user}
        settings={preferenceForm}
        saving={preferenceSaving}
        feedback={notificationFeedback}
        language={language}
        onChange={handlePreferenceChange}
        onSubmit={handlePreferenceSubmit}
      />

      {error && <div className="banner banner--error">{error}</div>}
      {adminNotice && <div className="banner banner--success banner--animated">{adminNotice}</div>}
      {adminError && <div className="banner banner--error">{adminError}</div>}

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

      <AnalyticsPanel stores={stores} loading={dashboardLoading} language={language} />
      <TrendCharts trends={trendData} loading={dashboardLoading} language={language} />
      <section className="workspace-grid">
        <div className="chat-panel">
          <div className="chat-panel__header">
            <div>
              <p className="chat-panel__eyebrow">Assistant</p>
              <h2>{uiText.assistantTitle}</h2>
            </div>
            <QuickActions onSelect={submitMessage} actions={uiText.quickActions} />
          </div>

          <div ref={chatWindowRef} className="chat-window">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                language={language}
                onOpenStore={handleOpenStoreFromResponse}
                onRequestStore={handleRequestStore}
                requestPendingId={bookingPendingStoreId}
                onNotifyStore={handleNotifyWhenAvailable}
                notifyPendingId={notifyPendingStoreId}
                requestStatusByStoreId={requestStatusByStoreId}
              />
            ))}

            {chatLoading && (
              <div className="chat-message chat-message--bot">
                <div className="chat-message__bubble chat-message__bubble--typing">
                  <p className="chat-message__meta">{uiText.aiAssistant}</p>
                  <div className="typing-indicator" aria-live="polite">
                    <span className="typing-indicator__label">{uiText.typing}</span>
                    <span className="typing-indicator__dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form className="chat-composer" onSubmit={handleSubmit}>
            <button
              type="button"
              className={`chat-composer__voice ${listening ? "chat-composer__voice--active" : ""}`}
              onClick={handleVoiceInput}
              aria-label={listening ? uiText.stopListening : uiText.listen}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 4a3 3 0 0 1 3 3v5a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Zm-6 8a1 1 0 1 1 2 0 4 4 0 1 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.91V21h2a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2h2v-2.09A6 6 0 0 1 6 12Z"
                  fill="currentColor"
                />
              </svg>
            </button>

            <input
              type="text"
              placeholder={uiText.typePlaceholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="chat-composer__send" disabled={chatLoading} aria-label={uiText.sendMessage}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12h11M12 5l7 7-7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </form>

          {voiceSupported && listening && (
            <p className="chat-panel__listening">{uiText.listening}</p>
          )}
        </div>

        <div className="store-panel">
          <div className="store-panel__header">
            <div>
              <p className="store-panel__eyebrow">{uiText.availabilityBoard}</p>
              <h2>{activeLocation ? uiText.storesNear(activeLocation) : uiText.allStores}</h2>
              <p className="store-panel__summary">
                {dashboardLoading ? uiText.loadingBranches : uiText.branchSummary(stores.length, stateCount, cityCount)}
              </p>
            </div>
          </div>

          <div className="store-panel__content">
            {dashboardLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <article key={`store-skeleton-${index}`} className="store-card store-card--skeleton">
                  <div className="skeleton skeleton--title" />
                  <div className="skeleton skeleton--text" />
                  <div className="skeleton skeleton--grid" />
                </article>
              ))
            ) : stores.length ? (
              stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  recommended={recommendedStore?.id === store.id}
                  language={language}
                  storeRef={(element) => registerStoreCardRef(store.id, element)}
                  highlighted={highlightedStoreId === store.id}
                  onRequest={handleRequestStore}
                  requestLoading={bookingPendingStoreId === store.id}
                  onNotify={handleNotifyWhenAvailable}
                  notifyLoading={notifyPendingStoreId === store.id}
                  notifyStatus={requestStatusByStoreId[store.id] || null}
                />
              ))
            ) : (
              <p className="store-panel__empty">{uiText.noStoreMatch}</p>
            )}
          </div>
        </div>
      </section>

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
        onChange={handleAdminInputChange}
        onSubmit={handleAdminSubmit}
        onEdit={handleEditStore}
        onDelete={handleDeleteStore}
        onCancelEdit={handleCancelAdminEdit}
        onDeleteUser={handleDeleteAdminUser}
        onDeleteRequest={handleDeleteAdminRequest}
      />

      <RequestHistoryPanel
        user={user}
        loading={requestHistoryLoading}
        deletingId={requestDeletingId}
        requests={requestHistory}
        feedback={requestFeedback}
        language={language}
        onRemove={handleRemoveRequest}
      />
    </main>
  );
}

export default App;

