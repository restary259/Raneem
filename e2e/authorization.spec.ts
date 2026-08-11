import { test, expect, request } from '@playwright/test';

/**
 * Authorization-regression guards. These must fail loudly if a policy or an
 * edge-function guard is ever loosened.
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

const GUARDED_FUNCTIONS = [
  'send_welcome_email',
  'admin-weekly-digest',
];

// Tables that must never be readable without a session.
const PROTECTED_TABLES = ['profiles', 'cases', 'rewards', 'payout_requests', 'auth_failure_log'];

test.describe('authorization regressions', () => {
  test.skip(!SUPABASE_URL || !ANON_KEY, 'backend env vars not provided');

  for (const fn of GUARDED_FUNCTIONS) {
    test(`${fn} rejects unauthenticated callers`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.post(`${SUPABASE_URL}/functions/v1/${fn}`, {
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        data: {},
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(res.status());
      await ctx.dispose();
    });
  }

  for (const table of PROTECTED_TABLES) {
    test(`${table} is not readable anonymously`, async () => {
      const ctx = await request.newContext();
      const res = await ctx.get(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        failOnStatusCode: false,
      });
      if (res.ok()) {
        expect(await res.json()).toEqual([]);
      } else {
        expect([401, 403, 404]).toContain(res.status());
      }
      await ctx.dispose();
    });
  }
});
