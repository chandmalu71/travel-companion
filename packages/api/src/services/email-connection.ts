/**
 * Email Connection Service
 *
 * Handles OAuth token exchange with Gmail and Outlook providers,
 * token encryption/decryption (AES-256-GCM), and token refresh logic.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'outlook';

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds until access token expires
  token_type: string;
  scope?: string;
  email?: string; // email address from token info (Gmail) or profile (Outlook)
}

export interface EmailConnectionConfig {
  gmailClientId: string;
  gmailClientSecret: string;
  outlookClientId: string;
  outlookClientSecret: string;
  encryptionKey: string; // 32 bytes hex-encoded (64 hex chars)
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}

// ─── Token Encryption ────────────────────────────────────────────────────────

/**
 * Encrypt a token string using AES-256-GCM.
 * Returns base64-encoded string: IV (12 bytes) + authTag (16 bytes) + ciphertext
 */
export function encryptToken(token: string, encryptionKeyHex: string): string {
  const key = Buffer.from(encryptionKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const iv = randomBytes(12); // AES-GCM standard IV size
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Concatenate: IV + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a token string encrypted with AES-256-GCM.
 * Expects base64-encoded string: IV (12 bytes) + authTag (16 bytes) + ciphertext
 */
export function decryptToken(encryptedBase64: string, encryptionKeyHex: string): string {
  const key = Buffer.from(encryptionKeyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract IV (12 bytes), authTag (16 bytes), ciphertext (remaining)
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// ─── OAuth Token Exchange ────────────────────────────────────────────────────

/**
 * Exchange an OAuth authorization code for access and refresh tokens.
 * Calls the appropriate provider's token endpoint.
 */
export async function exchangeCodeForTokens(
  provider: EmailProvider,
  code: string,
  redirectUri: string,
  config: EmailConnectionConfig,
): Promise<OAuthTokenResponse> {
  if (provider === 'gmail') {
    return exchangeGmailCode(code, redirectUri, config);
  } else {
    return exchangeOutlookCode(code, redirectUri, config);
  }
}

/**
 * Exchange a Gmail OAuth code for tokens via Google's token endpoint.
 */
async function exchangeGmailCode(
  code: string,
  redirectUri: string,
  config: EmailConnectionConfig,
): Promise<OAuthTokenResponse> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const body = new URLSearchParams({
    code,
    client_id: config.gmailClientId,
    client_secret: config.gmailClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail token exchange failed: ${response.status} ${errorBody}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    id_token?: string;
  };

  if (!tokenData.refresh_token) {
    throw new Error('Gmail did not return a refresh token. Ensure access_type=offline and prompt=consent in the auth URL.');
  }

  // Fetch user's email address from Google userinfo
  const email = await fetchGmailUserEmail(tokenData.access_token);

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    email,
  };
}

/**
 * Exchange an Outlook OAuth code for tokens via Microsoft's token endpoint.
 */
async function exchangeOutlookCode(
  code: string,
  redirectUri: string,
  config: EmailConnectionConfig,
): Promise<OAuthTokenResponse> {
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  const body = new URLSearchParams({
    code,
    client_id: config.outlookClientId,
    client_secret: config.outlookClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'https://graph.microsoft.com/Mail.Read offline_access openid email profile',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Outlook token exchange failed: ${response.status} ${errorBody}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };

  if (!tokenData.refresh_token) {
    throw new Error('Outlook did not return a refresh token. Ensure offline_access scope is included.');
  }

  // Fetch user's email from Microsoft Graph
  const email = await fetchOutlookUserEmail(tokenData.access_token);

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    email,
  };
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  provider: EmailProvider,
  refreshToken: string,
  config: EmailConnectionConfig,
): Promise<{ accessToken: string; expiresIn: number; newRefreshToken?: string }> {
  if (provider === 'gmail') {
    return refreshGmailToken(refreshToken, config);
  } else {
    return refreshOutlookToken(refreshToken, config);
  }
}

/**
 * Refresh a Gmail access token.
 */
async function refreshGmailToken(
  refreshToken: string,
  config: EmailConnectionConfig,
): Promise<{ accessToken: string; expiresIn: number; newRefreshToken?: string }> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.gmailClientId,
    client_secret: config.gmailClientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail token refresh failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    newRefreshToken: data.refresh_token, // Google may rotate refresh tokens
  };
}

/**
 * Refresh an Outlook access token.
 */
async function refreshOutlookToken(
  refreshToken: string,
  config: EmailConnectionConfig,
): Promise<{ accessToken: string; expiresIn: number; newRefreshToken?: string }> {
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.outlookClientId,
    client_secret: config.outlookClientSecret,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Mail.Read offline_access openid email profile',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Outlook token refresh failed: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    newRefreshToken: data.refresh_token, // Microsoft rotates refresh tokens
  };
}

// ─── User Email Fetching ─────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's email address from Google's userinfo endpoint.
 */
async function fetchGmailUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Gmail user email: ${response.status}`);
  }

  const data = (await response.json()) as { email?: string };
  if (!data.email) {
    throw new Error('Gmail userinfo did not return an email address');
  }

  return data.email;
}

/**
 * Fetch the authenticated user's email address from Microsoft Graph.
 */
async function fetchOutlookUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Outlook user email: ${response.status}`);
  }

  const data = (await response.json()) as { mail?: string; userPrincipalName?: string };
  const email = data.mail ?? data.userPrincipalName;
  if (!email) {
    throw new Error('Microsoft Graph did not return an email address');
  }

  return email;
}
