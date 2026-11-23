// ==============================================================================
// Antar AI - API & Service Configuration
// Dynamic routing for local dev (Vite proxy) & Vercel Multi-Service deployments
// ==============================================================================

/**
 * Returns the base URL for backend API requests.
 * In production or Vercel multi-service routing, returns an empty string
 * so that relative requests like `/api/reports` naturally hit the Vercel rewrite
 * `{ "source": "/api/(.*)", "destination": { "service": "backend" } }`.
 * In standalone dev, defaults to `http://localhost:8000` or `VITE_API_BASE_URL`.
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  // In the browser, return empty string so calls like `${getApiBaseUrl()}/api/...`
  // resolve as relative URLs (`/api/...`) under the same domain.
  if (typeof window !== 'undefined') {
    return '';
  }
  return 'http://localhost:8000';
}

/**
 * Returns the WebSocket base URL.
 */
export function getWsBaseUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return 'ws://localhost:8000';
}
