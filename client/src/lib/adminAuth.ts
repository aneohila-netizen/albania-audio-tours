// In-memory admin token store (avoids sessionStorage which is blocked in sandboxed iframes)
let _adminToken: string | null = null;

export function getAdminToken(): string | null {
  return _adminToken;
}

export function setAdminToken(token: string | null) {
  _adminToken = token;
}

export function clearAdminToken() {
  _adminToken = null;
}
