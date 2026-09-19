import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Permanent failures (auth/permission/not-found/validation) must never be retried. */
const isPermanentError = (error: unknown): boolean => {
  const e = error as { status?: number; code?: string; message?: string } | null;
  if (!e) return false;
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return true;
  const code = String(e.code ?? "");
  // PostgREST/Postgres permission + constraint classes
  if (/^(PGRST|22|23|42)/.test(code)) return true;
  return false;
};

export const getRouter = () => {
  // ported from src/App.tsx — React Query defaults must survive the migration
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        // Backgrounding/foregrounding on mobile used to trigger refetch storms.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Keep showing the previous page's data while the new query resolves
        // instead of flashing a loading state on every navigation.
        placeholderData: (prev: unknown) => prev,
        networkMode: "offlineFirst",
        retry: (failureCount, error) => !isPermanentError(error) && failureCount < 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: (failureCount, error) => !isPermanentError(error) && failureCount < 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // The old app scrolled to top on every pathname change (AppShell effect
    // preserves that); router scroll restoration would fight it.
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
    // SPA mode: route components render client-side only, exactly like the
    // pre-migration Vite SPA. This preserves behaviour for browser-only code
    // (i18n HTTP backend + suspense, PDF/Excel exports, realtime, localStorage)
    // while the server still returns the document shell.
    defaultSsr: false,
  });

  return router;
};
