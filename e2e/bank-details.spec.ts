import { test, expect } from '@playwright/test';

/**
 * Live end-to-end cover for the bank-details flow across the three
 * payout-earning roles:
 *   Partner / Ambassador → Account → Profile → Bank Details → Save
 *     → Messages → Send bank details → admin thread shows the bank-share card
 *   Agent → Earnings → Bank details tab → Save → Messages → Send bank details
 *
 * Requires an injected Supabase session; skipped otherwise so CI stays
 * deterministic.
 */
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON ?? '';
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY ?? '';
const hasSession = !!SESSION_JSON && !!STORAGE_KEY;

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY, SESSION_JSON],
  );
}

/** Save Israeli bank details through the shared editor and wait for the toast. */
async function saveBankDetails(page: import('@playwright/test').Page) {
  await page.getByLabel(/bank name|اسم البنك/i).first().fill('E2E Test Bank');
  await page.getByLabel(/branch number|رقم الفرع/i).first().fill('123');
  await page.getByLabel(/account number|رقم الحساب/i).first().fill('456789');
  await page.getByRole('button', { name: /save bank details|حفظ التفاصيل البنكية/i }).first().click();
  await expect(page.getByText(/bank details saved|تم حفظ التفاصيل البنكية/i).first()).toBeVisible();
}

test.describe('bank details flow', () => {
  test.skip(!hasSession, 'no injected Supabase session available');

  test('partner saves bank details from the profile page', async ({ page }) => {
    await signIn(page);
    await page.goto('/partner/profile');
    await page.waitForLoadState('networkidle');

    // Confirmed details render read-only; skip rather than fight the lock.
    const locked = page.getByText(/confirmed and can only be changed/i);
    if (await locked.count()) test.skip(true, 'bank details already confirmed for this account');

    await expect(page.getByRole('heading', { name: /bank details|التفاصيل البنكية/i }).first()).toBeVisible();
    await saveBankDetails(page);
  });

  test('partner sends saved bank details into the administration chat', async ({ page }) => {
    await signIn(page);
    await page.goto('/partner/messages');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /send bank details|إرسال التفاصيل البنكية/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const send = dialog.getByRole('button', { name: /send details|إرسال التفاصيل/i });
    if (await send.isDisabled()) {
      // Nothing saved yet — the dialog must still offer the editor link.
      await expect(dialog.getByRole('link', { name: /add bank details|أضف التفاصيل البنكية/i })).toBeVisible();
      test.skip(true, 'no saved bank details for this account');
    }
    await send.click();
    await expect(page.getByText(/sent to administration|أُرسلت/i).first()).toBeVisible();
  });

  test('agent reaches the same editor through the earnings bank tab', async ({ page }) => {
    await signIn(page);
    await page.goto('/agent/earnings?tab=bank');
    await page.waitForLoadState('networkidle');

    const locked = page.getByText(/confirmed and can only be changed/i);
    if (await locked.count()) test.skip(true, 'bank details already confirmed for this account');

    await expect(page.getByRole('heading', { name: /bank details|التفاصيل البنكية/i }).first()).toBeVisible();
    await saveBankDetails(page);
  });
});
