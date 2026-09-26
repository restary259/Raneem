// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const CLOUD_PUBLIC_CONFIG = {
  VITE_SUPABASE_URL: "https://mzbadxfvxioedzdjxamc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YmFkeGZ2eGlvZWR6ZGp4YW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDM1MTIsImV4cCI6MjA4NjE3OTUxMn0.YxLzUfifPZnRmO9yknRj4G-rx_CmkMjKyT5kaoJb6Qg",
} as const;

const publicConfig = Object.fromEntries(
  Object.entries(CLOUD_PUBLIC_CONFIG).map(([key, fallback]) => [
    key,
    process.env[key] || fallback,
  ]),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
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
