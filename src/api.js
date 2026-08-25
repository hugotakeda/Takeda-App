import { API_BASE_URL, CACHE_TTL_MS } from './config.js';

const CACHE_PREFIX = 'lumen:cache:';
const mem = new Map(); // hot in-memory copy, mirrors localStorage for this session

function readCache(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  const entry = { data, savedAt: Date.now() };
  mem.set(key, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage full or unavailable — in-memory cache still works for this session */
  }
}

/**
 * Stale-while-revalidate data loader.
 *
 * - If nothing is cached yet: awaits the fetcher, returns fresh data (caller
 *   shows skeletons until this resolves).
 * - If something is cached: returns it immediately (synchronously fast),
 *   and — if older than CACHE_TTL_MS — fires the fetcher in the background
 *   and calls onRevalidate(freshData) once it lands, so the UI can patch
 *   in new numbers without a loading flash.
 */
export async function loadCached(key, fetcher, onRevalidate) {
  const cached = readCache(key);

  if (cached) {
    const isStale = Date.now() - cached.savedAt > CACHE_TTL_MS;
    if (isStale) {
      fetcher()
        .then((fresh) => {
          writeCache(key, fresh);
          onRevalidate?.(fresh);
        })
        .catch(() => {
          /* keep showing the stale-but-known-good cache on revalidation failure */
        });
    }
    return { data: cached.data, fromCache: true };
  }

  const fresh = await fetcher();
  writeCache(key, fresh);
  return { data: fresh, fromCache: false };
}

export function invalidateCache(key) {
  mem.delete(key);
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch { /* noop */ }
}

/* ---------------------------------------------------------------------- */
/* Backend calls (auth + license only — system data comes from the main   */
/* process via the preload bridge, see window.lumen.system.*)             */
/* ---------------------------------------------------------------------- */

async function post(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json;
}

export const backend = {
  /** Exchanges the Discord OAuth code (from the loopback callback) for a Lumen session. */
  exchangeDiscordCode: (code, hwid) => post('/api/auth/token', { code, hwid }),
  /** Re-validates a stored session on app launch (admin may have revoked access since). */
  verifySession: (sessionToken, hwid) => post('/api/session/verify', { sessionToken, hwid }),
};
