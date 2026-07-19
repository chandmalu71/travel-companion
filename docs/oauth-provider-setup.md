# OAuth Provider Setup Guide — Nayya.ai

This guide covers registering your app with each OAuth provider to enable "Sign in with..." and email scanning features.

## Table of Contents

1. [Google (Gmail + Login)](#1-google)
2. [Microsoft (Outlook + Login)](#2-microsoft)
3. [Apple (Login)](#3-apple)
4. [Facebook (Login)](#4-facebook)
5. [Environment Variables Summary](#5-environment-variables)

---

## 1. Google

**Used for:** Sign in with Google + Gmail inbox scanning

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name: `Nayya` → Create
4. Select the project

### Step 2: Enable APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - **Google Identity** (for login)
   - **Gmail API** (for inbox scanning)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (for public users)
3. Fill in:
   - App name: `Nayya`
   - User support email: your email
   - Logo: upload Nayya logo
   - App domain: `https://nayya.ai`
   - Authorized domains: `nayya.ai`
   - Developer contact: your email
4. **Scopes** — Add:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/gmail.readonly` (for inbox scanning)
5. **Test users** — Add your test email addresses
6. Save

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Nayya Web`
5. Authorized JavaScript origins:
   ```
   https://nayya.ai
   https://qa.nayya.ai
   http://localhost:3001
   ```
6. Authorized redirect URIs:
   ```
   https://nayya.ai/api/auth/callback/google
   https://qa.nayya.ai/api/auth/callback/google
   http://localhost:3001/api/auth/callback/google
   ```
7. Click **Create**
8. Save the **Client ID** and **Client Secret**

### Step 5: Verification (for production)

- For `gmail.readonly` scope, Google requires app verification
- Submit for verification in OAuth consent screen → Verification status
- Takes 2-6 weeks for review
- Until verified, only test users can use the app

### Environment Variables

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://nayya.ai/api/auth/callback/google
```

---

## 2. Microsoft

**Used for:** Sign in with Microsoft + Outlook/Hotmail inbox scanning

### Step 1: Register an Azure AD Application

1. Go to [portal.azure.com](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in:
   - Name: `Nayya`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Web** → `https://nayya.ai/api/auth/callback/microsoft`
4. Click **Register**
5. Note the **Application (client) ID**

### Step 2: Create Client Secret

1. In the app → **Certificates & secrets** → **New client secret**
2. Description: `Nayya Production`
3. Expiration: 24 months
4. Click **Add**
5. **Copy the Value immediately** (shown only once)

### Step 3: Add API Permissions

1. Go to **API permissions** → **Add a permission**
2. Choose **Microsoft Graph** → **Delegated permissions**
3. Add:
   - `openid`
   - `email`
   - `profile`
   - `User.Read`
   - `Mail.Read` (for inbox scanning)
4. Click **Grant admin consent** (if you're the admin)

### Step 4: Add Redirect URIs

1. Go to **Authentication** → **Add a platform** → **Web**
2. Add redirect URIs:
   ```
   https://nayya.ai/api/auth/callback/microsoft
   https://qa.nayya.ai/api/auth/callback/microsoft
   http://localhost:3001/api/auth/callback/microsoft
   ```
3. Check: **ID tokens** (for login)

### Environment Variables

```env
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value
MICROSOFT_REDIRECT_URI=https://nayya.ai/api/auth/callback/microsoft
MICROSOFT_TENANT_ID=common
```

---

## 3. Apple

**Used for:** Sign in with Apple (required for iOS App Store)

### Step 1: Create an App ID

1. Go to [developer.apple.com](https://developer.apple.com) → Account → Certificates, Identifiers & Profiles
2. **Identifiers** → **+** → **App IDs** → **App**
3. Description: `Nayya`
4. Bundle ID: `ai.nayya.app`
5. Enable **Sign In with Apple**
6. Click **Continue** → **Register**

### Step 2: Create a Services ID (for web)

1. **Identifiers** → **+** → **Services IDs**
2. Description: `Nayya Web Login`
3. Identifier: `ai.nayya.web`
4. Click **Continue** → **Register**
5. Click on the created service → Enable **Sign In with Apple**
6. Configure:
   - Domains: `nayya.ai`
   - Return URLs:
     ```
     https://nayya.ai/api/auth/callback/apple
     https://qa.nayya.ai/api/auth/callback/apple
     ```
7. Click **Save**

### Step 3: Create a Key

1. **Keys** → **+**
2. Name: `Nayya Sign In`
3. Enable **Sign In with Apple** → Configure → select your App ID
4. Click **Continue** → **Register**
5. **Download the key file** (`.p8`) — save securely, shown only once
6. Note the **Key ID**

### Step 4: Get Team ID

Your Team ID is in the top-right of the Apple Developer portal (10-character string like `ABCDE12345`).

### Environment Variables

```env
APPLE_CLIENT_ID=ai.nayya.web
APPLE_TEAM_ID=ABCDE12345
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY_PATH=/path/to/AuthKey_KEYID.p8
# Or inline:
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT....\n-----END PRIVATE KEY-----"
```

### Notes

- Apple requires **Sign In with Apple** if your app offers ANY third-party login on iOS
- Apple provides limited user info: only email (possibly relay) + name (first login only)
- Apple's relay email (e.g., `abc123@privaterelay.appleid.com`) — you can still send emails to it

---

## 4. Facebook

**Used for:** Sign in with Facebook

### Step 1: Create a Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com) → My Apps → **Create App**
2. Select **Consumer** (or "None" for basic setup)
3. App name: `Nayya`
4. Contact email: your email
5. Click **Create App**

### Step 2: Set Up Facebook Login

1. In the app dashboard → **Add Product** → **Facebook Login** → **Set Up**
2. Choose **Web**
3. Site URL: `https://nayya.ai`
4. Click **Save** → **Continue**

### Step 3: Configure OAuth Settings

1. Go to **Facebook Login** → **Settings**
2. Valid OAuth Redirect URIs:
   ```
   https://nayya.ai/api/auth/callback/facebook
   https://qa.nayya.ai/api/auth/callback/facebook
   http://localhost:3001/api/auth/callback/facebook
   ```
3. Deauthorize Callback URL: `https://nayya.ai/api/auth/deauthorize/facebook`
4. Click **Save Changes**

### Step 4: Get Credentials

1. Go to **Settings** → **Basic**
2. Note the **App ID** and **App Secret** (click "Show")

### Step 5: Permissions

Default permissions include `email` and `public_profile` which is sufficient for login.

### Step 6: Go Live

1. In **App Review** → toggle **App Mode** from Development to **Live**
2. Requires: Privacy Policy URL, Terms of Service URL, App Icon
3. Privacy Policy: `https://nayya.ai/privacy`
4. Terms: `https://nayya.ai/terms`

### Environment Variables

```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_REDIRECT_URI=https://nayya.ai/api/auth/callback/facebook
```

---

## 5. Environment Variables Summary

Add all of these to your `.env` files and GitHub Secrets:

```env
# ─── Google ───────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://nayya.ai/api/auth/callback/google

# ─── Microsoft ────────────────────────────────────────
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://nayya.ai/api/auth/callback/microsoft
MICROSOFT_TENANT_ID=common

# ─── Apple ────────────────────────────────────────────
APPLE_CLIENT_ID=ai.nayya.web
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=

# ─── Facebook ─────────────────────────────────────────
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=https://nayya.ai/api/auth/callback/facebook
```

### Per-Environment Redirect URIs

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:3001` |
| QA | `https://qa.nayya.ai` |
| Staging | `https://staging.nayya.ai` |
| Production | `https://nayya.ai` |

Register ALL redirect URIs with each provider to support all environments.

---

## Checklist

- [ ] Google Cloud project created with OAuth consent + credentials
- [ ] Microsoft Azure AD app registered with permissions
- [ ] Apple Developer Services ID + Key created
- [ ] Facebook app created with Login product enabled
- [ ] All redirect URIs added for localhost/qa/staging/production
- [ ] Environment variables added to `.env` and GitHub Secrets
- [ ] Google app submitted for verification (gmail.readonly scope)
- [ ] Facebook app switched to Live mode
