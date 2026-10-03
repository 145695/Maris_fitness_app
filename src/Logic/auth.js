// All auth logic lives here. Right now it's fake (no server yet).
// Every function returns { ok: true, ... } or { ok: false, error: "message" }.

const wait = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} username
 * @param {string} password
 */
export async function login(username, password) {
  if (!username.trim() || !password) {
    return { ok: false, error: "Enter your user name and password." };
  }
  await wait();
  // TODO: POST to your Node API, e.g. fetch(`${API_URL}/auth/login`, ...)
  // TODO: save the returned token (expo-secure-store)
  return { ok: true, user: { username } };
}

/**
 * @param {string} username
 * @param {string} password
 */
export async function signup(username, password) {
  if (!username.trim()) return { ok: false, error: "Choose a user name." };
  if (password.length < 6) {
    return { ok: false, error: "Password needs at least 6 characters." };
  }
  await wait();
  // TODO: POST to /auth/signup
  return { ok: true, user: { username } };
}

export async function signInWithGoogle() {
  await wait();
  // TODO: expo-auth-session / Google sign-in
  return { ok: true, user: { username: "google-user" } };
}

export async function logout() {
  // TODO: delete the saved token
  return { ok: true };
}