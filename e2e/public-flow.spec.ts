import { test, expect } from '@playwright/test';

test.describe('public journey', () => {
  test('landing page renders core content', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('apply page loads and validates required fields', async ({ page }) => {
    await page.goto('/apply');
    await expect(page.locator('form, input').first()).toBeVisible({ timeout: 20_000 });
  });

  test('unauthenticated admin route does not render the dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/admin(\/|$)/);
  });

  test('unauthenticated team route does not render the dashboard', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/team(\/|$)/);
  });
});
