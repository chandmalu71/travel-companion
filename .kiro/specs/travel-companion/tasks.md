# Implementation Plan: Travel Companion

## Overview

This implementation plan builds the Travel Companion application incrementally, starting with project scaffolding and shared infrastructure, then layering in core features (auth, trips, bookings), followed by integrations (email, POI, AI search), views (timeline, map), and finally advanced features (expenses, sharing, offline sync). Each task builds on previous work and ends with wired, testable code.

## Tasks

- [x] 1. Project scaffolding and shared package setup
  - [x] 1.1 Initialize pnpm monorepo with workspace configuration
    - Create root `package.json` with pnpm workspaces pointing to `packages/*`
    - Create `pnpm-workspace.yaml`
    - Add root `tsconfig.json` with path aliases for `@travel-companion/shared`, `@travel-companion/api`, `@travel-companion/web`, `@travel-companion/mobile`
    - Add ESLint and Prettier config at root
    - _Requirements: 17.1, 17.2, 17.4_

  - [x] 1.2 Create shared package with core TypeScript interfaces and Zod schemas
    - Create `packages/shared/package.json` and `packages/shared/tsconfig.json`
    - Define all core interfaces: `User`, `Trip`, `Booking`, `FlightDetails`, `HotelDetails`, `CarRentalDetails`, `Favorite`, `Expense`, `Document`, `TimelineEvent`
    - Define Zod validation schemas for registration, login, trip creation, booking creation, expense creation
    - Define shared constants: expense categories, booking types, access levels, notification types
    - Define utility functions: date formatting, currency formatting
    - _Requirements: 1.1, 1.8, 3.2, 4.1, 18.1, 18.2_

  - [x] 1.3 Create API package with Fastify server skeleton
    - Create `packages/api/package.json` and `packages/api/tsconfig.json`
    - Set up Fastify server with CORS, helmet, rate limiting plugins
    - Add health check route (`GET /api/health`)
    - Set up environment variable configuration with `@fastify/env`
    - Add request logging with pino
    - Configure Vitest for API package testing
    - _Requirements: 17.4_

  - [x] 1.4 Set up database connection and migration framework
    - Add PostgreSQL client (`pg`) and Kysely query builder to API package
    - Create database connection pool configuration
    - Set up Kysely migration runner with `packages/api/src/db/migrations/` directory
    - Create initial migration with all core tables: `users`, `user_preferences`, `trips`, `trip_members`, `bookings`, `flight_details`, `hotel_details`, `car_rental_details`
    - Add all indexes from the design document
    - _Requirements: 1.1, 3.2, 4.1_

  - [x] 1.5 Create second database migration for supporting tables
    - Create migration for: `favorites`, `collections`, `favorite_collections`, `timeline_events`, `votes`, `expenses`, `expense_groups`, `group_members`, `expense_splits`, `settlements`
    - Create migration for: `documents`, `scheduled_notifications`, `notification_preferences`, `gap_alerts`, `activity_feed`, `share_links`, `highlights`, `email_connections`
    - Add all supporting indexes
    - _Requirements: 7.1, 8.6, 10.1, 16.1, 18.1, 21.1, 22.1, 23.1_

  - [x] 1.6 Set up Redis connection and session management
    - Add ioredis client to API package
    - Create Redis connection with config for ElastiCache
    - Implement session store plugin for Fastify
    - Implement rate limiting middleware using Redis counters
    - _Requirements: 1.4, 14.5_

- [x] 2. Authentication system
  - [x] 2.1 Implement registration and login routes
    - Create `packages/api/src/routes/auth.ts` with routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/oauth`, `POST /api/auth/password-reset`, `POST /api/auth/refresh`
    - Integrate with AWS Cognito User Pool for user creation and authentication
    - Implement password validation using shared Zod schema (8-128 chars, 1 upper, 1 lower, 1 digit)
    - Return JWT access token (1h expiry) and refresh token (30-day sliding expiry)
    - Send verification email on registration via Cognito
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8_

  - [x] 2.2 Implement account lockout mechanism
    - Track consecutive failed login attempts per email in Redis (counter with 15-min TTL)
    - After 3 consecutive failures, set lock key with 15-min TTL
    - Cognito Pre-Authentication Lambda checks lock key before allowing login
    - Reset counter on successful login
    - Return appropriate error message indicating lock duration
    - _Requirements: 1.4_

  - [x] 2.3 Write property test for password validation
    - **Property 1: Registration Input Validation**
    - Use fast-check to generate arbitrary strings and verify the password validator accepts iff length 8-128 AND contains uppercase, lowercase, and digit
    - **Validates: Requirements 1.1, 1.8**

  - [x] 2.4 Write property test for account lockout state machine
    - **Property 2: Account Lockout State Machine**
    - Use fast-check to generate sequences of login success/failure events and verify lockout triggers iff 3 consecutive failures without intervening success
    - **Validates: Requirements 1.4**

  - [x] 2.5 Implement auth middleware and session validation
    - Create Fastify `preHandler` hook that validates JWT from Authorization header
    - Decode user ID and attach to request context
    - Implement refresh token rotation endpoint
    - Handle expired tokens with 401 response
    - _Requirements: 1.3, 1.9_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Trip and booking management
  - [x] 4.1 Implement trip CRUD routes
    - Create `packages/api/src/routes/trips.ts` with routes: `POST /api/trips`, `GET /api/trips`, `GET /api/trips/:tripId`, `PUT /api/trips/:tripId`, `DELETE /api/trips/:tripId`
    - Validate trip name (1-100 chars) and dates (end >= start) using shared Zod schemas
    - On delete: unassign bookings/favorites (SET NULL) without deleting them
    - Sort trips by start date ascending, undated trips last
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 4.8_

  - [x] 4.2 Write property test for trip date range validation
    - **Property 5: Trip Date Range Validation**
    - Use fast-check to generate date pairs and verify the validator accepts iff end >= start
    - **Validates: Requirements 4.6, 8.8**

  - [x] 4.3 Implement booking CRUD routes
    - Create `packages/api/src/routes/bookings.ts` with routes: `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/:bookingId`, `PUT /api/bookings/:bookingId`, `DELETE /api/bookings/:bookingId`
    - Support query filter `?status=upcoming|in-progress|completed`
    - Calculate booking status dynamically based on current time vs start/end datetimes
    - Support creating flight, hotel, and car rental bookings with their type-specific detail tables
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 4.4 Write property test for booking status calculation
    - **Property 4: Booking Status Calculation**
    - Use fast-check to generate (current, start, end) datetime triples and verify status is "upcoming" if current < start, "in-progress" if start <= current <= end, "completed" if current > end
    - **Validates: Requirements 3.3**

  - [x] 4.5 Implement trip dashboard endpoint
    - Create `GET /api/trips/:tripId/dashboard` returning: trip details, bookings sorted by earliest date, gap alerts, weather summary placeholder, expense summary placeholder
    - Assign bookings to trips via `POST /api/trips/:tripId/bookings`
    - Implement trip suggestion logic: match bookings to trips by overlapping dates or destination
    - _Requirements: 3.1, 3.4, 4.2, 4.4_

  - [x] 4.6 Implement favorites and collections routes
    - Create `packages/api/src/routes/favorites.ts` with routes: `POST /api/favorites`, `GET /api/favorites`, `DELETE /api/favorites/:id`
    - Create collection routes: `POST /api/collections`, `GET /api/collections`, `PUT /api/collections/:id`, `DELETE /api/collections/:id`
    - Enforce 500 favorites per user limit, 50-char collection names, 1000-char notes
    - Associate favorites with trips; require trip selection or explicit "unassigned" choice
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

- [x] 5. Email integration and booking extraction
  - [x] 5.1 Implement email connection and OAuth flow
    - Create `packages/api/src/routes/email.ts` with route: `POST /api/email/connect`
    - Implement OAuth flow for Gmail API and Microsoft Graph API
    - Store encrypted access/refresh tokens in `email_connections` table
    - Implement token refresh logic
    - _Requirements: 2.1_

  - [x] 5.2 Implement email parsing service with AWS Comprehend
    - Create `packages/api/src/services/email-parser.ts`
    - Implement booking confirmation detection using AWS Comprehend custom classifier
    - Extract flight fields: airline, flight number, departure/arrival time, airports
    - Extract hotel fields: name, check-in/out dates, address
    - Extract car rental fields: company, pickup/return dates and locations
    - Implement regex fallback for common confirmation email formats
    - Process within 120 seconds of email receipt
    - _Requirements: 2.3, 2.4, 2.5, 2.9_

  - [x] 5.3 Implement email polling and webhook ingestion
    - Create SQS consumer worker for async email processing
    - Implement Gmail push notification webhook via Lambda
    - Implement forwarded email webhook endpoint: `POST /api/email/forward`
    - Implement 5-minute polling fallback for connected inboxes
    - On connect: scan last 90 days for booking confirmation emails
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 5.4 Implement booking deduplication logic
    - Before creating a new booking from email, check for duplicates:
      - Flights: same flight number AND date
      - Hotels: same hotel name AND check-in AND check-out dates
      - Car rentals: same company AND pickup AND return dates
    - Discard duplicates; create partial bookings when fields are missing and flag for user completion
    - Notify user of new bookings or extraction failures
    - _Requirements: 2.6, 2.8, 2.9_

  - [x] 5.5 Write property test for booking deduplication
    - **Property 3: Booking Deduplication**
    - Use fast-check to generate pairs of bookings and verify the dedup function identifies duplicates iff they match on the type-specific key
    - **Validates: Requirements 2.8**

- [x] 6. POI and AI search
  - [x] 6.1 Implement POI engine with Google Places API
    - Create `packages/api/src/services/poi.ts`
    - Create route: `GET /api/trips/:tripId/pois`
    - Accept query params: `latitude`, `longitude`, `radius` (1-50 km, default 5), `category`, `limit` (max 20)
    - Return POI results with name, category, rating (1-5), distance, opening hours, price level (1-4), photo URL
    - Cache results in Redis with 24h TTL keyed by `poi:{lat}:{lng}:{radius}:{category}`
    - Handle Google Places API unavailability with error message and retry option
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 6.2 Write property test for POI distance filtering
    - **Property 6: POI Distance Filtering**
    - Use fast-check to generate sets of POIs with coordinates, a center point, and radius (1-50 km), and verify the filter returns exactly those POIs within haversine distance <= radius
    - **Validates: Requirements 5.5**

  - [x] 6.3 Implement AI search service with AWS Bedrock
    - Create `packages/api/src/services/ai-search.ts`
    - Create route: `POST /api/search`
    - Accept query (2-500 chars), tripId, and optional filters (category, priceRange, minRating, maxDistance)
    - Implement personalization pipeline: embed query via Bedrock, retrieve user preferences, query Google Places, re-rank by interests/dietary, apply filters
    - Return max 20 results with name, description (max 200 chars), category, rating, estimated cost, distance, matchScore
    - Suggest broadening if < 3 results
    - Return within 3 seconds
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 6.4 Write property test for multi-criteria search filtering
    - **Property 7: Multi-Criteria Search Filtering**
    - Use fast-check to generate result sets and filter combinations, and verify the filter returns only results satisfying ALL active criteria and the result set is a subset of the input
    - **Validates: Requirements 6.5**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Timeline and map views (API layer)
  - [x] 8.1 Implement timeline event routes
    - Create `packages/api/src/routes/timeline.ts` with routes: `GET /api/trips/:tripId/timeline`, `POST /api/trips/:tripId/events`, `PUT /api/trips/:tripId/events/:eventId`, `DELETE /api/trips/:tripId/events/:eventId`
    - Return events grouped by day, sorted chronologically
    - Support day-by-day view (with time slots) and high-level overview (count, titles, time range)
    - Validate custom events: title required (max 100 chars), time required, notes max 500 chars
    - Reject events outside trip date range
    - Include bookings, favorites, and custom events on timeline
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 8.2 Implement map data endpoint
    - Create `GET /api/trips/:tripId/map` returning all geocoded locations for the trip
    - Include booking locations (departure/arrival airports, hotel addresses, pickup/return locations)
    - Include favorite/POI locations
    - Categorize markers by type with distinct category identifiers
    - Omit bookings without geocodable addresses and flag missing locations in response
    - Support day filtering via query param `?day=YYYY-MM-DD`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7_

  - [x] 8.3 Implement voting system for collaborative planning
    - Create routes: `POST /api/trips/:tripId/votes`, `DELETE /api/trips/:tripId/votes/:voteId`
    - Support upvote/downvote on favorites and timeline events
    - Enforce one vote per user per item
    - Return net vote count on favorites and events
    - _Requirements: 12.5_

- [x] 9. Notification service
  - [x] 9.1 Implement notification scheduling engine
    - Create `packages/api/src/services/notifications.ts`
    - On booking create/update: calculate reminder time = event time - user offset
    - Store in `scheduled_notifications` table with `fire_at` timestamp
    - Default offsets: flights 24h, hotels 8:00 AM local, car rentals 2h
    - If fire_at has passed: schedule within 5 minutes
    - On booking time change: delete old notification, create new one
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.7_

  - [x] 9.2 Implement notification delivery worker
    - Create background worker polling `scheduled_notifications` every minute for due notifications
    - Deliver via FCM (Android + Web push), APNs (iOS), SES (email fallback)
    - Support notification preferences per user (customizable offsets 15 min - 72h)
    - Create route: `PUT /api/users/:userId/notification-preferences`
    - _Requirements: 10.4, 10.6, 10.8_

  - [x] 9.3 Write property test for notification rescheduling
    - **Property 15: Notification Rescheduling**
    - Use fast-check to generate booking time changes and user offsets, and verify rescheduled fire time = new event time - offset; if in the past, scheduled within 5 minutes of now
    - **Validates: Requirements 10.5, 10.7**

- [x] 10. Sharing and collaboration
  - [x] 10.1 Implement trip sharing routes
    - Create `packages/api/src/routes/sharing.ts` with routes: `POST /api/trips/:tripId/share`, `GET /api/trips/:tripId/share/link`, `DELETE /api/trips/:tripId/share/:memberId`
    - Share via email invitation (up to 20 recipients)
    - Generate read-only shareable links expiring in 30 days
    - Support view-only and edit access levels
    - On revoke: immediately remove access
    - Validate email addresses
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7_

  - [x] 10.2 Implement real-time collaboration with Socket.io
    - Create `packages/api/src/services/collaboration.ts`
    - Set up Socket.io server with room-based architecture (room per trip)
    - Broadcast events: item_added, item_updated, item_removed, vote_cast
    - Implement conflict resolution: server-received timestamp wins (last write wins)
    - Notify overwritten collaborator via in-app notification within 30 seconds
    - _Requirements: 11.5, 12.1, 12.2, 12.3_

  - [x] 10.3 Implement activity feed
    - Create route: `GET /api/trips/:tripId/activity-feed?limit=50`
    - Record all collaborator actions (add, edit, remove items)
    - Display up to 50 most recent entries ordered by timestamp descending
    - Include user name, action, entity type, and timestamp
    - Handle collaborator removal: retain items, reassign attribution to owner (explicit revoke) or keep original attribution (voluntary leave)
    - _Requirements: 12.4, 12.6_

  - [x] 10.4 Write property test for conflict resolution
    - **Property 16: Conflict Resolution (Last Write Wins)**
    - Use fast-check to generate pairs of conflicting changes with different timestamps and verify the sync engine selects the later timestamp as winner
    - **Validates: Requirements 17.7, 13.5**

- [x] 11. Offline sync engine
  - [x] 11.1 Implement server-side sync protocol
    - Create `packages/api/src/routes/sync.ts` with route: `POST /api/sync`
    - Accept `SyncPayload` with `lastSyncTimestamp` and `localChanges`
    - Return `SyncResponse` with `serverChanges`, `conflicts`, and `newSyncTimestamp`
    - Implement last-write-wins conflict resolution by server timestamp
    - Support create/update/delete operations for all entity types
    - Synchronize within 10 seconds of connectivity
    - _Requirements: 13.4, 13.5, 17.3, 17.5, 17.6, 17.7_

  - [x] 11.2 Implement shared package sync utilities
    - Create `packages/shared/src/sync/` with offline queue management
    - Define `ChangeEntry` and `ConflictEntry` types
    - Implement change tracking: queue local changes while offline
    - Implement conflict notification logic for user alerts
    - Track last sync timestamp and display to user
    - Support selecting up to 10 trips for offline access (max 500MB)
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 13.7, 11.8_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Currency and weather services
  - [x] 13.1 Implement currency service
    - Create `packages/api/src/services/currency.ts`
    - Create routes: `GET /api/currency/convert`, `GET /api/currency/rates`
    - Integrate with Open Exchange Rates API
    - Implement 6-hour cron job to fetch rates, store in Redis with 24h TTL
    - Support 50+ currencies (all ISO 4217 major currencies)
    - On fetch failure: serve cached rates, set `rateStale: true`
    - Round converted amounts to 2 decimal places
    - Push rate updates via WebSocket within 60 seconds of new rates
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7_

  - [x] 13.2 Write property test for currency conversion
    - **Property 8: Currency Conversion Correctness**
    - Use fast-check to generate positive amounts, currency pairs, and rates, and verify conversion = amount × rate rounded to 2 decimal places, always positive
    - **Validates: Requirements 14.1**

  - [x] 13.3 Implement weather service
    - Create `packages/api/src/services/weather.ts`
    - Create route: `GET /api/trips/:tripId/weather`
    - Integrate with OpenWeatherMap One Call 3.0 API
    - Return daily forecasts (temp high/low C/F, precipitation %, conditions) for trips within 14 days
    - Return historical averages for trips beyond 14 days
    - Cache in Redis, display last-updated timestamp
    - Alert logic: notify user if delta > 5°C or precip delta > 30pp for trips starting within 7 days
    - Handle API unavailability gracefully
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 14. Expense tracking and receipt scanning
  - [x] 14.1 Implement expense CRUD routes
    - Create `packages/api/src/routes/expenses.ts` with routes: `POST /api/expenses`, `GET /api/expenses`, `GET /api/trips/:tripId/expenses/summary`, `PUT /api/expenses/:expenseId`, `DELETE /api/expenses/:expenseId`
    - Validate amount (0.01 - 999,999,999.99), currency, date, category (7 categories)
    - Support optional fields: merchant name, notes (max 500 chars), associated booking/trip
    - Convert to home currency using Currency_Service
    - Display both original and converted amounts
    - _Requirements: 18.1, 18.2, 18.6, 18.7, 18.9, 18.17_

  - [x] 14.2 Implement receipt scanning with AWS Textract
    - Create route: `POST /api/expenses/scan`
    - Accept JPEG, PNG, HEIC images up to 10MB
    - Use AWS Textract to extract: merchant name, total amount, currency, date
    - Suggest expense category based on merchant
    - Return confidence score and flag missing fields
    - Handle poor quality images with error message and retry option
    - Process within 10 seconds
    - _Requirements: 18.3, 18.4, 18.5, 18.15, 18.16_

  - [x] 14.3 Implement budget tracking and threshold alerts
    - Create route: `PUT /api/trips/:tripId/budget` to set trip budget (positive value, 0.01 - 999,999,999.99)
    - Track cumulative spending against budget
    - Fire 80% threshold alert (single alert, reset if drops below and re-crosses)
    - Fire 100% exceeded alert (single alert, reset if drops below and re-crosses)
    - Recalculate on expense add/edit/delete
    - _Requirements: 18.10, 18.11, 18.12, 18.14, 18.17_

  - [x] 14.4 Write property test for expense aggregation
    - **Property 9: Expense Aggregation Invariant**
    - Use fast-check to generate lists of expenses with categories and verify category subtotals sum to grand total
    - **Validates: Requirements 18.7**

  - [x] 14.5 Write property test for budget threshold detection
    - **Property 10: Budget Threshold Detection**
    - Use fast-check to generate budget amounts and sequences of expense additions/deletions, and verify 80% and 100% alerts fire iff cumulative crosses threshold from below
    - **Validates: Requirements 18.11, 18.12**

  - [x] 14.6 Implement expense export
    - Create route: `POST /api/trips/:tripId/expenses/export?format=pdf|csv`
    - Generate PDF report with date, merchant, category, original amount+currency, converted amount
    - Generate CSV with same fields
    - _Requirements: 18.13_

  - [x] 14.7 Implement daily expense breakdown for timeline
    - Add daily expense totals to timeline response
    - Aggregate expenses by day for the trip
    - Display on timeline alongside events
    - _Requirements: 18.8_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Flight check-in service
  - [x] 16.1 Implement check-in status and URL construction
    - Create `packages/api/src/services/checkin.ts`
    - Create routes: `GET /api/bookings/:bookingId/checkin-status`, `POST /api/bookings/:bookingId/checkin/complete`
    - Maintain airline IATA code → check-in URL template lookup table for supported airlines (Delta, United, AA, Southwest, BA, Lufthansa, Air France, Emirates)
    - Construct check-in URLs with booking reference and last name for supported airlines
    - For unsupported airlines: return generic check-in page URL
    - Display check-in window open/close times and time remaining
    - Disable check-in button after window closes; allow in-progress check-in to complete
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.8, 19.9, 19.10, 19.12_

  - [x] 16.2 Implement check-in notifications and completion flow
    - Schedule check-in reminder notification when check-in window opens (24h before departure)
    - Include direct link to initiate check-in in notification payload
    - On check-in complete: mark flight as "Checked In", update booking status badge
    - Prompt user to upload boarding pass, store via Document_Store
    - _Requirements: 19.5, 19.6, 19.7, 19.11_

- [x] 17. User preferences engine
  - [x] 17.1 Implement preferences CRUD
    - Create `packages/api/src/routes/preferences.ts` with route: `PUT /api/users/:userId/preferences`
    - Support interests (12 categories), dietary preferences (11 options), allergies (10 known + custom up to 50 chars each)
    - Support language selection (20+ languages), display currencies (multiple, first = default)
    - Store in `user_preferences` table, sync across platforms
    - Apply updated preferences within 5 seconds without restart
    - Handle defaults: no filters, English, device locale currency
    - _Requirements: 20.1, 20.2, 20.3, 20.7, 20.9, 20.12, 20.13, 20.14_

  - [x] 17.2 Wire preferences into AI search and POI results
    - In AI_Search: exclude results conflicting with dietary/allergy preferences; label accommodating results
    - In POI_Engine: display dietary compatibility indicator on restaurants
    - In AI_Search: boost results matching user interest categories
    - Implement currency toggle for switching between configured display currencies
    - Implement in-app currency converter accessible from expense/booking views
    - _Requirements: 20.4, 20.5, 20.6, 20.10, 20.11_

- [x] 18. Group expense splitting
  - [x] 18.1 Implement group expense splitter routes
    - Create `packages/api/src/routes/expense-groups.ts` with routes: `POST /api/trips/:tripId/groups`, `GET /api/trips/:tripId/groups/:groupId/balances`, `POST /api/expenses/:expenseId/split`, `PUT /api/settlements/:settlementId`
    - Create groups with trip owner + collaborators or manually added members
    - Support split types: equal, percentage (must sum to 100), per-item
    - Calculate net balances: who owes whom in home currency
    - Prompt user to mark expense as personal or shared when group is active
    - Allow marking debts as "settled"
    - Recalculate balances within 5 seconds of expense edit/delete
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10_

  - [x] 18.2 Write property test for equal expense split conservation
    - **Property 11: Equal Expense Split Conservation**
    - Use fast-check to generate positive amounts and group sizes (N >= 2), and verify equal split member amounts sum to original (within 1 cent); for percentage splits, verify percentages sum to 100
    - **Validates: Requirements 21.2, 21.7**

  - [x] 18.3 Write property test for group balance zero-sum
    - **Property 12: Group Balance Zero-Sum**
    - Use fast-check to generate groups with sets of shared expenses and splits, and verify sum of all net balances across all members equals zero
    - **Validates: Requirements 21.5**

- [x] 19. Gap detection
  - [x] 19.1 Implement gap detector service
    - Create `packages/api/src/services/gap-detector.ts`
    - Create route: `GET /api/trips/:tripId/gaps`
    - Implement detection rules:
      - Missing accommodation: nights within trip dates not covered by hotel booking
      - Missing transportation: consecutive-day bookings at different locations (>50km apart) without connecting transport
      - Scheduling conflicts: overlapping time ranges on same day
      - Unplanned arrival: flight/car arrives with no subsequent activity that day
    - Display gaps as advisory alerts categorized by type with suggested actions
    - Re-analyze within 30 seconds of booking add/remove/modify via SQS message
    - Allow dismissal; dismissed gaps don't reappear unless underlying data changes
    - Skip analysis for trips without dates set
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10_

  - [x] 19.2 Write property test for accommodation gap detection
    - **Property 13: Accommodation Gap Detection**
    - Use fast-check to generate trip date ranges and sets of hotel bookings, and verify the detector reports a gap for each night not covered by any booking's check-in to check-out range
    - **Validates: Requirements 22.1**

  - [x] 19.3 Write property test for scheduling conflict detection
    - **Property 14: Scheduling Conflict Detection**
    - Use fast-check to generate sets of events with start/end times on the same day, and verify a conflict is identified iff two events have overlapping time intervals (event1.start < event2.end AND event2.start < event1.end)
    - **Validates: Requirements 22.3**

- [x] 20. Social media sharing
  - [x] 20.1 Implement social sharing service
    - Create `packages/api/src/routes/highlights.ts` with routes: `POST /api/trips/:tripId/highlights`, `POST /api/trips/:tripId/highlights/:highlightId/share`, `POST /api/trips/:tripId/highlights/:highlightId/draft`
    - Allow selecting photos from device gallery, Document_Store, or trip uploads
    - Support caption (max 500 chars), tag trip name, tag destinations, include stats
    - Support layouts: single, carousel (up to 10 images), collage (2-6 images)
    - Generate preview before posting
    - Share via platform native share sheet (mobile) and URL/API (web) to Instagram, Facebook, X, WhatsApp
    - Save as draft for later posting
    - Record share event in activity feed
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.9, 23.10_

  - [x] 20.2 Write property test for social share data leakage prevention
    - **Property 17: Social Share Data Leakage Prevention**
    - Use fast-check to generate bookings with personal details (confirmation numbers, addresses, flight numbers) and user captions, and verify generated share content does not contain personal details unless they appear in the caption
    - **Validates: Requirements 23.8**

- [x] 21. Document storage
  - [x] 21.1 Implement document upload and management
    - Create `packages/api/src/routes/documents.ts` with routes: `POST /api/documents/upload`, `GET /api/trips/:tripId/documents`, `DELETE /api/documents/:documentId`
    - Upload to S3 with CloudFront delivery
    - Support PDF, JPEG, PNG, HEIC; max 25MB per file
    - Categorize: boarding pass, confirmation, voucher, visa, insurance
    - Auto-attach email source as confirmation document on booking extraction
    - Enforce 100 documents per trip limit
    - Make available offline via Sync_Engine
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_

- [x] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Web application (Next.js)
  - [x] 23.1 Set up Next.js web application
    - Create `packages/web/package.json` and configure with App Router
    - Set up Tailwind CSS and component library (shadcn/ui)
    - Configure API client to communicate with Fastify backend
    - Implement auth pages: login, register, forgot password, email verification
    - Implement protected route middleware checking JWT
    - _Requirements: 17.1, 1.1, 1.2, 1.9_

  - [x] 23.2 Implement web dashboard and trip views
    - Create dashboard page showing all trips sorted by date
    - Create trip detail page with: bookings list, timeline, map, expenses, documents, gap alerts
    - Implement booking cards with status badges and check-in buttons
    - Implement favorites/collections management UI
    - Implement sharing UI: invite by email, generate link, manage access
    - _Requirements: 3.1, 3.2, 3.6, 4.7, 7.1, 7.2, 11.1, 11.2_

  - [x] 23.3 Implement web timeline and map views
    - Build timeline component with day-by-day and overview modes
    - Integrate Google Maps SDK for map view with custom markers
    - Implement marker tap → summary card interaction
    - Support zoom, pan, day filtering, and viewport auto-fit
    - Display weather forecasts alongside timeline events
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 15.4_

  - [x] 23.4 Implement web expense and search features
    - Build expense tracker UI: add/edit/scan receipt, budget setting, category views
    - Build expense summary and export buttons (PDF/CSV download)
    - Build AI search interface with filters (category, price, rating, distance)
    - Build POI discovery panel with radius control
    - Build preference settings page
    - _Requirements: 18.1, 18.3, 18.7, 18.10, 18.13, 6.1, 6.5, 5.5, 20.1_

- [x] 24. Mobile application (React Native)
  - [x] 24.1 Set up React Native mobile application
    - Create `packages/mobile/package.json` and configure React Native project
    - Set up navigation (React Navigation) with tab and stack navigators
    - Configure native modules: camera, push notifications, offline storage (SQLite)
    - Implement auth screens: login, register, forgot password
    - Configure IndexedDB/SQLite for offline caching
    - _Requirements: 17.2, 13.1, 13.7_

  - [x] 24.2 Implement mobile dashboard and trip views
    - Create dashboard screen with trip list and booking overview
    - Create trip detail screen with tabs: timeline, map, expenses, documents
    - Implement pull-to-refresh and offline indicator
    - Implement push notification permission prompt and FCM/APNs registration
    - Implement check-in flow with in-app browser
    - _Requirements: 3.1, 10.4, 10.8, 13.2, 19.1, 19.2_

  - [x] 24.3 Implement mobile map, camera, and sharing features
    - Integrate Google Maps SDK for React Native with custom markers
    - Implement camera capture for receipt scanning
    - Implement social sharing via native share sheet
    - Implement offline trip selection (up to 10 trips)
    - Build collaborative planning UI with real-time updates via Socket.io
    - _Requirements: 9.1, 9.3, 18.3, 23.3, 23.7, 13.7, 12.1_

- [x] 25. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 26. Public landing page
  - [x] 26.1 Implement responsive landing page
    - Create root page with fixed header, hero carousel, features grid, how-it-works, about us, testimonials, FAQ, CTA, and footer
    - Header: logo, nav links (Features, About Us, How It Works, Help), Login/Sign Up buttons, mobile hamburger menu
    - Hero: 4-image auto-advancing carousel (5s) with Unsplash photos, headlines, CTAs
    - Features: 6-card responsive grid with icons and descriptions
    - Footer: 4-column layout with Privacy Policy, Terms, GDPR, Cookie Policy links
    - Fully responsive across mobile/tablet/desktop breakpoints
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10, 24.11, 24.12_

- [x] 27. End-to-end testing
  - [x] 27.1 Set up Playwright E2E test suite
    - Install Playwright with Chromium
    - Configure auto-start of API and web servers
    - Create test suites: auth, trips, expenses, search, settings
    - 28 tests covering registration, login, trip CRUD, expense list, search UI, preference management
    - Tests run in < 30 seconds locally
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7_

- [x] 28. Settings page improvements
  - [x] 28.1 Add known allergies as selectable chips
    - Display 10 known allergens (peanuts, tree nuts, shellfish, fish, eggs, milk, soy, wheat, sesame, sulfites) as toggle buttons
    - Retain custom allergy text input for non-standard allergies
    - _Requirements: 20.3_

  - [x] 28.2 Add display currency multi-selector
    - Display 15 major currencies as selectable chips
    - First selected = default (⭐ indicator), star button to change default
    - Minimum 1 currency required
    - _Requirements: 20.7, 20.9_

  - [x] 28.3 Add language selector
    - Dropdown with 20+ supported languages
    - _Requirements: 20.12_

- [x] 29. Email-forward booking ingestion
  - [x] 29.1 Implement booking ingestion service
    - Accept forwarded emails at trips@neyya.ai
    - Identify user by "From" email address
    - Match booking to trip (date overlap → destination → create new)
    - Support unclaimed bookings for unregistered users (60-day hold)
    - Send invitation email with booking summary and signup link
    - Claim-by-token for users with different email
    - Auto-claim on login/registration
    - Cleanup expired unclaimed bookings
    - _Requirements: 26.1-26.12_

  - [x] 29.2 Create unclaimed_bookings database migration
    - New table with email, booking_type, destination, dates, raw_data, claim_token, expires_at
    - Indexes on email, claim_token, expires_at
    - _Requirements: 26.6, 26.10_

  - [x] 29.3 Implement booking forward API routes
    - POST /api/bookings/forward — accept forwarded email (public, rate-limited)
    - POST /api/bookings/claim/:token — claim with verification token
    - GET /api/bookings/unclaimed — list unclaimed bookings for user
    - POST /api/bookings/claim-all — auto-claim all matching bookings
    - _Requirements: 26.3, 26.7_

- [x] 30. Connected email scanning (enhanced)
  - [x] 30.1 Implement multi-provider email scanner service
    - Support Gmail (OAuth), Outlook (OAuth), Yahoo (OAuth), IMAP (credentials+TLS)
    - Configurable scan frequency (realtime, 5min, 15min, 1hour, manual)
    - Manual "Scan Now" trigger
    - Connected-scan priority over forwarding (dedup at booking level)
    - Last scan timestamp + status tracking
    - Known sender domain list (airlines, hotels, car rentals, aggregators)
    - Subject keyword detection for booking relevance
    - _Requirements: 27.1-27.12_

  - [x] 30.2 Implement email connection management routes
    - GET /api/email/connections — list with status + supported providers
    - POST /api/email/connections — connect new account (OAuth or IMAP)
    - DELETE /api/email/connections/:id — disconnect (retains bookings)
    - PUT /api/email/connections/:id/frequency — update scan interval
    - POST /api/email/connections/:id/scan — manual "Scan Now"
    - _Requirements: 27.4, 27.5, 27.9, 27.12_

- [x] 31. Distributed shared trips
  - [x] 31.1 Implement shared trip collaboration service
    - Role management: owner, co-owner, editor, viewer
    - Merged timeline of all members' bookings
    - Booking assignment priority: shared trips → own trips → create new
    - Member departure handling (greyed out bookings, retained expenses)
    - Expense visibility: shared (visible to all) vs personal (owner only)
    - _Requirements: 28.1-28.24_

  - [x] 31.2 Database migration for shared trip enhancements
    - trip_members: departed, departed_at columns
    - expenses: is_shared column
    - email_connections: scan_frequency, is_active, imap fields
    - Updated access_level constraint for co-owner role
    - _Requirements: 28.3, 28.20_

  - [x] 31.3 Update booking ingestion for shared trip priority
    - Check shared trips first (date overlap, then destination)
    - Then check own trips
    - Create new only if no match
    - Ask user to confirm if multiple matches
    - _Requirements: 28.8, 28.15, 28.16_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The API layer is built first to enable both web and mobile clients to develop against stable endpoints
- TypeScript is used throughout the entire monorepo (shared, api, web, mobile packages)
- All property tests should be placed in `packages/shared/src/__tests__/properties/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.6"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["2.1", "2.2"] },
    { "id": 5, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 6, "tasks": ["4.1", "4.3"] },
    { "id": 7, "tasks": ["4.2", "4.4", "4.5", "4.6"] },
    { "id": 8, "tasks": ["5.1", "6.1", "8.1", "8.2"] },
    { "id": 9, "tasks": ["5.2", "5.3", "6.2", "6.3", "8.3"] },
    { "id": 10, "tasks": ["5.4", "6.4", "9.1"] },
    { "id": 11, "tasks": ["5.5", "9.2", "9.3"] },
    { "id": 12, "tasks": ["10.1", "10.2", "11.1"] },
    { "id": 13, "tasks": ["10.3", "10.4", "11.2"] },
    { "id": 14, "tasks": ["13.1", "13.3"] },
    { "id": 15, "tasks": ["13.2", "14.1"] },
    { "id": 16, "tasks": ["14.2", "14.3"] },
    { "id": 17, "tasks": ["14.4", "14.5", "14.6", "14.7"] },
    { "id": 18, "tasks": ["16.1", "17.1"] },
    { "id": 19, "tasks": ["16.2", "17.2", "18.1"] },
    { "id": 20, "tasks": ["18.2", "18.3", "19.1"] },
    { "id": 21, "tasks": ["19.2", "19.3", "20.1"] },
    { "id": 22, "tasks": ["20.2", "21.1"] },
    { "id": 23, "tasks": ["23.1", "24.1"] },
    { "id": 24, "tasks": ["23.2", "24.2"] },
    { "id": 25, "tasks": ["23.3", "23.4", "24.3"] }
  ]
}
```


---

## Phase 7: My Network, Family Members, Currency Conversion (Req 34-36)

- [x] 34.1 Create DB migration 015: user_connections table
  - user_id, connected_user_id (FK), connected_email, connected_name, status, label, privacy, source, notes
  - Unique index on (user_id, connected_user_id)
- [x] 34.2 Create API routes for connections
  - GET/POST/PUT/DELETE /api/connections + GET /api/connections/suggest
  - Auto-connect (bidirectional) when trip invitation accepted
- [x] 34.3 Create /connections web page (My Network)
  - Renamed to "My Network" with sidebar nav link
  - Filter tabs: all/connected/invited/declined
  - Add/edit/remove modals with labels and privacy
- [x] 34.4 Add "Select from My Network" to trip invite modal
  - Collapsible contact list in email channel, auto-fills recipient
- [x] 34.5 Add name autocomplete to Add Member modal
  - Fetches Network + Family contacts, live dropdown filter
  - Contact selection locks email/type fields (read-only chip display)
- [x] 34b.1 Create DB migration 016: family_members table
  - Encrypted passport fields (AES-256-GCM), dietary, allergies, travel preferences
  - Sharing scope controls (this_trip/all_trips/none)
- [x] 34b.2 Create API routes for family members
  - GET/POST/PUT/DELETE /api/family-members + /api/family-members/:id?reveal_passport=true
  - GET /api/family-members/for-trip (shared preferences for trip context)
- [x] 34b.3 Create Family tab in /connections page
  - Add modal: name, relationship, DOB, gender, chip-based dietary/allergies (same as Settings)
  - Edit modal with sharing scope, passport section (collapsible, encrypted)
  - IATA flight meal codes (16 options) with descriptions and airline disclaimer
- [x] 34b.4 Wire family members into trip flow
  - "Family" button in Members tab → picker modal
  - One-click add with auto-detected child type
- [x] 35.1 Create exchange rates API endpoint
  - GET /api/i18n/exchange-rates — 40 currencies, USD base
- [x] 35.2 Create useUserCurrency hook
  - Fetches display currencies + exchange rates
  - convert() function for cross-currency math
- [x] 35.3 Wire currency conversion to Expenses page and Trip expenses tab
  - Total in user's preferred currency, individual items show converted equivalent
  - I18nProvider added to dashboard layout
  - formatCurrency uses Intl.NumberFormat with locale
- [x] 36.1 Add landing page translation keys
  - 74 keys in landing.* namespace, 33 keys in flight.meal.*, 10 in network.*
  - All inserted into translation_keys DB table for Admin Translation Editor
  - Total: 265 keys across 12 namespaces


## Phase 7b: Shared Family Visibility (Req 37)

- [x] 37.1 Add visibility_to_connections column to family_members table
  - Values: private (default), connections, specific
  - Updated DB types, POST/PUT API to accept and store it
- [x] 37.2 Create GET /api/connections/:userId/family endpoint
  - Verifies connection status (must be 'connected')
  - Only returns members with visibility = 'connections'
  - Never exposes passport data
- [x] 37.3 Update /api/family-members/for-trip to include connected users' visible family
  - Returns combined list: own (source='own') + connected (source='connection', ownerName)
  - Uses JOIN on user_connections + family_members tables
- [x] 37.4 Update Network UI with expandable family section
  - "Family" toggle button on each connected user row
  - Expands inline list showing name, relationship, allergies (read-only)
- [x] 37.5 Update trip autocomplete to include connected family
  - Shows as "Their family" badge with "via OwnerName" subtitle
  - Auto-detects child type on selection


## Phase 8: AI Trip Tips (Req 38)

- [x] 38.1 Create DB migration 017: trip_tips + trip_tip_chats tables
  - trip_tips: trip_id, user_id, category, title, content, checklist (JSONB), is_favorited, is_dismissed, source, ai_model, generated_at, expires_at
  - trip_tip_chats: trip_id, user_id, role (user/assistant), message, ai_model
  - 8 categories: activities, packing, precautions, culture, food, transport, budget, documents
- [x] 38.2 Create API routes for trip tips
  - GET /api/trips/:tripId/tips — list non-dismissed tips
  - POST /api/trips/:tripId/tips/generate — generate tips with trip context + user preferences + family
  - PUT /api/trips/:tripId/tips/:id — favorite, dismiss, update checklist
  - POST /api/trips/:tripId/tips/chat — ask follow-up question (contextual AI response)
  - GET /api/trips/:tripId/tips/chat — get chat history
- [x] 38.3 Create Tips tab UI in trip detail page
  - "AI Tips" tab with generate/regenerate button
  - Expandable category cards with icon, title, content, checklist
  - Checkable items with persist
  - Favorite (star) and dismiss (x) buttons
  - Progress indicator (X/Y done)
- [x] 38.4 Add chat follow-up section
  - Chat bubbles (user right, assistant left)
  - Text input with Enter-to-send
  - Loading state ("Thinking...")
  - Contextual responses based on destination


## Phase 9: Weather Integration (Req 39)

- [x] 39.1 Create weather API service + endpoints
  - GET /api/trips/:tripId/weather — full forecast + alerts + home weather
  - GET /api/weather/location?lat=X&lng=Y — live GPS weather
  - GET /api/weather/alerts/:tripId — weather alerts only
  - Mock data in dev (destination-aware), OpenWeatherMap in production
- [x] 39.2 Create Weather tab in trip detail page
  - Day-by-day forecast cards (icon, temp high/low, precipitation, wind, UV, humidity)
  - Weather alerts section (color-coded: info/warning/severe with suggestions)
  - Live GPS weather button (📍 Live Weather)
  - Home weather comparison card
  - Data source attribution
- [x] 39.3 Add weather widget to trip Overview tab
  - Horizontal scrollable strip (first 5 days)
  - Day name, weather icon, high/low temp, rain badge (>30%)


## Phase 10: Messaging & Communications (Req 40)

- [x] 40.1 Create DB migration 018: conversations, messages, reactions, polls, poll_votes, trip_decisions
  - 7 tables with proper FK cascades and indexes
  - Supports: DM, group, family, trip, broadcast conversation types
- [x] 40.2 Create messaging API (14 endpoints)
  - Conversations: list, create (DM/group/trip)
  - Messages: list, send (with @AI auto-response), edit, delete, threads
  - Reactions: add/remove emoji
  - Polls: create, vote
  - Trip Decisions: list, create (promote from message), vote
- [x] 40.3 Create Messages page (/messages)
  - Left sidebar: conversation list with type icons, unread badges, preview
  - Right panel: chat view with message bubbles, threaded replies, emoji reactions
  - New Conversation modal: DM or Group, select from Network contacts
- [x] 40.4 Create Trip Chat tab + Trip Decisions
  - Chat tab in trip detail (auto-creates trip conversation)
  - @AI support with contextual responses
  - "Promote to Trip Decision" on message hover
  - Trip Decisions panel with voting (yes/no)
  - Create Poll modal (question + N options)
- [x] 40.5 Admin Configuration
  - Messaging section: sidebar messages toggle, trip chat toggle, AI toggle, polls toggle
  - Broadcast permissions (owner only / owner+co-owners)
  - Max message length, max group size, retention policy
  - Notification channels (in-app, email, WhatsApp, SMS)
  - Added messaging_ai to AI Model Configuration


## Phase 11: Customizable Dashboard (Req 41)

- [x] 41.1 Create API: GET/PUT /api/users/me/dashboard-config
  - Stored as JSONB in user_preferences.dashboard_widgets
  - Default: quick_actions, upcoming_trips, recent_expenses, messages, network, weather, ai_tips
- [x] 41.2 Create Dashboard page with widget grid
  - 10 widget components (each fetches own data, links to full page)
  - Quick Actions bar with 6 links
  - Customize modal (checkbox grid, save/reset)
  - Responsive grid (1/2/3 cols)
- [x] 41.3 Admin configuration
  - Dashboard Widgets section in Admin → Configuration
  - Toggle availability of each widget globally


## Phase 12: Email Aliases (Req 42)

- [x] 42.1 Create DB table + API endpoints
  - user_email_aliases (user_id, email UNIQUE, is_verified, verification_token, expires_at, source)
  - GET /api/email-aliases, POST (add + verify), POST /verify, DELETE, GET /lookup
- [x] 42.2 Settings UI + booking-forward update
  - Email Aliases section in Settings → Profile & Account
  - Add/remove/verify flow, verified/pending badges
  - Booking ingestion now checks aliases after primary email
- [x] 42.3 Admin config
  - Max aliases (5/10/15), login-with-alias toggle, verification requirement toggle


## Phase 13: Subscription & Pricing (Req 43)

- [x] 43.1 Create DB schema + seed plans
  - subscription_plans, user_subscriptions, subscription_family_members, subscription_campaigns
  - 3 plans seeded: Free/Pro/Premium with all limits
  - 2 campaigns seeded: LAUNCH50, EARLYBIRD
- [x] 43.2 Create subscription API
  - GET /api/plans (public), GET /api/subscription, POST start-trial, POST upgrade
  - POST cancel/reactivate, POST apply-campaign, GET limits + usage
  - POST /api/webhooks/stripe (stub)
- [x] 43.3 Create Pricing page + Settings subscription UI
  - Public /pricing page with plan cards, monthly/annual toggle, campaign codes
  - Settings → Subscription section (plan name, status, cancel/reactivate)
- [x] 43.4 Admin subscriptions page
  - Plans tab: view/edit all plan limits and prices
  - Campaigns tab: view/create/disable campaigns
  - User Overrides tab: grant free Premium to specific users
  - Settings tab: trial duration, grace period, retry attempts, auto-renew, Stripe config


---

## Phase 14: Infrastructure & Deployment (July 2026)

- [x] 14.1 Docker containerization
  - Dockerfiles for API, Web, Admin (multi-stage, linux/amd64)
  - docker-compose.yml for local development
  - .dockerignore for lean images
- [x] 14.2 AWS infrastructure (CloudFormation)
  - VPC, subnets, security groups (network.yml)
  - ECR repositories (ecr.yml)
  - ECS cluster, ALB, services (ecs-services.yml)
  - RDS PostgreSQL + ElastiCache Redis
- [x] 14.3 CI/CD pipeline
  - GitHub Actions: test → build → push → deploy
  - Auto-deploy to QA on push to develop
  - Manual/main deploy to production
- [x] 14.4 DNS & SSL
  - ACM certificate for *.neyya.ai
  - Route 53 records (api-qa, qa, admin-qa)
  - HTTPS listener with host-based routing
- [x] 14.5 Secrets management
  - AWS Secrets Manager for all credentials
  - OAuth, Stripe, DB, Redis, JWT, API keys
- [x] 14.6 External services wired (QA)
  - Google OAuth, Microsoft, Facebook
  - Stripe (test mode)
  - OpenWeatherMap, SES (domain verified)
  - Google Maps Embed API
- [ ] 14.7 Production deployment (pending)
  - Deploy production stacks
  - Production secrets + live Stripe keys
  - DNS cutover (neyya.ai → production ALB)
  - SES production access request

## Phase 15: Admin Panel Enhancements

- [x] 15.1 Auth gate (login required, admin_role check)
- [x] 15.2 Users page — API integration, search, pagination, subscription column, impersonate
- [x] 15.3 Translations page — seeded 350+ keys, auto-translate endpoint
- [x] 15.4 OAuth provider management (enable/disable/coming soon)
- [x] 15.5 Subscription plans seeded (Free €0, Pro €14.99, Premium €29.99)
- [ ] 15.6 OAuth provider state persistence (save to Redis/DB, not just config response)
- [ ] 15.7 Rate limits page — live configuration

## Phase 16: Demo & Data Quality

- [x] 16.1 Demo account (demo@neyya.ai) with Premium subscription
- [x] 16.2 5 trips with bookings (flights, hotels, car rentals)
- [x] 16.3 12 expenses (personal + shared, multi-currency)
- [x] 16.4 Family members (spouse + child)
- [x] 16.5 Conversations + messages (3 chats, 14 messages)
- [x] 16.6 AI trip tips with checklists (6 tips)
- [x] 16.7 AI tip chat Q&A (6 messages)
- [x] 16.8 Trip travellers populated (13 entries across 5 trips)
- [x] 16.9 User preferences (dietary, allergies, interests)
- [x] 16.10 Nightly reset script (preserves seeded data)
- [ ] 16.11 Fix Oliver (child) family member duplicate
- [ ] 16.12 Add sample documents/boarding passes

## Phase 17: Profile & User Settings

- [x] 17.1 Migration 021: first_name + last_name columns on users table
- [x] 17.2 GET/PUT /api/user/profile endpoint
- [x] 17.3 Profile name section in Settings UI (first name + last name fields)
- [x] 17.4 Translation keys for profile fields
- [ ] 17.5 Avatar upload (S3 presigned URL)
- [ ] 17.6 Password change flow
- [ ] 17.7 Email verification flow (SES)
- [ ] 17.8 Account deletion (GDPR)

## Phase 18: Trip Photos & Gallery (Req 44) — DEFERRED

**Target:** Mobile app phase  
**Current:** UI stub only

- [x] 18.1 Requirements written (12 acceptance criteria)
- [x] 18.2 UI stub: /photos page with premium gate
- [x] 18.3 Photos added to left sidebar navigation
- [x] 18.4 Translation keys (13 keys)
- [ ] 18.5 DB migration: trip_photos, photo_albums, photo_reactions, photo_comments
- [ ] 18.6 S3 upload with presigned URLs + thumbnail generation
- [ ] 18.7 Photo encryption (AES-256, optional client-side)
- [ ] 18.8 EXIF extraction + auto-grouping by date
- [ ] 18.9 Album CRUD API
- [ ] 18.10 Visibility toggle API (personal/shared/public link)
- [ ] 18.11 Reactions + comments API
- [ ] 18.12 Global photos page with masonry grid
- [ ] 18.13 Photo viewer lightbox
- [ ] 18.14 Plan limit enforcement (storage per tier)
- [ ] 18.15 Auto-sync from phone gallery (mobile only)

## Phase 19: AI Social Sharing (Req 45) — DEFERRED

**Target:** Post-launch, Premium feature  
**Current:** UI stub only

- [x] 19.1 Requirements written (12 acceptance criteria)
- [x] 19.2 UI stub: /trips/:id/share page (3-step flow)
- [x] 19.3 Translation keys (17 keys)
- [ ] 19.4 DB migration: share_posts, connected_social_accounts
- [ ] 19.5 AI generation endpoint (Bedrock Claude)
- [ ] 19.6 Tone-based prompt templates
- [ ] 19.7 Photo selection algorithm (pick best 1-4)
- [ ] 19.8 Copy-to-clipboard flow (V1)
- [ ] 19.9 Connected social accounts OAuth (V2)
- [ ] 19.10 Direct posting API (V2)
- [ ] 19.11 Post-trip trigger ("Share your highlights?")
- [ ] 19.12 Daily highlight suggestion (during trip)
- [ ] 19.13 Premium gate with upgrade hook
- [ ] 19.14 Share history per trip

## Phase 20: Trip Card Header Images (Req 46) — DONE

- [x] 20.1 Unsplash destination image mapping (25+ cities)
- [x] 20.2 Trip card UI with header image + gradient overlay
- [x] 20.3 Destination pin on image
- [x] 20.4 Lazy loading
- [x] 20.5 Fallback image for unknown destinations
