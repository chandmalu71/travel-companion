# Test Coverage Analysis

## Summary (Jul 2026)

### Unit Tests (packages/api)

| Metric | Value |
|--------|-------|
| Test files | 43 |
| Tests total | 630 |
| **Tests passing** | **617** |
| Tests failing | 1 (socket timeout) |
| Tests skipped | 12 |
| Duration | 8.34s |

**Pass rate: 98%**

### E2E Tests (packages/web)

| Metric | Value |
|--------|-------|
| Test files | 5 |
| Tests total | 28 |
| **Tests passing** | **25** |
| Tests failing | 3 |
| Duration | 23.9s |

**Pass rate: 89%**

---

## Failing Tests Analysis

### Unit Test Failures

| Test | File | Issue | Root Cause |
|------|------|-------|-----------|
| Booking Routes setup | `bookings.test.ts` | `FST_ERR_DUPLICATED_ROUTE` | Adding new routes (i18n, trip-members, invitations) causes duplicate route registration when building app for test. Test needs isolation. |
| Collaboration overwrite notification | `collaboration.test.ts` | Socket connection timeout | Socket.io test server isn't starting fast enough. Intermittent — passes sometimes. |

### E2E Test Failures

| Test | File | Issue | Root Cause |
|------|------|-------|-----------|
| "should show error for wrong password" | `auth.spec.ts:76` | Expects specific error text | Error message text may have changed; test selector needs update |
| "should show trip detail after creation" | `trips.spec.ts:44` | Login doesn't redirect to dashboard | Login button text mismatch — E2E expects "Sign In" but button says "Log In" |
| "should show trips in the list" | `trips.spec.ts:59` | Same login redirect issue | Same as above |

---

## Coverage Gaps Identified

### Features WITHOUT test coverage

| Feature | Unit Tests | E2E Tests | Gap |
|---------|:---:|:---:|-----|
| Expense splitting | ❌ | ❌ | No tests for split calculation, settlement, partial payments |
| Source attachments | ❌ | ❌ | No tests for attachment CRUD or preview |
| Trip members/groups | ❌ | ❌ | New feature — no tests yet |
| Trip invitations | ❌ | ❌ | New feature — no tests yet |
| i18n/locale system | ❌ | ❌ | No tests for translation loading, formatting |
| Home location | ✅ | ❌ | Unit tests exist, no E2E |
| Admin panel | ❌ | ❌ | No tests for admin pages or admin API |
| Enhanced timeline cards | ❌ | ❌ | No tests for enriched timeline data |
| Add/Edit expense form | ❌ | ❌ | E2E tests exist for list but not for add/edit |
| Receipt upload | ❌ | ❌ | No tests for file upload flow |

### Features WITH good coverage

| Feature | Unit Tests | E2E Tests |
|---------|:---:|:---:|
| Authentication (login/register) | ✅ 45 tests | ✅ 8 tests |
| Trip CRUD | ✅ 32 tests | ✅ 3 tests |
| Booking CRUD | ✅ 48 tests | ❌ |
| Expense CRUD | ✅ 38 tests | ✅ 5 tests |
| Search | ✅ 22 tests | ✅ 4 tests |
| Settings/Preferences | ✅ 15 tests | ✅ 3 tests |
| Health endpoint | ✅ 8 tests | ❌ |
| Email webhooks | ✅ 28 tests | ❌ |
| Sharing/collaboration | ✅ 35 tests | ❌ |
| Favorites | ✅ 22 tests | ❌ |
| Map routes | ✅ 12 tests | ❌ |
| Notifications | ✅ 18 tests | ❌ |
| Sync | ✅ 15 tests | ❌ |
| Activity feed | ✅ 10 tests | ❌ |
| Property-based tests | ✅ 1 file | — |

---

## Recommended Test Additions (Priority Order)

### High Priority (Critical Business Logic)

1. **Expense splitting calculations** — equal split, percentage split, per-item split, balance computation
2. **Settlement simplification** — greedy algorithm for minimizing transactions
3. **Trip members CRUD** — add/remove/leave with expense check
4. **Trip invitations** — create, accept, decline, expire

### Medium Priority (User-Facing Features)

5. **Source attachments** — upload, link to expense/booking, view
6. **Enhanced timeline** — enriched data with new fields (PNR, seat, etc.)
7. **Admin role management** — promote/demote, create user
8. **i18n formatting** — formatDate, formatNumber, formatCurrency utilities

### Low Priority (Infrastructure)

9. **Admin panel pages** — smoke tests for each page rendering
10. **Translation loading** — fallback to English, key lookup
11. **E2E: expense add/edit/delete flow** — full CRUD cycle
12. **E2E: trip members/invite flow** — add member, invite, accept

---

## Fix Attempts for Failing Tests

### Attempt 1: E2E login button mismatch
- **Issue:** E2E tests use `getByRole('button', { name: /sign in/i })` but button text is "Log In"
- **Status:** Known mismatch — tests were written for older button text
- **Fix needed:** Update E2E selectors to match current UI

### Attempt 2: Bookings test duplicate route
- **Issue:** `buildApp()` in test registers all routes including newly added ones, causing conflicts
- **Status:** Pre-existing issue worsened by new route additions
- **Fix needed:** Test should mock route registration or use isolated app builder

### Attempt 3: Collaboration socket timeout
- **Issue:** Socket.io server doesn't start fast enough in CI-like environment
- **Status:** Intermittent — passes on retry ~50% of the time
- **Fix needed:** Increase timeout or add retry logic

---

## Recommendations

1. **Fix E2E login selector** — change `/sign in/i` to `/log in/i` across all E2E files
2. **Fix bookings test** — isolate app building to avoid route conflicts
3. **Add expense splitting tests** — highest-value addition given the complexity of balance calculations
4. **Add trip members tests** — new feature with CRUD + permission logic
5. **Consider adding API integration tests** for the new admin endpoints

---

## Running Tests

```bash
# Unit tests
cd packages/api && npx vitest run

# E2E tests (requires API + web servers running)
cd packages/web && npx playwright test

# Unit tests with coverage report
cd packages/api && npx vitest run --coverage
```
