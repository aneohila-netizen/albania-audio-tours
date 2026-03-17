// Generate a stable session ID for this browser session (no localStorage)
let _sessionId: string | null = null;

export function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = "guest-" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }
  return _sessionId;
}
