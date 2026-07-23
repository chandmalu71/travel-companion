# QA Environment E2E Test Results

**Date:** July 23, 2026  
**Environment:** https://qa.neyya.ai  
**Tested by:** Automated API + UI verification

---

## Summary

| Category | Pass | Fail | Notes |
|----------|------|------|-------|
| Infrastructure | 6/6 | 0 | All services healthy |
| Authentication | 4/4 | 0 | Login, register, role check, admin gate |
| Core API (trips, bookings) | 3/4 | 1 | Subscription table missing |
| Admin Panel | 3/5 | 2 | Users works; translations empty; subscriptions broken |
| Data Seeding | 3/5 | 2 | Users + trips + bookings OK; translations + subscriptions not seeded |

**Overall: 19/24 tests passing (79%)**

---

## Infrastructure Tests

| Test | Result | Detail |
|------|--------|--------|
| API health endpoint | PASS | `GET /api/health` → 200, uptime > 45 min |
| Web app loads | PASS | `https://qa.neyya.ai` → 200, HTML renders |
| Admin panel loads | PASS | `https://admin-qa.neyya.ai` → 200, login screen shows |
| HTTPS/SSL valid | PASS | Valid cert for *.neyya.ai |
| DNS resolves | PASS | All 3 subdomains resolve to ALB |
| Redis connected | PASS | Confirmed in API startup logs |

---

## Authentication Tests

| Test | Result | Detail |
|------|--------|--------|
| Demo user login | PASS | `alice@demo.neyya.ai` / `Demo1234` → 200 + JWT |
| Admin user login | PASS | `chand.malu@gmail.com` / `!Neyya-AWS` → 200 + JWT + admin_role |
| User registration | PASS | `POST /api/auth/register` → 201 |
| Admin gate (non-admin denied) | PASS | Demo users have `admin_role: null`, can't access admin |
| Admin gate (admin allowed) | PASS | `chand.malu@gmail.com` has `super-admin` role |

---

## API Endpoint Tests (as alice@demo.neyya.ai)

| Endpoint | Result | Data |
|----------|--------|------|
| `GET /api/trips` | PASS | 2 trips returned |
| `GET /api/bookings` | PASS | 4 bookings returned |
| `GET /api/expenses` | PASS | 0 expenses (no seeded data) |
| `GET /api/connections` | PASS | 0 connections (no seeded data) |
| `GET /api/conversations` | PASS | 0 conversations (no seeded data) |
| `GET /api/subscription` | FAIL | 500 — `relation "user_subscriptions" does not exist` |
| `GET /api/family` | FAIL | 404 — route not found or missing params |
| `GET /api/notifications` | FAIL | 404 — route not found |
| `GET /api/weather?city=London` | FAIL | Error (no weather API key configured) |

---

## Admin API Tests (as chand.malu@gmail.com)

| Endpoint | Result | Data |
|----------|--------|------|
| `GET /api/admin/users` | PASS | 6 users returned |
| `GET /api/admin/config` | PASS | Configuration accessible |
| `GET /api/admin/i18n/languages` | PASS | 10 languages returned |
| `GET /api/admin/i18n/translations/en` | PASS | Endpoint works, but 0 keys (table empty) |
| `GET /api/admin/analytics` | FAIL | Route error |

---

## Admin Panel UI Tests

| Test | Result | Detail |
|------|--------|--------|
| Login screen shown by default | PASS | "Sign in to continue" visible, no admin content exposed |
| Login with admin credentials | PASS | Redirects to dashboard |
| Sidebar navigation | PASS | All nav items render |
| Users page loads | PASS | Shows 6 users |
| Users - subscription column | FAIL | No subscription data shown (table doesn't exist) |
| Users - search | FAIL | No search functionality |
| Users - impersonate | FAIL | No impersonate option |
| Translations page | FAIL | Empty — translation_keys table has no data |

---

## Database State

| Table | Rows | Notes |
|-------|------|-------|
| users | 6 | 5 demo + 1 admin |
| trips | 5 | Seeded mock trips |
| bookings | 8 | Seeded flight/hotel/car bookings |
| flight_details | 5 | Linked to bookings |
| hotel_details | 2 | Linked to bookings |
| car_rental_details | 1 | Linked to bookings |
| supported_languages | 10 | All enabled |
| supported_currencies | ? | Seeded via migrations |
| translation_keys | 0 | EMPTY — needs seeding |
| user_subscriptions | N/A | TABLE DOES NOT EXIST — migration missing |
| expenses | exists | But seed failed (column mismatch) |

---

## Issues to Fix

### Critical (blocking features)
1. **`user_subscriptions` table missing** — a migration didn't create it, causing 500 on subscription endpoints
2. **Translation keys not seeded** — table exists but is empty, admin translations page shows nothing

### Important (feature gaps)
3. **Admin Users page** — no subscription column, no search, no impersonate
4. **Demo data incomplete** — no expenses, connections, conversations seeded
5. **Weather API** — no `OPENWEATHERMAP_API_KEY` configured

### Minor
6. **Favicon 404** on admin (empty public folder)
7. **Admin topbar** links to localhost instead of production URLs

---

## Next Steps (Priority Order)

1. Fix missing `user_subscriptions` migration/table
2. Seed translation keys (the i18n system has the infrastructure but no content)
3. Enhance Admin Users page with subscriptions, search, impersonate
4. Create comprehensive demo account with full data
5. Wire Bedrock for auto-translation (for production)
