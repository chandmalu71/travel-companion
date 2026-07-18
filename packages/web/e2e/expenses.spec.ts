import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Expense Tracking Flow
 * Tests viewing expenses, the scan receipt modal, and navigation.
 */

async function loginAs(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('TestPass1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('Expense Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('should navigate to expenses page', async ({ page }) => {
    await page.getByRole('link', { name: /expenses/i }).click();
    await expect(page.getByRole('heading', { name: /expenses/i })).toBeVisible();
  });

  test('should show total expenses summary', async ({ page }) => {
    await page.goto('/expenses');
    await expect(page.getByText(/total expenses/i)).toBeVisible();
  });

  test('should open scan receipt modal', async ({ page }) => {
    await page.goto('/expenses');
    await page.getByRole('button', { name: /scan receipt/i }).click();
    await expect(page.getByRole('heading', { name: /scan receipt/i })).toBeVisible();
  });

  test('should close scan receipt modal', async ({ page }) => {
    await page.goto('/expenses');
    await page.getByRole('button', { name: /scan receipt/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: /scan receipt/i })).not.toBeVisible();
  });
});
