import { logout as authLogout } from "./auth";

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

// Fake data. It lives in memory, so it survives tab switches but not an app restart.
let account = {
  name: "Maria",
  avatar: { shape: "classic", color: "sage" },
};

export async function getAccount() {
  await wait();
  // TODO: GET /me
  return { ...account, avatar: { ...account.avatar } };
}

// avatar = { shape, color }
export async function saveAvatar(avatar) {
  account = { ...account, avatar: { ...avatar } };
  // TODO: PATCH /me { avatar }
  return { ok: true };
}

export async function logout() {
  // TODO: also clear any cached user data
  return authLogout();
}
