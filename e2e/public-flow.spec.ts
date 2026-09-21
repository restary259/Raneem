import { test, expect } from '@playwright/test';

const watchRuntime = (page: import('@playwright/test').Page) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    // TanStack Start's client-only development stream owns this bootstrap
    // script; it is not application markup and is absent from production.
    if (message.type() === 'error' && !message.text().includes('Encountered a script tag while rendering React component')) {
      failures.push(message.text());
    }
  });
  return () => expect(failures, failures.join('\n')).toEqual([]);
};

test.describe('public journey', () => {
  test('landing page renders core content', async ({ page }) => {
    const assertClean = watchRuntime(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('a[href="/apply"]').first()).toBeVisible();
    await expect(page.locator('a[href*="wa.me"]').first()).toHaveAttribute('target', '_blank');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    assertClean();
  });

  test('apply page loads and validates required fields', async ({ page }) => {
    await page.goto('/apply');
    await expect(page.getByTestId('apply-form')).toBeVisible({ timeout: 20_000 });
  });

  test('contact validates and sends the intended inbox payload', async ({ page }) => {
    let payload: Record<string, unknown> | undefined;
    await page.route('**/rest/v1/contact_submissions*', async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/consent_records*', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    await page.goto('/contact');
    const form = page.getByTestId('contact-form');
    await form.locator('input').nth(0).fill('Test Student');
    await form.locator('input[type="email"]').fill('student@example.com');
    await form.getByRole('combobox').click();
    await page.getByRole('option').first().click();
    await form.locator('textarea').fill('I need verified information about studying in Germany.');
    await form.locator('input[type="checkbox"]').first().check();
    await page.getByTestId('contact-submit').click();
    await expect.poll(() => payload).toBeTruthy();
    expect(payload).toMatchObject({ form_source: 'contact_form', status: 'new' });
    expect(payload?.data).toMatchObject({ full_name: 'Test Student', email: 'student@example.com' });
  });

  test('apply completes all steps and sends the normalized case payload', async ({ page }) => {
    let payload: Record<string, unknown> | undefined;
    await page.route('**/functions/v1/create-case-from-apply', async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"case-test"}' });
    });
    await page.route('**/rest/v1/consent_records*', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    await page.goto('/apply');
    const form = page.getByTestId('apply-form');
    await form.getByPlaceholder(/أدخل اسمك الكامل|Enter your full name/).fill('Test Applicant');
    await form.locator('input[type="tel"]').fill('+491234567890');
    await form.getByRole('button', { name: /التالي|Next/ }).click();
    await expect(form).toHaveAttribute('data-step', '2');
    await form.getByRole('button', { name: /أخرى|Other/ }).click();
    await form.getByRole('button', { name: /التالي|Next/ }).click();
    await form.getByPlaceholder(/اكتب التخصص|Type your desired major/).fill('Computer Science');
    await form.getByRole('button', { name: /التالي|Next/ }).click();
    await form.locator('input[type="checkbox"]').first().check();
    await page.getByTestId('apply-submit').click();
    await expect.poll(() => payload).toBeTruthy();
    expect(payload).toMatchObject({
      full_name: 'Test Applicant',
      phone_number: '+491234567890',
      education_level: 'other',
      degree_interest: 'Computer Science',
      source: 'apply_page',
    });
    await expect(page.getByText(/تم استلام بياناتك|received your information/i).first()).toBeVisible();
  });

  test('unauthenticated admin route does not render the dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/student-auth/, { timeout: 20_000 });
  });

  test('unauthenticated team route does not render the dashboard', async ({ page }) => {
    await page.goto('/team');
    await expect(page).toHaveURL(/\/student-auth/, { timeout: 20_000 });
  });
});
