---
inclusion: auto
---

# Travel Companion — Development Standards

## 1. Project Structure

```
travel-companion/
├── .kiro/
│   ├── steering/         # Steering files
│   └── specs/            # Feature specs (requirements, design, tasks)
├── .github/
│   └── workflows/        # CI/CD pipelines
├── docs/                 # Documentation by topic
│   ├── guides/
│   ├── deployment/
│   └── status-logs/
├── infrastructure/       # AWS CloudFormation templates
│   ├── cloudformation/
│   └── lambda/
├── public/               # Static assets (no source code)
├── src/
│   ├── components/       # Shared UI components
│   ├── services/         # Shared platform services
│   ├── hooks/            # Shared React hooks
│   ├── types/            # Shared type definitions
│   ├── styles/           # Global/shared CSS only
│   ├── utils/            # Shared utility functions
│   └── __tests__/        # Shared platform tests
├── e2e/                  # Playwright E2E tests
└── scripts/              # Shell scripts and utilities
```

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Docs and scripts | kebab-case | `deployment-guide.md`, `deploy-production.sh` |
| React components | PascalCase | `TripPlanner.tsx`, `ItineraryCard.tsx` |
| Services and hooks | PascalCase (files), camelCase (instances) | `TripService.ts` |
| CSS files | Match component name, co-located | `TripPlanner.css` next to `TripPlanner.tsx` |
| Test files | Match source + `.test.ts` | `TripService.test.ts` |

### CSS Co-location Rule

Each component's CSS lives next to its `.tsx` file:
- `src/components/TripCard.tsx` + `src/components/TripCard.css`

### Barrel Exports

Every `components/` directory must have an `index.ts` barrel export.

## 2. Technology Stack

- **Frontend:** React 18 + TypeScript
- **Build:** Vite (or Create React App)
- **State:** React hooks + services (singleton pattern)
- **Styling:** CSS modules with dark mode via `data-theme` attribute
- **Testing:** Jest (unit), Playwright (E2E), fast-check (property-based)
- **CI/CD:** GitHub Actions
- **Infrastructure:** AWS (S3, CloudFront, Lambda, DynamoDB, API Gateway, Cognito)
- **Region:** eu-west-1 (Ireland)

## 3. Shared Services Pattern

Use singleton services for cross-cutting concerns:

```typescript
export class ServiceName {
  private static instance: ServiceName | null = null;
  static getInstance(): ServiceName {
    if (!ServiceName.instance) {
      ServiceName.instance = new ServiceName();
    }
    return ServiceName.instance;
  }
}
```

Required shared services:
- **AuthenticationService** — OAuth (Google, Facebook, Apple) + email/password + guest
- **NotificationService** — In-app notifications (SUCCESS, ERROR, WARNING, INFO)
- **ErrorHandlingService** — Centralized error handling with severity levels
- **LocalStorageManager** — Persistent local data with encryption
- **ProfileManager** — User profile management
- **SecurityService** — HTTPS enforcement, CSP, XSS sanitization
- **RateLimiter** — Rate limiting for auth and API calls
- **TokenEncryptionService** — AES-GCM token encryption at rest

## 4. Authentication Pattern

Multi-provider OAuth with guest mode:
- Google (via Google Identity Services)
- Facebook, Apple, Yahoo OAuth
- Email/password with password reset
- Guest mode (limited features, login prompt after N actions)

Components:
- `AuthMenu` — dropdown with login/logout
- `LoginPrompt` — modal for unauthenticated users
- `EmailSignupForm`, `EmailLoginForm`, `PasswordResetForm`

## 5. Error Handling

- Wrap feature root components in `<ErrorBoundary componentName="[Name]">`
- Use `ErrorHandlingService.getInstance().handleError()` for programmatic errors
- Error types: `NETWORK`, `AUTHENTICATION`, `VALIDATION`, `STORAGE`, `SYSTEM`, `TIMEOUT`
- Severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- Show errors via NotificationService — never raw `alert()`

## 6. UI/UX Standards

### Responsive Design
- Mobile-first approach
- Breakpoint: 768px (mobile / desktop)
- Minimum touch target: 44x44px (WCAG 2.5.5)
- CSS variables for theming

### Dark Mode
- Supported via `data-theme` attribute on document root
- Use CSS variables, not hardcoded colors

### Button Standards
- Primary: solid background, white text (main actions)
- Secondary: outline/transparent (cancel, back)
- Danger: red (destructive actions)
- Minimum height: 36px standard, 44px large
- `white-space: nowrap`, adequate `min-width`

### CSS Conventions
- BEM naming: `.component__element--modifier`
- Mobile-first media queries
- CSS variables defined in root `App.css`

## 7. Security

- HTTPS enforcement in production
- Content Security Policy via meta tag
- Input sanitization (XSS prevention)
- Token encryption (AES-GCM via Web Crypto API)
- Rate limiting on auth attempts (5/15min, 30min block)
- Clickjacking prevention (frame-ancestors 'none')
- Secure random generation via `crypto.getRandomValues()`
- Never put secrets in `REACT_APP_*` env vars (they're in the bundle)

## 8. Testing

### Unit Tests
- Runner: Jest
- Location: `src/**/__tests__/*.test.ts`
- Property-based: fast-check library, `*.property.test.ts`

### E2E Tests
- Framework: Playwright
- Location: `e2e/[feature]/[scenario].spec.ts`
- Run: `npx playwright test`

## 9. CI/CD

### Branching Strategy (GitFlow)

```
feature/xyz  →  develop  →  main
     ↓              ↓          ↓
  Local dev      QA env     Production
```

| Branch | Purpose | Deploys to | Merge via |
|--------|---------|------------|-----------|
| `feature/*` | Individual features/fixes | — (local only) | PR → develop |
| `develop` | Integration branch, QA testing | qa.neyya.ai | PR → main |
| `release/*` | Pre-production stabilization | staging.neyya.ai | PR → main |
| `main` | Production-ready code only | neyya.ai | Manual approval |

### Branch Workflow

1. **Create feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature   # for features
   git checkout -b fix/my-bugfix        # for bug fixes
   git checkout -b chore/my-task        # for chores/docs/refactoring
   ```

2. **Develop and commit** on the branch (conventional commits)

3. **Push and create PR** to `develop`:
   ```bash
   git push -u origin feature/my-feature
   gh pr create --base develop --title "feat: my feature"
   ```

4. **After PR approval**, merge to `develop` (squash or merge commit)

5. **QA testing** happens on `develop` (auto-deploys to qa.neyya.ai)

6. **When ready for production**, create PR from `develop` → `main` (requires approval)

### Branch Naming

| Type | Prefix | Example |
|------|--------|---------|
| New feature | `feature/` | `feature/rich-timeline-cards` |
| Bug fix | `fix/` | `fix/expenses-toFixed-error` |
| Hotfix (urgent prod) | `hotfix/` | `hotfix/login-crash` |
| Chore/docs/refactor | `chore/` | `chore/update-steering-file` |

### Git Rules

- **NEVER push directly to `main`** — always via PR from develop
- **NEVER push directly to `develop`** — always via PR from feature/fix/chore branch
- **ALL changes** (features, bugs, hotfixes, docs, config, any modification) MUST go through a branch + PR
- Never force-push to shared branches (`main`, `develop`)
- Production deploys require manual approval
- Feature/fix branches are deleted after merge
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `security:`)

### Pipeline
```
Feature Branch → PR to develop → CI tests → Merge → QA auto-deploy
                                                        ↓
                                              PR to main → Approval → Production
```

### GitHub Actions
- `ci.yml` — Run tests on all PRs (to develop or main)
- `deploy.yml` — Deploy to QA on push to `develop`, staging on `release/*`, production on `main` (with approval)

## 10. Infrastructure (AWS eu-west-1)

- **S3** — Static site hosting
- **CloudFront** — CDN with custom domain
- **Lambda** — Backend functions
- **DynamoDB** — Data storage
- **API Gateway** — REST + WebSocket APIs
- **Cognito** — User authentication
- **CloudFormation** — Infrastructure as code

### Deployment
- QA: separate S3 bucket + CloudFront
- Production: separate S3 bucket + CloudFront + custom domain
- All resources in eu-west-1 (GDPR compliant)

## 11. PWA Support

- Service worker for offline functionality
- Web App Manifest for installability
- Cache-first strategy for static assets
- Network-first for API calls

## 12. Bug Tracking

All bugs MUST be recorded as GitHub Issues:
```bash
gh issue create --title "Bug: [description]" --label "bug"
```
Reference issues in fix commits: `fix: resolve X (closes #N)`


## 13. Admin Panel Implications

When adding any new feature, ALWAYS consider and implement admin panel support:

### Automatic Admin Requirements

Every new feature MUST include the following admin-side work (without needing explicit user request):

1. **Configuration** — If the feature has configurable settings, add an admin page/section to manage them
2. **Visibility** — If the feature produces data, add admin views to monitor/search/filter it
3. **Moderation** — If the feature involves user-generated content, add moderation controls
4. **Metrics** — If the feature has usage patterns, add counters/charts to the admin dashboard
5. **Toggle** — Every feature should have a global enable/disable toggle in admin config

### Checklist for New Features

When implementing any feature, verify:

- [ ] Does this need an admin toggle? (feature flags)
- [ ] Does this need admin CRUD? (manage entities)
- [ ] Does this produce data that admins need to see? (monitoring)
- [ ] Does this have rate-limiting or abuse potential? (thresholds)
- [ ] Does this need localization? (translation keys)
- [ ] Does this affect costs? (track in cost dashboard)
- [ ] Does this have audit-worthy actions? (log in audit trail)
- [ ] Does the admin sidebar need a new link?

### Admin Panel Architecture

- **Location**: `packages/admin/` — separate Next.js app on port 3002
- **Theme**: Dark (bg-gray-900, text-gray-100, tables: bg-gray-800/border-gray-700)
- **Layout**: Persistent sidebar (AdminSidebar in layout.tsx) + main content area
- **API**: Same backend at localhost:3000, admin endpoints at `/api/admin/*`
- **Auth**: Admin role required (super-admin or support from users.admin_role)

### Admin Pages by Feature Area

| Feature | Admin Page | What it manages |
|---------|-----------|-----------------|
| Users | `/users` | List, suspend, delete, impersonate |
| i18n/Locale | `/i18n` | Languages, currencies, locales enable/disable |
| Translations | `/i18n/translations` | Translation editor with auto-translate |
| Configuration | `/config` | Rate limits, feature flags |
| Costs | `/costs` | AWS cost breakdown, per-user attribution |
| Health | `/health` | API metrics, email queue, LLM usage |
| Moderation | `/moderation` | Content review, impersonation, announcements |
| Audit | `/audit` | Admin action log with search/filter |

## 14. Internationalization (i18n)

### When Adding UI Text

- **NEVER hardcode user-facing text** directly in JSX (for new features going forward)
- Use `t('namespace.key')` from the `useTranslation()` hook
- Add the English text to `packages/web/src/i18n/en.json`
- Use the naming convention: `{namespace}.{page_or_component}.{element}`
- Namespaces: `common`, `nav`, `auth`, `trips`, `bookings`, `expenses`, `settings`, `search`, `network`, `landing`, `flight`, `errors`
- **MUST also insert** the key into the `translation_keys` database table so it appears in Admin → Locale & Translation editor

### Translation Key Database Rule

When adding new translation keys to `en.json`, you MUST also insert them into the `translation_keys` PostgreSQL table:

```sql
INSERT INTO translation_keys (key, namespace, english_text, context) VALUES
  ('namespace.key_name', 'namespace', 'English text value', 'Brief description of where this is used')
ON CONFLICT (key) DO NOTHING;
```

This ensures:
- Keys appear in the Admin Translation Editor (`/admin/i18n/translations`)
- Admins can translate them to other languages via the UI
- The auto-translate feature (Bedrock) can pick them up
- Translation coverage reports are accurate

**If you skip this step, translations will only work in English** (the `en.json` fallback) but won't be translatable via the admin panel.

### When Adding Date/Number/Currency Display

- Use formatting utilities from `packages/web/src/i18n/format.ts`
- `formatDate(date, config)` — respects user's date format preference
- `formatTime(date, config)` — respects 12h/24h preference
- `formatNumber(num, config)` — respects number notation (1,000.00 vs 1.000,00)
- `formatCurrency(amount, currency, config)` — locale-aware currency display
- `formatDistance(km, config)` — km or miles based on units preference
- `formatTemperature(celsius, config)` — °C or °F based on units

### When Adding Currency Dropdowns

- Fetch enabled currencies from `GET /api/i18n/currencies`
- Fall back to hardcoded list if API unavailable
- Admin controls which currencies are available via admin panel

### Admin Translation Workflow

When new UI text is added (any feature, bug fix, or content change):
1. Add keys to `packages/web/src/i18n/en.json` (client-side fallback)
2. Insert keys into `translation_keys` DB table (enables admin management)
3. Keys will appear in Admin → Locale & Translation → Translation Editor
4. Admin can auto-translate via Bedrock or manually edit per language
5. Verify keys appear by checking: `SELECT count(*) FROM translation_keys WHERE namespace = 'your_namespace';`

## 15. Dark Theme Consistency (Admin Panel)

When creating admin panel pages, use these color classes:

| Element | Class |
|---------|-------|
| Page background | (inherited from layout: `bg-gray-900`) |
| Card/table background | `bg-gray-800` |
| Borders | `border-gray-700` |
| Primary text | `text-white` |
| Secondary text | `text-gray-300` |
| Muted text | `text-gray-400` |
| Table dividers | `divide-gray-700` |
| Hover state | `hover:bg-gray-700` |
| Active/selected | `bg-gray-700 text-white` |
| Input fields | `bg-gray-700 border-gray-600 text-white` |
| Buttons (primary) | Same as web app (`bg-primary-600`) |


## 16. Documentation Sync (Confluence + Spec Files)

When making changes that affect requirements, design, or architecture:

### Auto-Update Triggers

**ALL of the following MUST be updated** when a new feature is implemented:

1. **requirements.md** (`.kiro/specs/travel-companion/requirements.md`)
   - Add formal requirement with acceptance criteria
   - Number sequentially (Req 34, 35, etc.)

2. **design.md** (`.kiro/specs/travel-companion/design.md`)
   - Add component architecture (data model, API endpoints, UI components)
   - Include security considerations if PII/encryption involved

3. **tasks.md** (`.kiro/specs/travel-companion/tasks.md`)
   - Add implementation tasks (mark [x] for completed)
   - Group under a Phase heading

4. **Confluence** (Space: `Neyyaai`)
   - Update Features page with the new feature section
   - Keep "Designed But Not Yet Built" table current

### When to Update

- New feature implemented → all 4 docs
- Bug fix that changes behavior → requirements.md + Confluence
- New API endpoint → design.md + Confluence API Reference
- New database migration → design.md (data model)
- New admin page → Confluence Admin Panel Guide
- Architecture decision → design.md + Confluence Project Overview

### Confluence Space Details

- **Space Key:** `Neyyaai`
- **URL:** https://chandmalu.atlassian.net/wiki/spaces/Neyyaai
- **Root Page ID:** `2916520`
- **Key Page IDs:**
  - Project Overview: `3112961`
  - Features: `3047429`
  - API Reference: `3145729`
  - Database Schema: `3178497`
  - Development Guide: `3014660`
  - Deployment & Infrastructure: `3244033`
  - Admin Panel Guide: `3145749`
  - Test Coverage: `3211265`

### Update Process

After implementing a feature or fix that affects documentation:
1. Update requirements.md with acceptance criteria
2. Update design.md with architecture/data model
3. Update tasks.md with completed tasks
4. Update the relevant Confluence page(s) via the MCP Confluence tools
5. Use `mcp_atlassian_confluence_update_page_section` for targeted updates
6. Keep content concise and structured (markdown format)

## 17. Admin-Managed Configuration Pattern

All user-facing option lists (interests, dietary preferences, allergies, currencies, languages, locales) MUST be:

1. **Stored in the database** — not hardcoded in source code
2. **Managed via Admin panel** — add/edit/remove/enable/disable
3. **Fetched via API** — user-facing pages call an API to get available options
4. **Cacheable** — options rarely change, cache in Redis with 1h TTL

When adding a new "pick from list" feature:
- Create a DB table: `supported_{feature}` with id, name, icon, enabled, display_order
- Create admin API: GET all, PUT enable/disable
- Create public API: GET enabled only
- Create admin UI page with toggles
- User settings/forms fetch from the public API
