import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://maris-fitness-app.onrender.com";

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export async function setTokens({ accessToken, refreshToken }) {
  if (accessToken) await AsyncStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
}

export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_KEY);
}

export async function clearTokens() {
  await AsyncStorage.removeItem(ACCESS_KEY);
  await AsyncStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const data = await res.json();
    await setTokens(data.tokens);
    return data.tokens.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}, retry = true) {
  const token = await getAccessToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const fresh = await refreshAccessToken();
    if (fresh) return apiFetch(path, options, false);
  }

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg = body?.error?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export { API_URL };

