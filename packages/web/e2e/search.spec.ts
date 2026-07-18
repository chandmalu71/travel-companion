import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: AI Search Flow
 * Tests the search interface, filters, and results display.
 */

async function loginAs(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('TestPass1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('AI Search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('should navigate to search page', async ({ page }) => {
    await page.getByRole('link', { name: /search/i }).click();
    await expect(page.getByRole('heading', { name: /ai search/i })).toBeVisible();
  });

  test('should show search input and filters', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByPlaceholder(/cozy italian/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
  });

  test('should disable search button for short queries', async ({ page }) => {
    await page.goto('/search');
    await page.getByPlaceholder(/cozy italian/i).fill('a');
    await expect(page.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  test('should enable search button for valid queries', async ({ page }) => {
    await page.goto('/search');
    await page.getByPlaceholder(/cozy italian/i).fill('restaurants near me');
    await expect(page.getByRole('button', { name: /search/i })).toBeEnabled();
  });

  test('should show category filter dropdown', async ({ page }) => {
    await page.goto('/search');
    const select = page.locator('select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options).toContain('All Categories');
    expect(options).toContain('Restaurants');
  });
});
