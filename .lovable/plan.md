
## Fix: clearAll should not delete the saved draft

Single line change in `src/components/lebenslauf/useLebenslauf.ts`.

**Current (line 37–40):**
```ts
const clearAll = useCallback(() => {
  setData(createEmptyCVData());
  localStorage.removeItem(STORAGE_KEY);
}, []);
```

**Fix:**
```ts
const clearAll = useCallback(() => {
  setData(createEmptyCVData());
  // Do NOT remove the saved draft — user should still be able to load it back
}, []);
```

Remove line 39 (`localStorage.removeItem(STORAGE_KEY)`). That's the only change needed.
