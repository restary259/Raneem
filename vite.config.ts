
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const CLOUD_CONFIG = {
  VITE_SUPABASE_URL: "https://mzbadxfvxioedzdjxamc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YmFkeGZ2eGlvZWR6ZGp4YW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MDM1MTIsImV4cCI6MjA4NjE3OTUxMn0.YxLzUfifPZnRmO9yknRj4G-rx_CmkMjKyT5kaoJb6Qg",
  VITE_SUPABASE_PROJECT_ID: "mzbadxfvxioedzdjxamc",
} as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cloudConfig = Object.fromEntries(
    Object.entries(CLOUD_CONFIG).map(([key, fallback]) => [key, env[key] || fallback]),
  );

  return {
    base: '/',
    define: Object.fromEntries(
      Object.entries(cloudConfig).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // id-based splitting: only real package files are grouped, so shared
          // helpers are never hoisted into a heavy vendor chunk and dragged
          // into the initial graph (recharts/pdf used to be preloaded on boot).
          manualChunks(id: string) {
            // Rollup's CommonJS interop helpers are shared by every CJS package.
            // Unassigned they land in the largest chunk (vendor-charts), which
            // then gets preloaded on boot by whoever needs the helper.
            if (id.includes('commonjsHelpers') || id.includes('commonjs-dynamic-modules')) return 'vendor-utils';
            if (!id.includes('node_modules')) return;

            const p = id.split('node_modules/').pop() || '';
            const pkg = p.startsWith('@') ? p.split('/').slice(0, 2).join('/') : p.split('/')[0];

            // Tiny helpers imported by nearly every component. Left ungrouped,
            // Rollup parked them inside vendor-charts, which forced the 390 kB
            // chart bundle into the initial preload for one `clsx`.
            if ([
              'clsx', 'tailwind-merge', 'class-variance-authority',
              'react-is', 'prop-types', 'object-assign', 'tslib',
              'use-sync-external-store', 'warning', 'invariant',
              'set-cookie-parser', 'cookie', 'turbo-stream',
            ].includes(pkg)) return 'vendor-utils';
            if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(pkg)) return 'vendor-react';

            if (pkg === '@supabase' || pkg.startsWith('@supabase/')) return 'vendor-supabase';
            if (['recharts', 'victory-vendor', 'react-smooth', 'recharts-scale', 'lodash', 'fast-equals', 'decimal.js-light', 'eventemitter3'].includes(pkg) || pkg.startsWith('d3-') || pkg.startsWith('lodash')) return 'vendor-charts';

            if (['i18next', 'react-i18next', 'i18next-http-backend', 'i18next-browser-languagedetector'].includes(pkg)) return 'vendor-i18n';
            if (['react-hook-form', '@hookform/resolvers', 'zod'].includes(pkg)) return 'vendor-forms';
            if (pkg === 'date-fns') return 'vendor-date';
            if (['jspdf', 'jspdf-autotable', 'exceljs', 'html2canvas', 'canvg'].includes(pkg)) return 'vendor-pdf';
          },
        },
      },
    },
  };
});
