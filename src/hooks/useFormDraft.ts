import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draft autosave / recovery with inactivity-based expiry.
 *
 * Persists form state to localStorage on a debounce so an accidental refresh,
 * tab close, crash or session timeout never loses typed work. On mount, if a
 * stored draft exists for the same key + version it is handed back so the
 * caller can restore it.
 *
 * Expiry is measured from `savedAt` — the LAST debounced write, not creation —
 * so a draft survives as long as the user keeps editing and is discarded after
 * `expiresMs` (default 30 min) of inactivity. A single idle-timeout (reset on
 * every write) also removes a draft that sits idle while the page stays open,
 * without needing a refresh.
 */
export interface UseFormDraftOptions<T> {
  /** Stable identifier, e.g. `profile-completion:<caseId>` */
  key: string;
  /** Bump when the form shape changes so stale drafts are ignored. */
  version?: number;
  /** Current form state. */
  value: T;
  /** Disable persistence (e.g. while the dialog is closed). */
  enabled?: boolean;
  /** Debounce in ms. */
  debounceMs?: number;
  /** Inactivity window after which a draft expires (ms). Default 30 min. */
  expiresMs?: number;
}

interface StoredDraft<T> {
  v: number;
  savedAt: number;
  data: T;
}

const PREFIX = 'darb:draft:';
const DEFAULT_EXPIRES_MS = 30 * 60 * 1000; // 30 minutes

export function useFormDraft<T>({
  key,
  version = 1,
  value,
  enabled = true,
  debounceMs = 600,
  expiresMs = DEFAULT_EXPIRES_MS,
}: UseFormDraftOptions<T>) {
  const storageKey = `${PREFIX}${key}`;
  const [restored, setRestored] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Set once when a draft is found already expired on mount, so the caller can
  // show the "expired after 30 min of inactivity" notice instead of restoring.
  const [expired, setExpired] = useState(false);
  const timer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const dirty = useRef(false);

  // Read any existing draft once per key. Removes expired/version-mismatched.
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft<T>;
      if (parsed.v !== version) {
        localStorage.removeItem(storageKey);
        return;
      }
      if (Date.now() - parsed.savedAt > expiresMs) {
        localStorage.removeItem(storageKey);
        setExpired(true);
        return;
      }
      setRestored(parsed.data);
      setSavedAt(parsed.savedAt);
    } catch {
      /* corrupt draft — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, version, enabled, expiresMs]);

  // Debounced write.
  useEffect(() => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        const now = Date.now();
        const payload: StoredDraft<T> = { v: version, savedAt: now, data: value };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        dirty.current = true;
        setSavedAt(now);
      } catch {
        /* quota or serialization failure — non fatal */
      }
    }, debounceMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, storageKey, version, enabled, debounceMs]);

  // Active idle-timeout: once savedAt + expiresMs passes with no further
  // writes, discard the draft and reset state. The timeout is re-armed
  // whenever savedAt changes (every debounced write), so expiry tracks the
  // last save. A single timeout — no per-second re-renders.
  useEffect(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (savedAt === null || !enabled) return;
    const remaining = savedAt + expiresMs - Date.now();
    if (remaining <= 0) {
      // Already past expiry — clear now.
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      dirty.current = false;
      setRestored(null);
      setSavedAt(null);
      setExpired(true);
      return;
    }
    idleTimer.current = window.setTimeout(() => {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      dirty.current = false;
      setRestored(null);
      setSavedAt(null);
      setExpired(true);
    }, remaining);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [savedAt, expiresMs, enabled, storageKey]);

  // Warn before leaving with unsaved work.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  /** Call after a successful submit (or when the user discards). */
  const clearDraft = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    dirty.current = false;
    setRestored(null);
    setSavedAt(null);
    setExpired(false);
  }, [storageKey]);

  /** Acknowledge the restored draft so the prompt does not reappear. */
  const acknowledgeRestore = useCallback(() => setRestored(null), []);
  /** Acknowledge the expired notice so it does not reappear. */
  const acknowledgeExpired = useCallback(() => setExpired(false), []);

  const expiresAt = savedAt === null ? null : savedAt + expiresMs;

  return {
    restoredDraft: restored,
    savedAt,
    expiresAt,
    expired,
    clearDraft,
    acknowledgeRestore,
    acknowledgeExpired,
  };
}

export default useFormDraft;
