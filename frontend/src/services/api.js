const DEFAULT_DEPLOYED_API_BASE_URL = "https://lpg-agent.onrender.com";

// The deployed Render backend is the safe default. Local development can still override this with VITE_API_BASE_URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_DEPLOYED_API_BASE_URL;

async function fetchJson(endpoint, options = {}) {
  const {
    authToken = "",
    userMessage = "",
    userEmail = "",
    headers = {},
    ...fetchOptions
  } = options;
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

  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
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

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function fetchStores(location) {
  const endpoint = location?.locationQuery
    ? `/stores/nearby?location=${encodeURIComponent(location.locationQuery)}${location.latitude != null ? `&latitude=${encodeURIComponent(location.latitude)}` : ""}${location.longitude != null ? `&longitude=${encodeURIComponent(location.longitude)}` : ""}`
    : location?.latitude != null && location?.longitude != null
      ? `/stores/nearby?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`
      : typeof location === "string" && location
        ? `/stores/nearby?location=${encodeURIComponent(location)}`
    : "/stores";

  const payload = await fetchJson(endpoint);
  return payload?.stores ?? [];
}

export async function fetchAvailableStores(location) {
  const suffix = location?.locationQuery
    ? `?location=${encodeURIComponent(location.locationQuery)}${location.latitude != null ? `&latitude=${encodeURIComponent(location.latitude)}` : ""}${location.longitude != null ? `&longitude=${encodeURIComponent(location.longitude)}` : ""}`
    : location?.latitude != null && location?.longitude != null
      ? `?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`
      : location
        ? `?location=${encodeURIComponent(location)}`
        : "";
  const payload = await fetchJson(`/stores/available${suffix}`);
  return payload?.stores ?? [];
}

export async function fetchRecommendedStore(location) {
  const suffix = location?.locationQuery
    ? `?location=${encodeURIComponent(location.locationQuery)}${location.latitude != null ? `&latitude=${encodeURIComponent(location.latitude)}` : ""}${location.longitude != null ? `&longitude=${encodeURIComponent(location.longitude)}` : ""}`
    : location?.latitude != null && location?.longitude != null
      ? `?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`
      : location
        ? `?location=${encodeURIComponent(location)}`
        : "";
  const payload = await fetchJson(`/stores/recommend${suffix}`);
  return payload?.store ?? null;
}

export async function fetchStoreAnalytics(location) {
  const suffix = location?.locationQuery
    ? `?location=${encodeURIComponent(location.locationQuery)}${location.latitude != null ? `&latitude=${encodeURIComponent(location.latitude)}` : ""}${location.longitude != null ? `&longitude=${encodeURIComponent(location.longitude)}` : ""}`
    : location?.latitude != null && location?.longitude != null
      ? `?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`
      : location
        ? `?location=${encodeURIComponent(location)}`
        : "";
  const payload = await fetchJson(`/stores/analytics${suffix}`);
  return payload ?? null;
}

export async function fetchAuthSession(authToken) {
  return fetchJson("/auth/session", {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });
}

export async function syncAuthenticatedUser(authToken, profile = {}) {
  return fetchJson("/auth/sync-user", {
    method: "POST",
    authToken,
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify(profile)
  });
}

export async function sendOtpCode(authToken) {
  return fetchJson("/auth/send-otp", {
    method: "POST",
    authToken,
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify({})
  });
}

export async function verifyOtpCode(authToken, payload = {}) {
  return fetchJson("/auth/verify-otp", {
    method: "POST",
    authToken,
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify(payload)
  });
}

export async function sendChatMessage({ message, location, language, userEmail, sessionId, authToken }) {
  return fetchJson("/chat", {
    method: "POST",
    authToken,
    body: JSON.stringify({ message, location, language, userEmail, sessionId })
  });
}

export async function registerOrLoginUser(profile) {
  return fetchJson("/user/register", {
    method: "POST",
    body: JSON.stringify(profile)
  });
}

export async function fetchUserProfile(authToken, email) {
  const suffix = email ? `?email=${encodeURIComponent(email)}` : "";
  const payload = await fetchJson(`/user/profile${suffix}`, {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });
  return payload?.user ?? null;
}

export async function updateUserProfile(profile, authToken) {
  const payload = await fetchJson("/user/preferences", {
    method: "POST",
    authToken,
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify(profile)
  });

  return payload?.user ?? null;
}

export async function createStoreRecord(store, authToken) {
  const payload = await fetchJson("/stores", {
    method: "POST",
    authToken,
    body: JSON.stringify(store)
  });

  return payload?.store ?? null;
}

export async function updateStoreRecord(id, store, authToken) {
  const payload = await fetchJson(`/stores/${id}`, {
    method: "PUT",
    authToken,
    body: JSON.stringify(store)
  });

  return payload?.store ?? null;
}

export async function deleteStoreRecord(id, authToken) {
  const payload = await fetchJson(`/stores/${id}`, {
    method: "DELETE",
    authToken
  });

  return payload?.store ?? null;
}

export async function importStoresFromPdf(file, authToken) {
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }

  return fetchJson("/stores/import/pdf", {
    method: "POST",
    authToken,
    userMessage: "Unable to import LPG PDF data right now.",
    body: formData
  });
}

export async function createBooking(payload, authToken) {
  const response = await fetchJson("/bookings", {
    method: "POST",
    authToken,
    body: JSON.stringify(payload)
  });

  return response?.booking ?? null;
}

export async function fetchBookingHistory(authToken) {
  const payload = await fetchJson("/bookings", {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });
  return payload?.bookings ?? [];
}

export async function createRequestAlert(payload, authToken) {
  const response = await fetchJson("/request", {
    method: "POST",
    authToken,
    userMessage: "Unable to connect to server. Please try again.",
    body: JSON.stringify(payload)
  });

  return response?.request ?? null;
}

export async function fetchRequestHistory(authToken) {
  const payload = await fetchJson("/request", {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.requests ?? [];
}

export async function deleteRequestAlert(id, authToken) {
  const payload = await fetchJson(`/request/${encodeURIComponent(id)}`, {
    method: "DELETE",
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.request ?? null;
}

export async function fetchAdminUsers(authToken) {
  const payload = await fetchJson("/admin/users", {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return {
    totalUsers: payload?.totalUsers ?? 0,
    users: payload?.users ?? []
  };
}

export async function fetchAdminInsights(authToken) {
  const payload = await fetchJson("/admin/insights", {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.insights ?? null;
}

export async function deleteAdminUser(id, authToken) {
  const payload = await fetchJson(`/admin/user/${encodeURIComponent(id)}`, {
    method: "DELETE",
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.user ?? null;
}

export async function fetchAdminRequests(authToken) {
  const payload = await fetchJson("/admin/requests", {
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return {
    totalRequests: payload?.totalRequests ?? 0,
    requests: payload?.requests ?? []
  };
}

export async function deleteAdminRequest(id, authToken) {
  const payload = await fetchJson(`/admin/request/${encodeURIComponent(id)}`, {
    method: "DELETE",
    authToken,
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.request ?? null;
}
