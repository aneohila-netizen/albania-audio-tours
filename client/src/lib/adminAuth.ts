// Admin token store — uses sessionStorage when available, falls back to memory
// sessionStorage survives F5 page refresh (same tab) and works in all contexts.
const STORAGE_KEY = "albatour_admin_token";

let _adminToken: string | null = null;

function trySessionStorage(): boolean {
  try {
    const ss = window.sessionStorage;
    ss.setItem("__test__", "1");
    ss.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

const HAS_SESSION_STORAGE = trySessionStorage();

export function getAdminToken(): string | null {
  if (HAS_SESSION_STORAGE) {
    return window.sessionStorage.getItem(STORAGE_KEY);
  }
  return _adminToken;
}

export function setAdminToken(token: string | null) {
  _adminToken = token;
  if (HAS_SESSION_STORAGE) {
    if (token) {
      window.sessionStorage.setItem(STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function clearAdminToken() {
  _adminToken = null;
  if (HAS_SESSION_STORAGE) {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}
