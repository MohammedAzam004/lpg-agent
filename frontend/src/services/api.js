const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

async function fetchJson(endpoint, options = {}) {
  const { userMessage = "", ...fetchOptions } = options;
  let response;
  const requestUrl = `${API_BASE_URL}${endpoint}`;

  try {
    response = await fetch(requestUrl, {
      headers: {
        "Content-Type": "application/json"
      },
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

export async function createStoreRecord(store) {
  const payload = await fetchJson("/stores", {
    method: "POST",
    body: JSON.stringify(store)
  });

  return payload?.store ?? null;
}

export async function updateStoreRecord(id, store) {
  const payload = await fetchJson(`/stores/${id}`, {
    method: "PUT",
    body: JSON.stringify(store)
  });

  return payload?.store ?? null;
}

export async function deleteStoreRecord(id) {
  const payload = await fetchJson(`/stores/${id}`, {
    method: "DELETE"
  });

  return payload?.store ?? null;
}

export async function createBooking(payload) {
  const response = await fetchJson("/bookings", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return response?.booking ?? null;
}

export async function fetchBookingHistory(email) {
  const payload = await fetchJson(`/bookings?email=${encodeURIComponent(email)}`);
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
  const payload = await fetchJson(`/request?email=${encodeURIComponent(email)}`, {
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.requests ?? [];
}

export async function deleteRequestAlert(id, email) {
  const payload = await fetchJson(`/request/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.request ?? null;
}

export async function fetchAdminUsers() {
  const payload = await fetchJson("/admin/users", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return {
    totalUsers: payload?.totalUsers ?? 0,
    users: payload?.users ?? []
  };
}

export async function fetchAdminInsights() {
  const payload = await fetchJson("/admin/insights", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.insights ?? null;
}

export async function deleteAdminUser(id) {
  const payload = await fetchJson(`/admin/user/${encodeURIComponent(id)}`, {
    method: "DELETE",
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.user ?? null;
}

export async function fetchAdminRequests() {
  const payload = await fetchJson("/admin/requests", {
    userMessage: "Unable to connect to server. Please try again."
  });

  return {
    totalRequests: payload?.totalRequests ?? 0,
    requests: payload?.requests ?? []
  };
}

export async function deleteAdminRequest(id) {
  const payload = await fetchJson(`/admin/request/${encodeURIComponent(id)}`, {
    method: "DELETE",
    userMessage: "Unable to connect to server. Please try again."
  });

  return payload?.request ?? null;
}
