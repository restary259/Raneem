import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value (search inputs, filter text) so the derived
 * filter/sort pipelines in dashboard tables don't re-run on every keystroke.
 *
 * The input stays fully controlled by the caller — only the returned value is
 * delayed, so typing never feels laggy.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
