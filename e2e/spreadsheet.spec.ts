import { test, expect, request } from '@playwright/test';

/**
 * Spreadsheet Hub guards:
 *  - the routes are not reachable signed out
 *  - the admin-only tax rollup is not callable anonymously
 *  - no raw i18n keys or raw database tokens leak into the UI
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON ?? '';
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY ?? '';
const hasSession = !!SESSION_JSON && !!STORAGE_KEY;

const RAW_TOKENS = [
  'sheets.tab.',
  'sheets.col.',
  'sheets.value.',
  'enrollment_paid',
  'social_media_partner',
  'bank_transfer',
];

test.describe('spreadsheet hub — signed out', () => {
  for (const path of ['/admin/spreadsheet', '/team/spreadsheet']) {
    test(`${path} is not reachable without a session`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Either bounced to auth, or the hub never rendered its title.
      const onHub = await page
        .getByRole('heading', { level: 1 })
        .filter({ hasText: /Spreadsheet Hub|مركز الجداول/ })
        .count();
      expect(onHub).toBe(0);
    });
  }

  test('monthly tax rollup rejects anonymous callers', async () => {
    test.skip(!SUPABASE_URL || !ANON_KEY, 'backend env vars not provided');
    const ctx = await request.newContext();
    const res = await ctx.post(`${SUPABASE_URL}/rest/v1/rpc/get_monthly_tax_report`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {},
      failOnStatusCode: false,
    });
    if (res.ok()) {
      expect(await res.json()).toEqual([]);
    } else {
      expect([401, 403, 404]).toContain(res.status());
    }
    await ctx.dispose();
  });
});

test.describe('spreadsheet hub — signed in', () => {
  test.skip(!hasSession, 'no injected Supabase session available');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [STORAGE_KEY, SESSION_JSON],
    );
  });

  test('team scope shows only its three sheets', async ({ page }) => {
    await page.goto('/team/spreadsheet');
    await page.waitForLoadState('networkidle');

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);

    for (const forbidden of [/Payouts|التحويلات/, /Taxes|الضرائب/, /Schools & Programs|المدارس والبرامج/]) {
      await expect(page.getByRole('tab', { name: forbidden })).toHaveCount(0);
    }
  });

  test('switching tabs renders the matching sheet', async ({ page }) => {
    await page.goto('/team/spreadsheet');
    await page.waitForLoadState('networkidle');

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      const name = (await tabs.nth(i).textContent())?.trim() ?? '';
      await tabs.nth(i).click();
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
  });

  test('search filters the visible rows', async ({ page }) => {
    await page.goto('/team/spreadsheet');
    await page.waitForLoadState('networkidle');

    const search = page.getByPlaceholder(/Search|بحث/);
    await search.fill('zzz-no-such-row-zzz');
    await expect(page.getByText(/No data yet|لا توجد بيانات بعد/)).toBeVisible();
    await search.fill('');
  });

  test('no raw translation keys or database tokens are rendered', async ({ page }) => {
    await page.goto('/team/spreadsheet');
    await page.waitForLoadState('networkidle');

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(500);
      const body = (await page.locator('body').innerText()).toLowerCase();
      for (const token of RAW_TOKENS) {
        expect(body, `raw token "${token}" leaked into the UI`).not.toContain(token.toLowerCase());
      }
    }
  });
});
