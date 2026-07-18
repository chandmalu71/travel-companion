/**
 * Email Poller Service
 *
 * Polls connected inboxes every 5 minutes for new emails.
 * On initial connection: scans the last 90 days for booking confirmation emails.
 *
 * Supports:
 * - Gmail API (messages.list + messages.get)
 * - Microsoft Graph API (messages endpoint)
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import {
  decryptToken,
  refreshAccessToken,
  type EmailConnectionConfig,
} from './email-connection.js';
import {
  EmailProcessorWorker,
  type ProcessEmailPayload,
} from '../workers/email-processor.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailPollerConfig {
  pollIntervalMs: number; // Default: 5 minutes (300000)
  initialScanDays: number; // Default: 90 days
  sqsQueueUrl?: string;
  emailConnectionConfig: EmailConnectionConfig;
}

export const DEFAULT_POLLER_CONFIG: Omit<EmailPollerConfig, 'emailConnectionConfig'> = {
  pollIntervalMs: 5 * 60 * 1000, // 5 minutes
  initialScanDays: 90,
  sqsQueueUrl: process.env['SQS_EMAIL_QUEUE_URL'],
};

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
}

interface GmailFullMessage {
  id: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; attachmentId?: string };
      filename?: string;
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    }>;
  };
}

interface OutlookMessage {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  body: { contentType: string; content: string };
  receivedDateTime: string;
  hasAttachments: boolean;
}

// ─── Email Poller Service ────────────────────────────────────────────────────

export class EmailPollerService {
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private db: Kysely<Database>;
  private config: EmailPollerConfig;

  constructor(db: Kysely<Database>, config: EmailPollerConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Start the polling loop.
   * Polls all connected inboxes every 5 minutes.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    console.log(
      `[EmailPoller] Starting poller with ${this.config.pollIntervalMs}ms interval`,
    );

    // Run immediately, then on interval
    this.pollAllConnections().catch((error) => {
      console.error('[EmailPoller] Error in initial poll:', error);
    });

    this.pollTimer = setInterval(() => {
      this.pollAllConnections().catch((error) => {
        console.error('[EmailPoller] Error in scheduled poll:', error);
      });
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop the polling loop.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('[EmailPoller] Stopped poller');
  }

  /**
   * Poll all active email connections for new messages.
   */
  async pollAllConnections(): Promise<void> {
    const connections = await this.db
      .selectFrom('email_connections')
      .selectAll()
      .execute();

    if (connections.length === 0) {
      return;
    }

    console.log(`[EmailPoller] Polling ${connections.length} email connection(s)...`);

    for (const connection of connections) {
      try {
        await this.pollConnection(connection);
      } catch (error) {
        console.error(
          `[EmailPoller] Error polling connection ${connection.id} (${connection.provider}):`,
          error,
        );
      }
    }
  }

  /**
   * Poll a single email connection for new messages since last sync.
   */
  private async pollConnection(connection: {
    id: string;
    user_id: string;
    provider: 'gmail' | 'outlook';
    access_token_encrypted: string;
    refresh_token_encrypted: string;
    token_expires_at: Date | null;
    last_sync_at: Date | null;
  }): Promise<void> {
    // Get a valid access token (refresh if expired)
    const accessToken = await this.getValidAccessToken(connection);

    // Determine the time window to search
    const since = connection.last_sync_at ?? this.getInitialScanDate();

    let messages: ProcessEmailPayload[];

    if (connection.provider === 'gmail') {
      messages = await this.fetchGmailMessages(accessToken, since);
    } else {
      messages = await this.fetchOutlookMessages(accessToken, since);
    }

    if (messages.length > 0) {
      console.log(
        `[EmailPoller] Found ${messages.length} new message(s) for connection ${connection.id}`,
      );

      // Enqueue each message for processing
      for (const msg of messages) {
        if (this.config.sqsQueueUrl) {
          await EmailProcessorWorker.enqueueMessage(this.config.sqsQueueUrl, {
            type: 'process_email',
            userId: connection.user_id,
            payload: {
              ...msg,
              connectionId: connection.id,
            },
          });
        }
      }
    }

    // Update last_sync_at
    await this.db
      .updateTable('email_connections')
      .set({ last_sync_at: new Date(), updated_at: new Date() })
      .where('id', '=', connection.id)
      .execute();
  }

  /**
   * Get a valid access token, refreshing if expired.
   */
  private async getValidAccessToken(connection: {
    id: string;
    provider: 'gmail' | 'outlook';
    access_token_encrypted: string;
    refresh_token_encrypted: string;
    token_expires_at: Date | null;
  }): Promise<string> {
    const now = new Date();
    const expiresAt = connection.token_expires_at;

    // If token is still valid (with 5 minute buffer), decrypt and return
    if (expiresAt && expiresAt.getTime() > now.getTime() + 5 * 60 * 1000) {
      return decryptToken(
        connection.access_token_encrypted,
        this.config.emailConnectionConfig.encryptionKey,
      );
    }

    // Token expired — refresh it
    const refreshToken = decryptToken(
      connection.refresh_token_encrypted,
      this.config.emailConnectionConfig.encryptionKey,
    );

    const result = await refreshAccessToken(
      connection.provider,
      refreshToken,
      this.config.emailConnectionConfig,
    );

    // Encrypt and store the new access token
    const { encryptToken } = await import('./email-connection.js');
    const newAccessTokenEncrypted = encryptToken(
      result.accessToken,
      this.config.emailConnectionConfig.encryptionKey,
    );
    const newExpiresAt = new Date(now.getTime() + result.expiresIn * 1000);

    const updateFields: Record<string, unknown> = {
      access_token_encrypted: newAccessTokenEncrypted,
      token_expires_at: newExpiresAt,
      updated_at: now,
    };

    if (result.newRefreshToken) {
      updateFields['refresh_token_encrypted'] = encryptToken(
        result.newRefreshToken,
        this.config.emailConnectionConfig.encryptionKey,
      );
    }

    await this.db
      .updateTable('email_connections')
      .set(updateFields)
      .where('id', '=', connection.id)
      .execute();

    return result.accessToken;
  }

  /**
   * Fetch new Gmail messages since a given date.
   * Uses Gmail API messages.list with a query filter.
   */
  async fetchGmailMessages(
    accessToken: string,
    since: Date,
  ): Promise<ProcessEmailPayload[]> {
    const afterTimestamp = Math.floor(since.getTime() / 1000);
    const query = `after:${afterTimestamp} (subject:booking OR subject:confirmation OR subject:reservation OR subject:itinerary)`;

    try {
      // List messages matching the query
      const listUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`;
      const listResponse = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        throw new Error(`Gmail API list failed: ${listResponse.status}`);
      }

      const listData = (await listResponse.json()) as {
        messages?: GmailMessage[];
      };

      if (!listData.messages || listData.messages.length === 0) {
        return [];
      }

      // Fetch full message content for each
      const messages: ProcessEmailPayload[] = [];
      for (const msg of listData.messages.slice(0, 50)) {
        try {
          const fullMsg = await this.fetchGmailFullMessage(accessToken, msg.id);
          if (fullMsg) {
            messages.push(fullMsg);
          }
        } catch (error) {
          console.error(`[EmailPoller] Failed to fetch Gmail message ${msg.id}:`, error);
        }
      }

      return messages;
    } catch (error) {
      console.error('[EmailPoller] Gmail fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch a full Gmail message by ID.
   */
  private async fetchGmailFullMessage(
    accessToken: string,
    messageId: string,
  ): Promise<ProcessEmailPayload | null> {
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GmailFullMessage;

    // Extract headers
    const headers = data.payload.headers;
    const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
    const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';

    // Extract body content
    let htmlBody = '';
    let textBody = '';

    if (data.payload.parts) {
      for (const part of data.payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64url').toString('utf8');
        } else if (part.mimeType === 'text/plain' && part.body?.data) {
          textBody = Buffer.from(part.body.data, 'base64url').toString('utf8');
        } else if (part.mimeType === 'multipart/alternative' && part.parts) {
          for (const subPart of part.parts) {
            if (subPart.mimeType === 'text/html' && subPart.body?.data) {
              htmlBody = Buffer.from(subPart.body.data, 'base64url').toString('utf8');
            } else if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
              textBody = Buffer.from(subPart.body.data, 'base64url').toString('utf8');
            }
          }
        }
      }
    } else if (data.payload.body?.data) {
      textBody = Buffer.from(data.payload.body.data, 'base64url').toString('utf8');
    }

    return {
      from,
      subject,
      htmlBody,
      textBody,
      attachments: [],
      messageId,
    };
  }

  /**
   * Fetch new Outlook messages since a given date.
   * Uses Microsoft Graph API /messages endpoint.
   */
  async fetchOutlookMessages(
    accessToken: string,
    since: Date,
  ): Promise<ProcessEmailPayload[]> {
    const sinceIso = since.toISOString();
    // Filter for booking-related emails received after the last sync
    const filter = `receivedDateTime ge ${sinceIso} and (contains(subject, 'booking') or contains(subject, 'confirmation') or contains(subject, 'reservation') or contains(subject, 'itinerary'))`;
    const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$top=50&$select=id,subject,from,body,receivedDateTime,hasAttachments`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Outlook API failed: ${response.status}`);
      }

      const data = (await response.json()) as { value?: OutlookMessage[] };

      if (!data.value || data.value.length === 0) {
        return [];
      }

      return data.value.map((msg) => ({
        from: msg.from.emailAddress.address,
        subject: msg.subject,
        htmlBody: msg.body.contentType === 'html' ? msg.body.content : '',
        textBody: msg.body.contentType === 'text' ? msg.body.content : '',
        attachments: [],
        messageId: msg.id,
      }));
    } catch (error) {
      console.error('[EmailPoller] Outlook fetch failed:', error);
      return [];
    }
  }

  /**
   * Trigger an initial scan for a newly connected inbox.
   * Scans the last 90 days for booking confirmation emails.
   */
  async scanInitialInbox(connectionId: string): Promise<void> {
    const connection = await this.db
      .selectFrom('email_connections')
      .selectAll()
      .where('id', '=', connectionId)
      .executeTakeFirst();

    if (!connection) {
      throw new Error(`Email connection ${connectionId} not found`);
    }

    if (this.config.sqsQueueUrl) {
      await EmailProcessorWorker.enqueueMessage(this.config.sqsQueueUrl, {
        type: 'scan_inbox',
        userId: connection.user_id,
        payload: {
          connectionId: connection.id,
          provider: connection.provider,
          scanDays: this.config.initialScanDays,
        },
      });
    } else {
      // Process inline for development
      const accessToken = await this.getValidAccessToken(connection);
      const since = this.getInitialScanDate();

      let messages: ProcessEmailPayload[];
      if (connection.provider === 'gmail') {
        messages = await this.fetchGmailMessages(accessToken, since);
      } else {
        messages = await this.fetchOutlookMessages(accessToken, since);
      }

      console.log(
        `[EmailPoller] Initial scan found ${messages.length} booking emails for connection ${connectionId}`,
      );
    }
  }

  /**
   * Get the date from which to start the initial scan (90 days ago).
   */
  private getInitialScanDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - this.config.initialScanDays);
    return date;
  }
}
