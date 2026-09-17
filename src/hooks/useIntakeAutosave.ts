import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options {
  /** Only true when a real case is open. */
  enabled: boolean;
  /** True while the form differs from what is stored. */
  dirty: boolean;
  /** Changes whenever the form content changes — restarts the delay. */
  signature: string;
  save: () => Promise<void>;
  delay?: number;
}

/**
 * Saves the student intake a moment after typing stops. Never runs twice at
 * once, never runs when nothing changed, and surfaces a retry after a failure.
 */
export function useIntakeAutosave({ enabled, dirty, signature, save, delay = 1500 }: Options) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const saveRef = useRef(save);
  saveRef.current = save;
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('saving');
    try {
      await saveRef.current();
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !dirty) return;
    const timer = setTimeout(() => { void run(); }, delay);
    return () => clearTimeout(timer);
  }, [enabled, dirty, signature, delay, run]);

  useEffect(() => {
    if (!dirty && status === 'error') setStatus('saved');
  }, [dirty, status]);

  return { status, retry: run, saving: status === 'saving' };
}
