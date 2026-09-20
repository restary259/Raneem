import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

describe('Lovable Cloud production binding', () => {
  it('builds through the Lovable config wrapper', () => {
    expect(viteConfig).toContain('@lovable.dev/vite-tanstack-config');
    expect(viteConfig).toContain('export default defineConfig(');
  });

  it('defines public database fallbacks for client and SSR route chunks', () => {
    expect(viteConfig).toContain('const CLOUD_PUBLIC_CONFIG');
    expect(viteConfig).toMatch(/VITE_SUPABASE_URL:\s*"https:\/\//);
    expect(viteConfig).toMatch(/VITE_SUPABASE_PUBLISHABLE_KEY:\s*\n?\s*"[^"\n]+"/);
    expect(viteConfig).toContain('process.env[key] || fallback');
    expect(viteConfig).toContain('`import.meta.env.${key}`');
  });

  it('never embeds a private backend credential', () => {
    expect(viteConfig).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(viteConfig).not.toContain('service_role');
  });
});
