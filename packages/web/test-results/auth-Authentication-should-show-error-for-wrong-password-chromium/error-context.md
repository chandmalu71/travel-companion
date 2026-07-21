# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication >> should show error for wrong password
- Location: e2e/auth.spec.ts:76:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('alert').or(getByText(/invalid|failed|error/i))
Expected: visible
Error: strict mode violation: getByRole('alert').or(getByText(/invalid|failed|error/i)) resolved to 2 elements:
    1) <div role="alert" class="rounded-md bg-red-50 p-4 text-sm text-red-700">Invalid email or password</div> aka getByText('Invalid email or password')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('alert').or(getByText(/invalid|failed|error/i))

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - img "Nayya" [ref=e7]
        - generic [ref=e8]: Nayya
      - heading "Sign in to your account" [level=2] [ref=e9]
      - paragraph [ref=e10]:
        - text: Or
        - link "create a new account" [ref=e11] [cursor=pointer]:
          - /url: /register
    - generic [ref=e12]:
      - alert [ref=e13]: Invalid email or password
      - generic [ref=e14]:
        - generic [ref=e15]:
          - generic [ref=e16]: Email address
          - textbox "Email address" [ref=e17]: test@example.com
        - generic [ref=e18]:
          - generic [ref=e19]: Password
          - textbox "Password" [ref=e20]: WrongPassword99
      - link "Forgot your password?" [ref=e22] [cursor=pointer]:
        - /url: /forgot-password
      - button "Sign in" [ref=e23] [cursor=pointer]
      - generic [ref=e28]: Or continue with
      - generic [ref=e29]:
        - button "Google" [ref=e30] [cursor=pointer]:
          - img [ref=e31]
          - text: Google
        - button "Microsoft" [ref=e36] [cursor=pointer]:
          - img [ref=e37]
          - text: Microsoft
        - button "Apple" [ref=e42] [cursor=pointer]:
          - img [ref=e43]
          - text: Apple
        - button "Facebook" [ref=e45] [cursor=pointer]:
          - img [ref=e46]
          - text: Facebook
  - alert [ref=e48]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * E2E: Authentication Flow
  5  |  * Tests registration, login, and session persistence.
  6  |  */
  7  | 
  8  | const TEST_USER = {
  9  |   email: `e2e-${Date.now()}@test.com`,
  10 |   password: 'SecurePass123',
  11 |   displayName: 'E2E Test User',
  12 | };
  13 | 
  14 | test.describe('Authentication', () => {
  15 |   test('should show landing page with sign in link', async ({ page }) => {
  16 |     await page.goto('/');
  17 |     await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();
  18 |     await expect(page.getByText(/nayya/i).first()).toBeVisible();
  19 |   });
  20 | 
  21 |   test('should navigate to login page', async ({ page }) => {
  22 |     await page.goto('/login');
  23 |     await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  24 |     await expect(page.getByLabel(/email/i)).toBeVisible();
  25 |     await expect(page.getByLabel(/password/i)).toBeVisible();
  26 |   });
  27 | 
  28 |   test('should navigate to register page', async ({ page }) => {
  29 |     await page.goto('/register');
  30 |     await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
  31 |   });
  32 | 
  33 |   test('should show validation error for empty login', async ({ page }) => {
  34 |     await page.goto('/login');
  35 |     await page.getByRole('button', { name: /sign in/i }).click();
  36 |     // HTML5 validation prevents submission with empty required fields
  37 |     const emailInput = page.getByLabel(/email/i);
  38 |     await expect(emailInput).toHaveAttribute('required', '');
  39 |   });
  40 | 
  41 |   test('should register a new account', async ({ page }) => {
  42 |     await page.goto('/register');
  43 | 
  44 |     await page.getByLabel(/display name/i).fill(TEST_USER.displayName);
  45 |     await page.getByLabel(/email address/i).fill(TEST_USER.email);
  46 |     await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
  47 |     await page.getByLabel(/confirm password/i).fill(TEST_USER.password);
  48 | 
  49 |     await page.getByRole('button', { name: /create account/i }).click();
  50 | 
  51 |     // Should show success message
  52 |     await expect(page.getByText(/account created/i)).toBeVisible({ timeout: 10000 });
  53 |   });
  54 | 
  55 |   test('should login with registered account', async ({ page }) => {
  56 |     // First register
  57 |     const email = `e2e-login-${Date.now()}@test.com`;
  58 |     await page.goto('/register');
  59 |     await page.getByLabel(/display name/i).fill('Login Test');
  60 |     await page.getByLabel(/email address/i).fill(email);
  61 |     await page.getByLabel('Password', { exact: true }).fill('TestPass1234');
  62 |     await page.getByLabel(/confirm password/i).fill('TestPass1234');
  63 |     await page.getByRole('button', { name: /create account/i }).click();
  64 |     await expect(page.getByText(/account created/i)).toBeVisible({ timeout: 10000 });
  65 | 
  66 |     // Then login
  67 |     await page.goto('/login');
  68 |     await page.getByLabel(/email/i).fill(email);
  69 |     await page.getByLabel(/password/i).fill('TestPass1234');
  70 |     await page.getByRole('button', { name: /sign in/i }).click();
  71 | 
  72 |     // Should redirect to dashboard
  73 |     await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  74 |   });
  75 | 
  76 |   test('should show error for wrong password', async ({ page }) => {
  77 |     // Use the test user we know exists
  78 |     await page.goto('/login');
  79 |     await page.getByLabel(/email/i).fill('test@example.com');
  80 |     await page.getByLabel(/password/i).fill('WrongPassword99');
  81 |     await page.getByRole('button', { name: /sign in/i }).click();
  82 | 
  83 |     // Should show an error (either alert role or text)
  84 |     await expect(
  85 |       page.getByRole('alert').or(page.getByText(/invalid|failed|error/i))
> 86 |     ).toBeVisible({ timeout: 10000 });
     |       ^ Error: expect(locator).toBeVisible() failed
  87 |   });
  88 | });
  89 | 
```