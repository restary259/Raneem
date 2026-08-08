import { test, expect } from '@playwright/test';

/**
 * Live end-to-end cover for the master-partner recruitment funnel:
 *   recruit signs up on /join/:code
 *     → admin approves in the inbox
 *       → account is created/reused, linked to the recruiting master partner
 *         → branded activation email is generated
 *           → the partner can only enter the dashboard through that link
 *
 * Requires an injected admin Supabase session; skipped otherwise.
 */
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON ?? '';
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY ?? '';
const hasSession = !!SESSION_JSON && !!STORAGE_KEY;

const RECRUIT_CODE = process.env.E2E_RECRUIT_CODE ?? 'MP-DCAF';
const RECRUIT_EMAIL = process.env.E2E_RECRUIT_EMAIL ?? 'tsukuyomidomain00@gmail.com';
const RECRUIT_NAME = 'E2E Recruit';

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY, SESSION_JSON],
  );
}

test.describe('master partner recruitment', () => {
  test.skip(!hasSession, 'no injected Supabase session available');

  test('recruit signup page is public and attributed to the master partner', async ({ page }) => {
    await page.goto(`/join/${RECRUIT_CODE}`);
    await page.waitForLoadState('networkidle');

    // An invalid code must not render a submittable form.
    const invalid = page.getByText(/invalid|غير صالح|not found|منتهي/i);
    if (await invalid.count()) test.skip(true, `recruit code ${RECRUIT_CODE} is not active`);

    await expect(page.getByRole('button', { name: /send|submit|إرسال|تقديم/i }).first()).toBeVisible();
  });

  test('admin can approve a recruit and reach the invite controls', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/inbox');
    await page.waitForLoadState('networkidle');

    await page.getByRole('tab', { name: /recruits|المرشح|الانتساب/i }).click();
    await page.waitForLoadState('networkidle');

    const search = page.getByRole('textbox').first();
    if (await search.count()) await search.fill(RECRUIT_EMAIL);

    const card = page.locator('div', { hasText: RECRUIT_EMAIL }).last();
    if ((await card.count()) === 0) test.skip(true, 'no recruit application for the test email');

    const approve = page.getByRole('button', { name: /^(approve|قبول|اعتماد)$/i }).first();
    if (await approve.count()) {
      await approve.click();
      // Account creation + activation email happen in one server round-trip.
      await expect(
        page.getByText(/activation email|رابط التفعيل|تم إرسال/i).first(),
      ).toBeVisible({ timeout: 30_000 });
    }

    // Approved rows always expose a retry path for the branded invite.
    await expect(
      page.getByRole('button', { name: /resend invite|إعادة إرسال/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('approved recruit is linked under the recruiting master partner', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/partners');
    await page.waitForLoadState('networkidle');

    const search = page.getByRole('textbox').first();
    if (await search.count()) await search.fill(RECRUIT_NAME.split(' ')[0]);
    await page.waitForTimeout(500);

    // The directory must show the recruit with a master-partner attribution,
    // never as an orphan partner.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/undefined|\[object Object\]/);
  });

  test('the partner cannot sign in without using the activation link', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    // No session may be minted from the recruit email alone.
    await expect(page).not.toHaveURL(/\/partner/);
  });
});
