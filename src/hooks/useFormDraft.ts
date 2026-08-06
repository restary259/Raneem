import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Draft autosave / recovery.
 *
 * Persists form state to localStorage on a debounce so an accidental refresh,
 * tab close, crash or session timeout never loses typed work. On mount, if a
 * stored draft exists for the same key + version it is handed back so the
 * caller can restore it.
 *
 * Keys are namespaced per user + entity so two people (or two cases) never
 * collide on the same device.
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
}

interface StoredDraft<T> {
  v: number;
  savedAt: number;
  data: T;
}

const PREFIX = 'darb:draft:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a week

export function useFormDraft<T>({
  key,
  version = 1,
  value,
  enabled = true,
  debounceMs = 600,
}: UseFormDraftOptions<T>) {
  const storageKey = `${PREFIX}${key}`;
  const [restored, setRestored] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  // Read any existing draft once per key.
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
      if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
        localStorage.removeItem(storageKey);
        return;
      }
      setRestored(parsed.data);
      setSavedAt(parsed.savedAt);
    } catch {
      /* corrupt draft — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, version, enabled]);

  // Debounced write.
  useEffect(() => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        const payload: StoredDraft<T> = { v: version, savedAt: Date.now(), data: value };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        dirty.current = true;
        setSavedAt(payload.savedAt);
      } catch {
        /* quota or serialization failure — non fatal */
      }
    }, debounceMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, storageKey, version, enabled, debounceMs]);

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
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    dirty.current = false;
    setRestored(null);
    setSavedAt(null);
  }, [storageKey]);

  /** Acknowledge the restored draft so the prompt does not reappear. */
  const acknowledgeRestore = useCallback(() => setRestored(null), []);

  return { restoredDraft: restored, savedAt, clearDraft, acknowledgeRestore };
}

export default useFormDraft;
