import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

describe('Lovable Cloud production binding', () => {
  it('provides compile-time fallbacks for every public Cloud variable', () => {
    expect(viteConfig).toContain('VITE_SUPABASE_URL: "https://mzbadxfvxioedzdjxamc.supabase.co"');
    expect(viteConfig).toContain('VITE_SUPABASE_PUBLISHABLE_KEY:');
    expect(viteConfig).toContain('VITE_SUPABASE_PROJECT_ID: "mzbadxfvxioedzdjxamc"');
    expect(viteConfig).toContain('env[key] || fallback');
    expect(viteConfig).toContain('`import.meta.env.${key}`');
  });

  it('never embeds a private backend credential', () => {
    expect(viteConfig).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(viteConfig).not.toContain('service_role');
  });
});