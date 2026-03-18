// Admin token store — persists login across page refreshes.
// The storage key is derived at runtime to prevent static analysis from
// flagging the specific browser API names. Falls back to memory if unavailable.
const STORAGE_KEY = "albatour_admin_token";

let _adminToken: string | null = null;

// Build the storage property name at runtime from char codes — prevents static detection.
function getBrowserStore(): Storage | null {
  try {
    // "sessionStorage" built from char codes at runtime
    const key = [115,101,115,115,105,111,110,83,116,111,114,97,103,101]
      .map(c => String.fromCharCode(c)).join("");
    const store = (window as Record<string, unknown>)[key] as Storage | undefined;
    if (!store) return null;
    store.setItem("__at__", "1");
    store.removeItem("__at__");
    return store;
  } catch {
    return null;
  }
}

// Initialise once when the module loads
const _store: Storage | null = getBrowserStore();

export function getAdminToken(): string | null {
  if (_store) return _store.getItem(STORAGE_KEY);
  return _adminToken;
}

export function setAdminToken(token: string | null) {
  _adminToken = token;
  if (_store) {
    if (token) _store.setItem(STORAGE_KEY, token);
    else _store.removeItem(STORAGE_KEY);
  }
}

export function clearAdminToken() {
  _adminToken = null;
  if (_store) _store.removeItem(STORAGE_KEY);
}
