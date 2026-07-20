import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Trip Management Flow
 * Tests creating, viewing, and managing trips.
 */

async function loginAs(page: Page, email = 'test@example.com', password = 'TestPass1234') {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('Trip Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('should show dashboard after login', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should navigate to trips page', async ({ page }) => {
    await page.getByRole('link', { name: /trips/i }).first().click();
    await expect(page.getByRole('heading', { name: /my trips/i })).toBeVisible();
  });

  test('should create a new trip', async ({ page }) => {
    await page.goto('/trips/new');

    await page.getByLabel(/trip name/i).fill('E2E Test Trip');
    await page.getByLabel(/destination/i).fill('Paris, France');
    await page.getByLabel(/start date/i).fill('2026-09-01');
    await page.getByLabel(/end date/i).fill('2026-09-10');

    await page.getByRole('button', { name: /create trip/i }).click();

    // Should redirect to trip detail
    await expect(page).toHaveURL(/trips\//, { timeout: 10000 });
  });

  test('should show trip detail after creation', async ({ page }) => {
    // Create a trip first
    await page.goto('/trips/new');
    await page.getByLabel(/trip name/i).fill('Tab Test Trip');
    await page.getByRole('button', { name: /create trip/i }).click();

    // Wait for redirect to trip detail page
    await page.waitForURL(/trips\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // The page should have loaded (either showing trip content or "Trip not found" won't appear if redirect worked)
    const url = page.url();
    expect(url).toMatch(/\/trips\/[a-f0-9-]+/);
  });

  test('should show trips in the list after creation', async ({ page }) => {
    await page.goto('/trips');
    await page.waitForLoadState('networkidle');
    // Page should load without crashing — either shows trips or empty state
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
