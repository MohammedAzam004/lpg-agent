const DEFAULT_DEPLOYED_API_BASE_URL = "https://lpg-agent.onrender.com";
const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:5001";
const AUTH_TOKEN_STORAGE_KEY = "lpg-smart-session-token";

function normalizeBaseUrl(value) {
  return value?.replace(/\/+$/, "") || "";
}

function resolveApiBaseUrl() {
  const configuredApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return DEFAULT_LOCAL_API_BASE_URL;
    }
  }

  return DEFAULT_DEPLOYED_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

function getStoredSessionToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
}

function setStoredSessionToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

function clearStoredSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

async function fetchJson(endpoint, options = {}) {
  const { userMessage = "", userEmail = "", sessionToken = "", headers = {}, ...fetchOptions } = options;
  let response;
  const requestUrl = `${API_BASE_URL}${endpoint}`;
  const isFormDataBody = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const requestHeaders = {
    ...headers
  };

  if (!isFormDataBody) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (userEmail) {
    requestHeaders["x-user-email"] = userEmail;
  }

  const activeSessionToken = sessionToken || getStoredSessionToken();

  if (activeSessionToken) {
    requestHeaders.Authorization = `Bearer ${activeSessionToken}`;
  }

  try {
    response = await fetch(requestUrl, {
      headers: requestHeaders,
      ...fetchOptions
    });
  } catch (error) {
    throw new Error(userMessage || "Unable to connect to server. Please try again.");
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorPayload = await response.json();
      errorMessage = errorPayload?.message || errorPayload?.error || errorMessage;
    } catch (error) {
      try {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      } catch (readError) {
        errorMessage = errorMessage;
      }
    }

    console.error("[api] Request failed", {
      endpoint,
      status: response.status,
      errorMessage
    });

    if (response.status === 401) {
      clearStoredSessionToken();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lpg-auth-expired"));
      }
    }

    const safeMessage = userMessage
      || (response.status === 401
        ? "Please login to continue."
        : response.status === 403
          ? "You do not have permission to perform this action."
          : "Something went wrong. Please try again.");

    throw new Error(safeMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function fetchStores(location) {
  const endpoint = location
    ? `/stores/nearby?location=${encodeURIComponent(location)}`
    : "/stores";

  const payload = await fetchJson(endpoint);
  return payload?.stores ?? [];
}

export async function fetchAvailableStores(location) {
  const suffix = location ? `?location=${encodeURIComponent(location)}` : "";
  const payload = await fetchJson(`/stores/available${suffix}`);
  return payload?.stores ?? [];
}

export async function fetchRecommendedStore(location) {
  const suffix = location ? `?location=${encodeURIComponent(location)}` : "";
  const payload = await fetchJson(`/stores/recommend${suffix}`);
  return payload?.store ?? null;
}

export async function fetchStoreAnalytics(location) {
  const suffix = location ? `?location=${encodeURIComponent(location)}` : "";
  const payload = await fetchJson(`/stores/analytics${suffix}`);
  return payload ?? null;
}

export async function sendChatMessage({ message, location, language, userEmail, sessionId }) {
  return fetchJson("/chat", {
    method: "POST",
    body: JSON.stringify({ message, location, language, userEmail, sessionId })
  });
}

export async function registerOrLoginUser(profile) {
  return fetchJson("/user/register", {
    method: "POST",
    body: JSON.stringify(profile)
  });
}

export async function fetchUserProfile(email) {
  const suffix = email ? `?email=${encodeURIComponent(email)}` : "";
  const payload = await fetchJson(`/user/profile${suffix}`, {
    userMessage: "Unable to connect to server. Please try again."
  });
  return payload?.user ?? null;
}

export async function updateUserProfile(profile) {
  const payload = await fetchJson("/user/preferences", {
    method: "POST",
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify(profile)
  });

  return payload?.user ?? null;
}

export async function createStoreRecord(store, userEmail) {
  const payload = await fetchJson("/stores", {
    method: "POST",
    body: JSON.stringify(store)
  });

  return payload?.store ?? null;
}

export async function updateStoreRecord(id, store, userEmail) {
  const payload = await fetchJson(`/stores/${id}`, {
    method: "PUT",
    body: JSON.stringify(store)
  });

  return payload?.store ?? null;
}

export async function deleteStoreRecord(id, userEmail) {
  const payload = await fetchJson(`/stores/${id}`, {
    method: "DELETE"
  });

  return payload?.store ?? null;
}

export async function importStoresFromPdf(file, userEmail) {
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }

  return fetchJson("/stores/import/pdf", {
    method: "POST",
    userMessage: "Unable to import LPG PDF data right now.",
    body: formData
  });
}

export async function createBooking(payload) {
  const response = await fetchJson("/bookings", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response?.booking ?? null;
}

export async function fetchBookingHistory(email) {
  const payload = await fetchJson("/bookings", {
    userMessage: "Unable to connect to server. Please try again."
  });
  return payload?.bookings ?? [];
}

export async function createRequestAlert(payload) {
  const response = await fetchJson("/request", {
    method: "POST",
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify(payload)
  });

  return response?.request ?? null;
}

export async function fetchRequestHistory(email) {
  const payload = await fetchJson("/request", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.requests ?? [];
}

export async function deleteRequestAlert(id, email) {
  const payload = await fetchJson(`/request/${encodeURIComponent(id)}`, {
    method: "DELETE",
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.request ?? null;
}

export async function fetchAdminUsers(userEmail) {
  const payload = await fetchJson("/admin/users", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return {
    totalUsers: payload?.totalUsers ?? 0,
    users: payload?.users ?? []
  };
}

export async function fetchAdminInsights(userEmail) {
  const payload = await fetchJson("/admin/insights", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.insights ?? null;
}

export async function deleteAdminUser(id, userEmail) {
  const payload = await fetchJson(`/admin/user/${encodeURIComponent(id)}`, {
    method: "DELETE",
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.user ?? null;
}

export async function fetchAdminRequests(userEmail) {
  const payload = await fetchJson("/admin/requests", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return {
    totalRequests: payload?.totalRequests ?? 0,
    requests: payload?.requests ?? []
  };
}

export async function deleteAdminRequest(id, userEmail) {
  const payload = await fetchJson(`/admin/request/${encodeURIComponent(id)}`, {
    method: "DELETE",
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.request ?? null;
}

export async function logoutUser() {
  return fetchJson("/user/logout", {
    method: "POST",
    userMessage: "Unable to connect to server. Please try again."
  });
}

export {
  AUTH_TOKEN_STORAGE_KEY,
  clearStoredSessionToken,
  getStoredSessionToken,
  setStoredSessionToken
};
