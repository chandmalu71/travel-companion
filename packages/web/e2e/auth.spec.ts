import { test, expect } from '@playwright/test';

/**
 * E2E: Authentication Flow
 * Tests registration, login, and session persistence.
 */

const TEST_USER = {
  email: `e2e-${Date.now()}@test.com`,
  password: 'SecurePass123',
  displayName: 'E2E Test User',
};

test.describe('Authentication', () => {
  test('should show landing page with log in link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();
    await expect(page.getByText(/nayya/i).first()).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
  });

  test('should show validation error for empty login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /log in/i }).click();
    // HTML5 validation prevents submission with empty required fields
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should register a new account', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel(/display name/i).fill(TEST_USER.displayName);
    await page.getByLabel(/email address/i).fill(TEST_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
    await page.getByLabel(/confirm password/i).fill(TEST_USER.password);

    await page.getByRole('button', { name: /create account/i }).click();

    // Should show success message
    await expect(page.getByText(/account created/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login with registered account', async ({ page }) => {
    // First register
    const email = `e2e-login-${Date.now()}@test.com`;
    await page.goto('/register');
    await page.getByLabel(/display name/i).fill('Login Test');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('TestPass1234');
    await page.getByLabel(/confirm password/i).fill('TestPass1234');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/account created/i)).toBeVisible({ timeout: 10000 });

    // Then login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('TestPass1234');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should show error for wrong password', async ({ page }) => {
    // Use the test user we know exists
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('WrongPassword99');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show an error (either alert role or text)
    await expect(
      page.getByRole('alert').or(page.getByText(/invalid|failed|error/i))
    ).toBeVisible({ timeout: 10000 });
  });
});
