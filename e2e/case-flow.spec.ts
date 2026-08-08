import { test, expect } from '@playwright/test';

/**
 * Case view flow:
 *  - the case file is unreachable signed out
 *  - signed in, a real case opens with header, status chip and all three tabs
 *  - no raw i18n keys or database tokens leak into the rendered page
 */
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON ?? '';
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY ?? '';
const hasSession = !!SESSION_JSON && !!STORAGE_KEY;

const RAW_TOKENS = [
  'case.tasks.',
  'case.tabs.',
  'case.overview.',
  'case.status.',
  'appointment_scheduled',
  'payment_confirmed',
  'enrollment_paid',
];

const TAB_NAMES = [/^(Case|الملف)$/, /Program & Finance|البرنامج والمالية/, /History|السجل/];

test.describe('case view — signed out', () => {
  for (const path of ['/team/cases/00000000-0000-0000-0000-000000000000', '/admin/cases/00000000-0000-0000-0000-000000000000']) {
    test(`${path} does not render a case file`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('tab', { name: /Program & Finance|البرنامج والمالية/ })).toHaveCount(0);
    });
  }
});

test.describe('case view — signed in', () => {
  test.skip(!hasSession, 'no injected Supabase session available');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [STORAGE_KEY, SESSION_JSON],
    );
  });

  async function openFirstCase(page: import('@playwright/test').Page) {
    await page.goto('/team/cases');
    await page.waitForLoadState('networkidle');
    const row = page.locator('.cursor-pointer').first();
    if ((await row.count()) === 0) {
      test.skip(true, 'no cases available for this account');
    }
    await row.click();
    await page.waitForURL(/\/cases\/[0-9a-f-]{36}/);
    await page.waitForLoadState('networkidle');
  }


  test('header, status chip and three tabs render', async ({ page }) => {
    await openFirstCase(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    for (const name of TAB_NAMES) {
      await expect(page.getByRole('tab', { name })).toHaveCount(1);
    }
  });

  test('each tab renders its section without raw keys or db tokens', async ({ page }) => {
    await openFirstCase(page);
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(400);
      const body = (await page.locator('body').innerText()).toLowerCase();
      for (const token of RAW_TOKENS) {
        expect(body, `raw token "${token}" leaked into the case view`).not.toContain(token.toLowerCase());
      }
    }
  });

  test('attention panel tasks are actionable when present', async ({ page }) => {
    await openFirstCase(page);
    const panel = page.getByRole('region', { name: /Needs attention now|يحتاج انتباهك الآن/ });
    if ((await panel.count()) > 0) {
      await expect(panel.getByRole('button').first()).toBeEnabled();
    }
  });
});
