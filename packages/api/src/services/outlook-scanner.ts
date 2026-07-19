/**
 * Outlook/Microsoft Graph Email Scanner
 *
 * Scans Outlook/Hotmail/Live inbox for booking confirmation emails using
 * Microsoft Graph API with `Mail.Read` permission.
 *
 * Features:
 * - OAuth token refresh via Microsoft identity platform
 * - OData $filter queries for booking-relevant emails
 * - Full message content fetch (HTML + text)
 * - Change notifications (webhooks) for real-time scanning
 * - Supports personal accounts (outlook.com, hotmail.com, live.com)
 *   and work/school accounts (Office 365)
 *
 * Implements Requirement 27 (Outlook portion)
 */

import { isBookingRelevant, BOOKING_SENDER_DOMAINS, BOOKING_SUBJECT_KEYWORDS } from './email-scanner.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface OutlookScanResult {
  scannedCount: number;
  relevantEmails: OutlookEmail[];
  nextLink?: string;
  errors: string[];
}

export interface OutlookEmail {
  messageId: string;
  conversationId: string;
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody: string;
}

interface GraphMessageListResponse {
  value?: GraphMessage[];
  '@odata.nextLink'?: string;
}

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  receivedDateTime: string;
  from: {
    emailAddress: { address: string; name: string };
  };
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  bodyPreview: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const OUTLOOK_SCOPES = ['openid', 'email', 'profile', 'Mail.Read', 'offline_access'];

// ─── Service ─────────────────────────────────────────────────────────────────

export class OutlookScannerService {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Generate the OAuth authorization URL for Outlook access.
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: OUTLOOK_SCOPES.join(' '),
      response_mode: 'query',
      state,
    });
    return `${MICROSOFT_AUTH_URL}?${params}`;
  }

  /**
   * Exchange authorization code for access + refresh tokens.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<OutlookTokens> {
    const response = await fetch(MICROSOFT_TOKEN_URL, {
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
   * Refresh an expired access token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        scope: OUTLOOK_SCOPES.join(' '),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token, // Microsoft may rotate refresh tokens
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Scan Outlook inbox for booking-related emails since a given date.
   *
   * @param accessToken - Valid OAuth access token with Mail.Read scope
   * @param sinceDate - Only fetch emails after this date
   * @param maxResults - Maximum messages to fetch (default: 50)
   */
  async scanForBookings(
    accessToken: string,
    sinceDate: Date,
    maxResults = 50,
  ): Promise<OutlookScanResult> {
    const result: OutlookScanResult = {
      scannedCount: 0,
      relevantEmails: [],
      errors: [],
    };

    try {
      // Build OData filter for booking-relevant emails
      const filter = buildOutlookFilter(sinceDate);
      const select = 'id,conversationId,subject,receivedDateTime,from,body,bodyPreview';
      const url = `${GRAPH_API_BASE}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${maxResults}&$orderby=receivedDateTime desc`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('ACCESS_TOKEN_EXPIRED');
        }
        throw new Error(`Graph API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as GraphMessageListResponse;

      if (!data.value || data.value.length === 0) {
        return result;
      }

      result.nextLink = data['@odata.nextLink'];

      for (const msg of data.value) {
        result.scannedCount++;

        // Additional client-side relevance check
        if (!isBookingRelevant(msg.from.emailAddress.address, msg.subject)) {
          continue;
        }

        result.relevantEmails.push({
          messageId: msg.id,
          conversationId: msg.conversationId,
          from: msg.from.emailAddress.address,
          subject: msg.subject,
          date: new Date(msg.receivedDateTime),
          textBody: msg.body.contentType === 'text' ? msg.body.content : '',
          htmlBody: msg.body.contentType === 'html' ? msg.body.content : '',
        });
      }
    } catch (error) {
      result.errors.push((error as Error).message);
    }

    return result;
  }

  /**
   * Fetch a single message by ID (for webhook-triggered processing).
   */
  async fetchMessage(accessToken: string, messageId: string): Promise<OutlookEmail | null> {
    const url = `${GRAPH_API_BASE}/messages/${messageId}?$select=id,conversationId,subject,receivedDateTime,from,body`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const msg = await response.json() as GraphMessage;

    return {
      messageId: msg.id,
      conversationId: msg.conversationId,
      from: msg.from.emailAddress.address,
      subject: msg.subject,
      date: new Date(msg.receivedDateTime),
      textBody: msg.body.contentType === 'text' ? msg.body.content : '',
      htmlBody: msg.body.contentType === 'html' ? msg.body.content : '',
    };
  }

  /**
   * Create a subscription for real-time change notifications (webhooks).
   * Microsoft Graph sends POST to your webhook URL when new mail arrives.
   *
   * @param accessToken - Valid access token
   * @param webhookUrl - Your HTTPS endpoint that handles notifications
   * @param expirationMinutes - Subscription lifetime (max 4230 min = ~3 days)
   */
  async createSubscription(
    accessToken: string,
    webhookUrl: string,
    expirationMinutes = 4230,
  ): Promise<{ subscriptionId: string; expirationDateTime: string }> {
    const expirationDateTime = new Date(
      Date.now() + expirationMinutes * 60 * 1000,
    ).toISOString();

    const url = 'https://graph.microsoft.com/v1.0/subscriptions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl: webhookUrl,
        resource: 'me/mailFolders/inbox/messages',
        expirationDateTime,
        clientState: 'nayya-outlook-subscription',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Subscription creation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as { id: string; expirationDateTime: string };
    return { subscriptionId: data.id, expirationDateTime: data.expirationDateTime };
  }

  /**
   * Renew an existing subscription before it expires.
   */
  async renewSubscription(
    accessToken: string,
    subscriptionId: string,
    expirationMinutes = 4230,
  ): Promise<{ expirationDateTime: string }> {
    const expirationDateTime = new Date(
      Date.now() + expirationMinutes * 60 * 1000,
    ).toISOString();

    const url = `https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expirationDateTime }),
    });

    if (!response.ok) {
      throw new Error(`Subscription renewal failed: ${response.status}`);
    }

    const data = await response.json() as { expirationDateTime: string };
    return { expirationDateTime: data.expirationDateTime };
  }

  /**
   * Delete a subscription (when user disconnects email).
   */
  async deleteSubscription(accessToken: string, subscriptionId: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`;
    await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build an OData $filter query for booking-related emails.
 * Microsoft Graph supports limited OData filter syntax.
 */
function buildOutlookFilter(sinceDate: Date): string {
  const sinceIso = sinceDate.toISOString();

  // Microsoft Graph $filter supports 'contains' on subject
  // We filter by date and use common subject keywords
  const subjectFilters = BOOKING_SUBJECT_KEYWORDS
    .slice(0, 6)
    .map((kw) => `contains(subject, '${kw}')`)
    .join(' or ');

  return `receivedDateTime ge ${sinceIso} and (${subjectFilters})`;
}

export { OUTLOOK_SCOPES, MICROSOFT_AUTH_URL, MICROSOFT_TOKEN_URL };
