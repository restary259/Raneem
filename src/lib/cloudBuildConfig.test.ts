import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

describe('Lovable Cloud production binding', () => {
  it('builds through the Lovable config wrapper, which injects the VITE_* Cloud variables at build time', () => {
    // Pre-migration this file carried inline compile-time fallbacks for
    // VITE_SUPABASE_URL / _PUBLISHABLE_KEY / _PROJECT_ID. On TanStack Start,
    // @lovable.dev/vite-tanstack-config performs the VITE_* env injection
    // itself — the guard is now that the wrapper stays in place.
    expect(viteConfig).toContain('@lovable.dev/vite-tanstack-config');
    expect(viteConfig).toContain('export default defineConfig(');
  });

  it('never embeds a private backend credential', () => {
    expect(viteConfig).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(viteConfig).not.toContain('service_role');
  });
});
