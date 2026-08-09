
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  base: '/',
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
          if (!id.includes('node_modules')) return;
          const p = id.split('node_modules/').pop() || '';
          const pkg = p.startsWith('@') ? p.split('/').slice(0, 2).join('/') : p.split('/')[0];

          if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(pkg)) return 'vendor-react';
          if (pkg === '@supabase' || pkg.startsWith('@supabase/')) return 'vendor-supabase';
          if (['recharts', 'victory-vendor'].includes(pkg) || pkg.startsWith('d3-')) return 'vendor-charts';
          if (['i18next', 'react-i18next', 'i18next-http-backend', 'i18next-browser-languagedetector'].includes(pkg)) return 'vendor-i18n';
          if (['react-hook-form', '@hookform/resolvers', 'zod'].includes(pkg)) return 'vendor-forms';
          if (pkg === 'date-fns') return 'vendor-date';
          if (['jspdf', 'jspdf-autotable', 'exceljs', 'html2canvas', 'canvg'].includes(pkg)) return 'vendor-pdf';
        },
      }
    }
  },
}));
