/**
 * Gmail OAuth Email Scanner
 *
 * Scans Gmail inbox for booking confirmation emails using the Gmail API
 * with `gmail.readonly` scope (requires user consent).
 *
 * Features:
 * - OAuth token refresh via Google's token endpoint
 * - Search with Gmail query syntax (from known senders + subject keywords)
 * - Fetch full message content (multipart handling)
 * - Push notification support via Gmail watch (Pub/Sub)
 * - Rate limiting awareness (Gmail API quota: 250 units/user/second)
 *
 * Implements Requirement 27 (Gmail portion)
 */

import { isBookingRelevant, BOOKING_SENDER_DOMAINS, BOOKING_SUBJECT_KEYWORDS } from './email-scanner.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GmailScanResult {
  scannedCount: number;
  relevantEmails: GmailEmail[];
  nextPageToken?: string;
  errors: string[];
}

export interface GmailEmail {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody: string;
}

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: GmailPart[];
  };
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GmailPart[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GMAIL_API_BASE = 'https://www.googleapis.com/gmail/v1/users/me';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// ─── Service ─────────────────────────────────────────────────────────────────

export class GmailScannerService {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Generate the OAuth authorization URL for Gmail access.
   * User must visit this URL and grant permission.
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES.join(' '),
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Always show consent (to get refresh token)
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Exchange authorization code for access + refresh tokens.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<GmailTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Refresh an expired access token using the refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Scan Gmail for booking-related emails since a given date.
   *
   * @param accessToken - Valid OAuth access token with gmail.readonly scope
   * @param sinceDate - Only fetch emails after this date
   * @param maxResults - Maximum messages to fetch (default: 50)
   */
  async scanForBookings(
    accessToken: string,
    sinceDate: Date,
    maxResults = 50,
  ): Promise<GmailScanResult> {
    const result: GmailScanResult = {
      scannedCount: 0,
      relevantEmails: [],
      errors: [],
    };

    try {
      // Build Gmail search query
      const query = buildGmailSearchQuery(sinceDate);

      // List matching messages
      const listUrl = `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
      const listResponse = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        if (listResponse.status === 401) {
          throw new Error('ACCESS_TOKEN_EXPIRED');
        }
        throw new Error(`Gmail API list failed: ${listResponse.status} ${listResponse.statusText}`);
      }

      const listData = await listResponse.json() as GmailMessageListResponse;

      if (!listData.messages || listData.messages.length === 0) {
        return result;
      }

      result.nextPageToken = listData.nextPageToken;

      // Fetch each message's content
      for (const msgRef of listData.messages) {
        try {
          const email = await this.fetchMessage(accessToken, msgRef.id);
          if (email) {
            result.relevantEmails.push(email);
          }
          result.scannedCount++;
        } catch (err) {
          result.errors.push(`Failed to fetch message ${msgRef.id}: ${(err as Error).message}`);
        }
      }
    } catch (error) {
      result.errors.push((error as Error).message);
    }

    return result;
  }

  /**
   * Fetch a single Gmail message by ID and extract content.
   */
  private async fetchMessage(accessToken: string, messageId: string): Promise<GmailEmail | null> {
    const url = `${GMAIL_API_BASE}/messages/${messageId}?format=full`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const data = await response.json() as GmailMessageResponse;
    const headers = data.payload.headers;

    const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
    const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
    const dateStr = headers.find((h) => h.name.toLowerCase() === 'date')?.value ?? '';

    // Extract body content from payload
    const { textBody, htmlBody } = extractGmailBody(data.payload);

    return {
      messageId: data.id,
      threadId: data.threadId,
      from: extractEmailAddress(from),
      subject,
      date: new Date(dateStr),
      textBody,
      htmlBody,
    };
  }

  /**
   * Set up Gmail push notifications via Google Pub/Sub.
   * This enables real-time scanning (notifications on new emails).
   *
   * @param accessToken - Valid access token
   * @param topicName - Google Pub/Sub topic (e.g., projects/neyya/topics/gmail-notifications)
   */
  async setupPushNotifications(
    accessToken: string,
    topicName: string,
  ): Promise<{ historyId: string; expiration: string }> {
    const url = `${GMAIL_API_BASE}/watch`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX'],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gmail watch setup failed: ${response.status}`);
    }

    const data = await response.json() as { historyId: string; expiration: string };
    return data;
  }

  /**
   * Get new messages since a specific history ID (used with push notifications).
   */
  async getHistoryChanges(
    accessToken: string,
    startHistoryId: string,
  ): Promise<string[]> {
    const url = `${GMAIL_API_BASE}/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return [];

    const data = await response.json() as {
      history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>;
    };

    const messageIds: string[] = [];
    for (const h of data.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        messageIds.push(added.message.id);
      }
    }

    return messageIds;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a Gmail search query that finds booking-related emails.
 * Uses Gmail's search syntax.
 */
function buildGmailSearchQuery(sinceDate: Date): string {
  const afterTimestamp = Math.floor(sinceDate.getTime() / 1000);

  // Combine subject keywords with OR
  const subjectParts = BOOKING_SUBJECT_KEYWORDS
    .slice(0, 8) // Gmail has query length limits
    .map((kw) => `subject:${kw}`)
    .join(' OR ');

  // Build from known domains (top senders)
  const fromParts = BOOKING_SENDER_DOMAINS
    .slice(0, 15)
    .map((d) => `from:${d}`)
    .join(' OR ');

  return `after:${afterTimestamp} (${subjectParts} OR ${fromParts})`;
}

/**
 * Extract text and HTML body from a Gmail message payload.
 */
function extractGmailBody(payload: GmailMessageResponse['payload']): { textBody: string; htmlBody: string } {
  let textBody = '';
  let htmlBody = '';

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.mimeType === 'multipart/alternative' && part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
            textBody = Buffer.from(subPart.body.data, 'base64url').toString('utf-8');
          } else if (subPart.mimeType === 'text/html' && subPart.body?.data) {
            htmlBody = Buffer.from(subPart.body.data, 'base64url').toString('utf-8');
          }
        }
      }
    }
  } else if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    if (payload.mimeType === 'text/html') {
      htmlBody = decoded;
    } else {
      textBody = decoded;
    }
  }

  return { textBody, htmlBody };
}

/**
 * Extract plain email address from a "Name <email>" format.
 */
function extractEmailAddress(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  return match ? match[1]! : from.trim();
}

export { GMAIL_SCOPES, buildGmailSearchQuery };
