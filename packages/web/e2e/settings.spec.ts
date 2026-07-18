import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Settings / Preferences Flow
 * Tests preference selection, allergy management, and save functionality.
 */

async function loginAs(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('TestPass1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('User Preferences', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page.getByRole('heading', { name: 'Preferences', exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show interest categories', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /interests/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /adventure/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /food/i })).toBeVisible();
  });

  test('should toggle interest selection', async ({ page }) => {
    await page.goto('/settings');
    const adventureBtn = page.getByRole('button', { name: /adventure/i });
    await adventureBtn.click();
    // After click, button should have the active style (primary color)
    await expect(adventureBtn).toHaveClass(/primary/);
  });

  test('should show dietary preferences', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /dietary/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /vegetarian/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /vegan/i })).toBeVisible();
  });

  test('should add an allergy', async ({ page }) => {
    await page.goto('/settings');
    // Known allergies should be visible as selectable chips
    await expect(page.getByRole('button', { name: /peanuts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /shellfish/i })).toBeVisible();
    // Click a known allergy to select it
    await page.getByRole('button', { name: /peanuts/i }).click();
    await expect(page.getByRole('button', { name: /peanuts/i })).toHaveClass(/red/);
  });

  test('should show save button', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: /save preferences/i })).toBeVisible();
  });

  test('should show temperature and distance selectors', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText(/temperature/i)).toBeVisible();
    await expect(page.getByText(/distance/i)).toBeVisible();
  });
});
