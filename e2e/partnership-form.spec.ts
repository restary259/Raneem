import { test, expect } from '@playwright/test';

/**
 * Partnership registration ("انضم إلى شبكة وكلائنا") and referral link health.
 */

test.describe('Partnership registration form', () => {
  test('renders the form with usable yes/no radios', async ({ page }) => {
    await page.goto('/partnership');

    const yes = page.locator('#exp-yes');
    const no = page.locator('#exp-no');
    await expect(yes).toBeVisible();
    await expect(no).toBeVisible();

    // Radios must stay circular — regression guard for the squashed-oval bug.
    const box = await yes.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box!.width) - (box!.height))).toBeLessThanOrEqual(2);

    await no.click();
    await expect(no).toBeChecked();
  });
});

test.describe('Referral link health', () => {
  test('an unknown referral token is rejected, not silently attributed', async ({ page }) => {
    await page.goto('/apply?ref=definitely-not-a-real-code-123');
    await expect(page.getByTestId('referral-broken')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('referral-valid')).toHaveCount(0);

    // The bad token must not be kept around for the next visit.
    const stored = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.includes('ref')).map((k) => window.localStorage.getItem(k)),
    );
    expect(stored.join(',')).not.toContain('definitely-not-a-real-code-123');
  });

  test('no referral param shows no attribution banner', async ({ page }) => {
    await page.goto('/apply');
    await expect(page.getByTestId('referral-valid')).toHaveCount(0);
    await expect(page.getByTestId('referral-broken')).toHaveCount(0);
  });
});
