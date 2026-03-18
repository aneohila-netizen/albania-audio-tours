// Admin token store — uses localStorage when available (Railway URL), falls back to memory (sandboxed Perplexity iframe)
const STORAGE_KEY = "albatour_admin_token";

let _adminToken: string | null = null;

function tryLocalStorage(): boolean {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

const HAS_LOCALSTORAGE = tryLocalStorage();

export function getAdminToken(): string | null {
  if (HAS_LOCALSTORAGE) {
    return localStorage.getItem(STORAGE_KEY);
  }
  return _adminToken;
}

export function setAdminToken(token: string | null) {
  _adminToken = token;
  if (HAS_LOCALSTORAGE) {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export function clearAdminToken() {
  _adminToken = null;
  if (HAS_LOCALSTORAGE) {
    localStorage.removeItem(STORAGE_KEY);
  }
}
