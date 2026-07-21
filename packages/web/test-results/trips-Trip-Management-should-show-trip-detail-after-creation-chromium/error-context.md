# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: trips.spec.ts >> Trip Management >> should show trip detail after creation
- Location: e2e/trips.spec.ts:44:7

# Error details

```
Error: expect(received).toMatch(expected)

Expected pattern: /\/trips\/[a-f0-9-]+/
Received string:  "http://localhost:3001/trips/new"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - link "Nayya" [ref=e6] [cursor=pointer]:
        - /url: /dashboard
        - img "Nayya" [ref=e7]
      - navigation [ref=e8]:
        - link "🏠 Dashboard" [ref=e9] [cursor=pointer]:
          - /url: /dashboard
          - generic [ref=e10]: 🏠
          - text: Dashboard
        - link "✈️ Trips" [ref=e11] [cursor=pointer]:
          - /url: /trips
          - generic [ref=e12]: ✈️
          - text: Trips
        - link "📋 Bookings" [ref=e13] [cursor=pointer]:
          - /url: /bookings
          - generic [ref=e14]: 📋
          - text: Bookings
        - link "💰 Expenses" [ref=e15] [cursor=pointer]:
          - /url: /expenses
          - generic [ref=e16]: 💰
          - text: Expenses
        - link "🔍 Search" [ref=e17] [cursor=pointer]:
          - /url: /search
          - generic [ref=e18]: 🔍
          - text: Search
        - link "⚙️ Settings" [ref=e19] [cursor=pointer]:
          - /url: /settings
          - generic [ref=e20]: ⚙️
          - text: Settings
    - generic [ref=e21]:
      - banner [ref=e22]:
        - generic [ref=e23]:
          - button "Notifications" [ref=e24] [cursor=pointer]: 🔔
          - button "T Test User test@example.com" [ref=e26] [cursor=pointer]:
            - generic [ref=e28]: T
            - generic [ref=e29]:
              - paragraph [ref=e30]: Test User
              - paragraph [ref=e31]: test@example.com
            - img [ref=e32]
      - main [ref=e34]:
        - generic [ref=e35]:
          - heading "Create New Trip" [level=1] [ref=e36]
          - generic [ref=e37]:
            - alert [ref=e38]: Rate limit exceeded, retry in 7 seconds
            - generic [ref=e39]:
              - generic [ref=e40]: Trip Name *
              - textbox "Trip Name *" [ref=e41]:
                - /placeholder: e.g., Summer in Italy
                - text: Tab Test Trip
            - generic [ref=e42]:
              - generic [ref=e43]: Destination
              - textbox "Destination" [ref=e44]:
                - /placeholder: e.g., Rome, Italy
            - generic [ref=e45]:
              - generic [ref=e46]:
                - generic [ref=e47]: Start Date
                - textbox "Start Date" [ref=e48]
              - generic [ref=e49]:
                - generic [ref=e50]: End Date
                - textbox "End Date" [ref=e51]
            - generic [ref=e52]:
              - button "Create Trip" [ref=e53] [cursor=pointer]
              - button "Cancel" [ref=e54] [cursor=pointer]
  - alert [ref=e55]
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
  13 |   await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
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
> 56 |     expect(url).toMatch(/\/trips\/[a-f0-9-]+/);
     |                 ^ Error: expect(received).toMatch(expected)
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