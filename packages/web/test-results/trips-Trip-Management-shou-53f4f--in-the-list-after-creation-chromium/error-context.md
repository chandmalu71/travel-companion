# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: trips.spec.ts >> Trip Management >> should show trips in the list after creation
- Location: e2e/trips.spec.ts:59:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /dashboard/
Received string:  "http://localhost:3001/login"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    24 × unexpected value "http://localhost:3001/login"

```

```yaml
- img "Nayya"
- text: Nayya
- heading "Sign in to your account" [level=2]
- paragraph:
  - text: Or
  - link "create a new account":
    - /url: /register
- alert: Rate limit exceeded, retry in 8 seconds
- text: Email address
- textbox "Email address": test@example.com
- text: Password
- textbox "Password": TestPass1234
- link "Forgot your password?":
  - /url: /forgot-password
- button "Sign in"
- text: Or continue with
- button "Google":
  - img
  - text: Google
- button "Microsoft":
  - img
  - text: Microsoft
- button "Apple":
  - img
  - text: Apple
- button "Facebook":
  - img
  - text: Facebook
- alert
```

# Test source

```ts
  1  | import { test, expect, type Page } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * E2E: Trip Management Flow
  5  |  * Tests creating, viewing, and managing trips.
  6  |  */
  7  | 
  8  | async function loginAs(page: Page, email = 'test@example.com', password = 'TestPass1234') {
  9  |   await page.goto('/login');
  10 |   await page.getByLabel(/email/i).fill(email);
  11 |   await page.getByLabel(/password/i).fill(password);
  12 |   await page.getByRole('button', { name: /sign in/i }).click();
> 13 |   await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  14 | }
  15 | 
  16 | test.describe('Trip Management', () => {
  17 |   test.beforeEach(async ({ page }) => {
  18 |     await loginAs(page);
  19 |   });
  20 | 
  21 |   test('should show dashboard after login', async ({ page }) => {
  22 |     await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  23 |   });
  24 | 
  25 |   test('should navigate to trips page', async ({ page }) => {
  26 |     await page.getByRole('link', { name: /trips/i }).first().click();
  27 |     await expect(page.getByRole('heading', { name: /my trips/i })).toBeVisible();
  28 |   });
  29 | 
  30 |   test('should create a new trip', async ({ page }) => {
  31 |     await page.goto('/trips/new');
  32 | 
  33 |     await page.getByLabel(/trip name/i).fill('E2E Test Trip');
  34 |     await page.getByLabel(/destination/i).fill('Paris, France');
  35 |     await page.getByLabel(/start date/i).fill('2026-09-01');
  36 |     await page.getByLabel(/end date/i).fill('2026-09-10');
  37 | 
  38 |     await page.getByRole('button', { name: /create trip/i }).click();
  39 | 
  40 |     // Should redirect to trip detail
  41 |     await expect(page).toHaveURL(/trips\//, { timeout: 10000 });
  42 |   });
  43 | 
  44 |   test('should show trip detail after creation', async ({ page }) => {
  45 |     // Create a trip first
  46 |     await page.goto('/trips/new');
  47 |     await page.getByLabel(/trip name/i).fill('Tab Test Trip');
  48 |     await page.getByRole('button', { name: /create trip/i }).click();
  49 | 
  50 |     // Wait for redirect to trip detail page
  51 |     await page.waitForURL(/trips\//, { timeout: 10000 });
  52 |     await page.waitForLoadState('networkidle');
  53 | 
  54 |     // The page should have loaded (either showing trip content or "Trip not found" won't appear if redirect worked)
  55 |     const url = page.url();
  56 |     expect(url).toMatch(/\/trips\/[a-f0-9-]+/);
  57 |   });
  58 | 
  59 |   test('should show trips in the list after creation', async ({ page }) => {
  60 |     await page.goto('/trips');
  61 |     await page.waitForLoadState('networkidle');
  62 |     // Page should load without crashing — either shows trips or empty state
  63 |     const pageContent = await page.textContent('body');
  64 |     expect(pageContent).toBeTruthy();
  65 |   });
  66 | });
  67 | 
```