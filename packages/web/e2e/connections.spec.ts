import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Connected Users / Travel Companions
 * Tests the connections page: viewing, adding, editing, removing companions.
 */

async function loginAs(page: Page, email = 'chand.malu@gmail.com', password = 'SuperAdmin2026!') {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('Travel Companions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('should navigate to connections page via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /my network/i }).click();
    await expect(page).toHaveURL('/connections');
    await expect(page.getByRole('heading', { name: /my network/i })).toBeVisible();
  });

  test('should display existing connections with status badges', async ({ page }) => {
    await page.goto('/connections');
    await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Bob Smith')).toBeVisible();
    // Check status badges
    await expect(page.getByText('Connected').first()).toBeVisible();
    await expect(page.getByText('Invited').first()).toBeVisible();
  });

  test('should display labels on connections', async ({ page }) => {
    await page.goto('/connections');
    // Wait for connections to load
    await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 5000 });
    // At least one label badge should be visible (Friend, Family, Partner, etc.)
    const labelBadge = page.locator('[class*="indigo"]'); // label badges use indigo styling
    await expect(labelBadge.first()).toBeVisible({ timeout: 3000 });
  });

  test('should filter connections by status', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    // Click "connected" filter
    await page.getByRole('button', { name: /connected/i }).first().click();
    await expect(page.getByText('Alice Johnson')).toBeVisible();
    await expect(page.getByText('Bob Smith')).toBeVisible();

    // Click "invited" filter
    await page.getByRole('button', { name: /invited/i }).first().click();
    await expect(page.getByText('Dana Wilson')).toBeVisible();
    await expect(page.getByText('External Friend')).toBeVisible();
  });

  test('should add a new connection manually', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    // Open add modal
    await page.getByRole('button', { name: /add contact/i }).click();
    await expect(page.getByRole('heading', { name: /add travel companion/i })).toBeVisible();

    // Fill form — use placeholder-based selectors to avoid login form ambiguity
    await page.getByPlaceholder('friend@example.com').fill('newcontact@test.com');
    await page.getByPlaceholder('e.g. Sarah').fill('Test Contact');
    await page.getByRole('button', { name: 'Other' }).click(); // select label

    // Submit
    await page.getByRole('button', { name: /add companion/i }).click();

    // Verify it appears in the list
    await expect(page.getByText('Test Contact')).toBeVisible({ timeout: 5000 });
  });

  test('should show error when adding duplicate connection', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByPlaceholder('friend@example.com').fill('alice@demo.neyya.ai');
    await page.getByRole('button', { name: /add companion/i }).click();

    // Should show duplicate error
    await expect(page.getByText(/already in your connections/i)).toBeVisible({ timeout: 5000 });
  });

  test('should edit a connection label and privacy', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    // Click on Alice's row to open edit modal
    await page.getByText('Alice Johnson').click();
    await expect(page.getByRole('heading', { name: /edit connection/i })).toBeVisible();

    // Change label to "Family"
    await page.getByRole('button', { name: 'Family' }).click();

    // Change privacy to "Limited"
    await page.getByText('Limited').click();

    // Save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Modal should close - verify label updated
    await expect(page.getByRole('heading', { name: /edit connection/i })).not.toBeVisible({ timeout: 3000 });
  });

  test('should remove a connection via API', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForTimeout(1000);

    const uniqueName = `Temp-${Date.now()}`;

    // Add a connection
    await page.getByRole('button', { name: /add contact/i }).click();
    await page.getByPlaceholder('friend@example.com').fill(`temp-${Date.now()}@test.com`);
    await page.getByPlaceholder('e.g. Sarah').fill(uniqueName);
    await page.getByRole('button', { name: /add companion/i }).click();
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });

    // Get connections via API and find the one we just added
    const token = await page.evaluate(() => localStorage.getItem('accessToken') ?? '');
    const listRes = await page.request.get('http://localhost:3000/api/connections', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await listRes.json();
    const conn = list.data.find((c: any) => c.name === uniqueName);
    expect(conn).toBeTruthy();

    // Delete via API
    const delRes = await page.request.delete(`http://localhost:3000/api/connections/${conn.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.ok()).toBeTruthy();

    // Reload page — item should be gone
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(page.getByText(uniqueName)).toHaveCount(0, { timeout: 5000 });
  });

  test('should show suggestion endpoint data', async ({ page }) => {
    // Test the suggestions API directly (used by trip invite forms)
    const response = await page.request.get('http://localhost:3000/api/connections/suggest', {
      headers: {
        Authorization: `Bearer ${await getToken(page)}`,
      },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toHaveProperty('name');
    expect(data.data[0]).toHaveProperty('email');
  });

  test('should show stats in filter tabs', async ({ page }) => {
    await page.goto('/connections');
    // Wait for data to load
    await expect(page.getByText('Alice Johnson')).toBeVisible({ timeout: 5000 });
    // The "All" filter should show a number > 0
    const allButton = page.locator('button').filter({ hasText: /all/i }).first();
    await expect(allButton).toBeVisible();
    // Should contain a number
    const text = await allButton.textContent();
    expect(text).toMatch(/\d+/);
  });
});

// Helper to get auth token from localStorage
async function getToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('accessToken') ?? '');
}
