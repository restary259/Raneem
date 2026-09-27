// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const CLOUD_PUBLIC_CONFIG = {
  VITE_SUPABASE_URL: "https://mzbadxfvxioedzdjxamc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YmFkeGZ2aW9lZHpqeGFtYyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwNjAzNTMyLCJleHAiOjIwODYxNzk1MTJ9.y0LzUfifPZnRmO9yknRj4G-rx_CmkMjKyT5kaoJb6Qg",
} as const;

const publicConfig = Object.fromEntries(
  Object.entries(CLOUD_PUBLIC_CONFIG).map(([key, fallback]) => [
    key,
    process.env[key] || fallback,
  ]),
);

const fixAppointmentDateFormatting = {
  name: "fix-admin-appointment-date-formatting",
  enforce: "post" as const,
  transform(code: string, id: string) {
    if (!id.endsWith("/src/pages/admin/AdminPipelinePage.tsx")) return null;

    const invalid = 'new Date(caseAppointment.scheduled_at).toLocaleString("en-IL", { timeZone: "Asia/Jerusalem", weekday: "short", dateStyle: "medium", timeStyle: "short" })';
    const fixed = 'new Date(caseAppointment.scheduled_at).toLocaleString("en-IL", { timeZone: "Asia/Jerusalem", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })';

    if (!code.includes(invalid)) return null;
    return code.replace(invalid, fixed);
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // VITE_* values are compiled into both client and SSR route chunks. The
    // published Worker receives SUPABASE_* at request time, but route modules
    // initialize the browser client during module loading, before a request
    // exists. Keep explicit public fallbacks so production cannot boot with an
    // empty URL/key when the build environment omits the VITE_* aliases.
    define: Object.fromEntries(
      Object.entries(publicConfig).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    plugins: [fixAppointmentDateFormatting],
    resolve: {
      alias: {
        // React Email's htmlparser2 path needs entities v4.5.0; a nested v5+
        // copy (parse5 ships v8) removes ./lib/decode.js and breaks SSR.
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        // No bare "entities" alias: parse5 v8 imports subpaths such as
        // "entities/escape" that only exist in v5+.
      },
    },
  },
});
