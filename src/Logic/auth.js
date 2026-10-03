import { apiFetch, clearTokens, setTokens } from "./api";

export async function login(username, password) {
  if (!username.trim() || !password) {
    return { ok: false, error: "Enter your user name and password." };
  }
  try {
    const data = await apiFetch(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      },
      false, // don't retry login
    );
    await setTokens(data.tokens);
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function signup(username, password, fullName, timezone) {
  if (!username.trim()) return { ok: false, error: "Choose a user name." };
  if (password.length < 6) {
    return { ok: false, error: "Password needs at least 6 characters." };
  }
  try {
    const data = await apiFetch(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
          fullName: fullName || username.trim(),
          timezone: timezone || "UTC",
        }),
      },
      false,
    );
    if (data.tokens) {
      await setTokens(data.tokens);
      return { ok: true, user: data.user };
    }
    // register didn't return tokens — log in
    return login(username, password);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function signInWithGoogle() {
  // Not implemented on the backend.
  return { ok: false, error: "Google sign-in is not available yet." };
}

export async function logout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" }, false);
  } catch {
    // ignore — token may already be invalid
  }
  await clearTokens();
  return { ok: true };
}
