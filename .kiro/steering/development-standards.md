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

### Pipeline
```
Feature Branch → QA Environment → E2E Tests → Production (manual gate)
```

### GitHub Actions
- `ci.yml` — Run tests on PRs
- `deploy-qa.yml` — Deploy to QA on feature branches
- `deploy-production.yml` — Deploy to production on push to main

### Git Rules
- Never push directly to `main` — use feature branches
- Never force-push to shared branches
- Production deploys require manual approval
- Commit messages: conventional commits (`feat:`, `fix:`, `docs:`, `security:`)

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
