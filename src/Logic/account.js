import { apiFetch } from "./api";
import { logout as authLogout } from "./auth";

const DEFAULT_AVATAR = { shape: "classic", color: "sage" };

export async function getAccount() {
  try {
    const me = await apiFetch("/me");
    return {
      name: me.person.fullName,
      avatar: {
        shape: me.person.avatarShape || DEFAULT_AVATAR.shape,
        color: me.person.avatarColor || DEFAULT_AVATAR.color,
      },
    };
  } catch (err) {
    return { name: "", avatar: { ...DEFAULT_AVATAR }, error: err.message };
  }
}

export async function saveAvatar(avatar) {
  try {
    await apiFetch("/me/avatar", {
      method: "PATCH",
      body: JSON.stringify({
        avatarShape: avatar.shape,
        avatarColor: avatar.color,
      }),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function logout() {
  return authLogout();
}
