/**
 * IMAP Email Scanner
 *
 * Connects to any IMAP email provider (Yahoo, iCloud, Fastmail, ProtonMail Bridge,
 * custom domains) and scans for booking confirmation emails.
 *
 * Uses the `imapflow` library for reliable IMAP connections with TLS support.
 *
 * Supports:
 * - Yahoo Mail (imap.mail.yahoo.com:993)
 * - iCloud Mail (imap.mail.me.com:993)
 * - Fastmail (imap.fastmail.com:993)
 * - ProtonMail Bridge (127.0.0.1:1143)
 * - Any IMAP provider with TLS/SSL
 *
 * Implements Requirement 27 (IMAP portion)
 */

import { ImapFlow } from 'imapflow';
import { isBookingRelevant, BOOKING_SUBJECT_KEYWORDS } from './email-scanner.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

export interface ScannedEmail {
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody: string;
}

export interface ImapScanResult {
  scannedCount: number;
  relevantEmails: ScannedEmail[];
  errors: string[];
}

// ─── Known IMAP configurations ───────────────────────────────────────────────

export const KNOWN_IMAP_CONFIGS: Record<string, Omit<ImapConfig, 'username' | 'password'>> = {
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, tls: true },
  icloud: { host: 'imap.mail.me.com', port: 993, tls: true },
  fastmail: { host: 'imap.fastmail.com', port: 993, tls: true },
  aol: { host: 'imap.aol.com', port: 993, tls: true },
  zoho: { host: 'imap.zoho.com', port: 993, tls: true },
  protonmail: { host: '127.0.0.1', port: 1143, tls: false }, // ProtonMail Bridge (local)
  gmx: { host: 'imap.gmx.com', port: 993, tls: true },
  mail_com: { host: 'imap.mail.com', port: 993, tls: true },
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class ImapScannerService {
  private config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  /**
   * Connect to the IMAP server and scan for booking-related emails.
   *
   * @param sinceDays - How many days back to scan (default: 90)
   * @param maxMessages - Maximum messages to fetch (default: 100)
   */
  async scan(sinceDays = 90, maxMessages = 100): Promise<ImapScanResult> {
    const result: ImapScanResult = {
      scannedCount: 0,
      relevantEmails: [],
      errors: [],
    };

    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.tls,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      logger: false, // Suppress verbose IMAP logs
      tls: this.config.tls ? { rejectUnauthorized: true } : undefined,
    });

    try {
      // Connect
      await client.connect();

      // Open INBOX
      const mailbox = await client.getMailboxLock('INBOX');

      try {
        // Build search criteria: since N days ago, with booking-related subjects
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - sinceDays);

        // Search for messages since the date
        // IMAP SEARCH with OR for multiple subject keywords
        const searchCriteria = {
          since: sinceDate,
        };

        const messages = client.fetch(searchCriteria, {
          envelope: true,
          source: true,
          uid: true,
        });

        let count = 0;
        for await (const msg of messages) {
          if (count >= maxMessages) break;
          count++;

          const envelope = msg.envelope;
          if (!envelope) continue;

          const from = envelope.from?.[0]?.address ?? '';
          const subject = envelope.subject ?? '';
          const date = envelope.date ?? new Date();
          const messageId = envelope.messageId ?? `imap-${msg.uid}`;

          // Filter for booking-relevant emails
          if (!isBookingRelevant(from, subject)) continue;

          // Parse the email body
          try {
            const source = msg.source?.toString('utf-8') ?? '';
            const { textBody, htmlBody } = parseEmailSource(source);

            result.relevantEmails.push({
              messageId,
              from,
              subject,
              date: new Date(date),
              textBody,
              htmlBody,
            });
          } catch (parseErr) {
            result.errors.push(`Failed to parse message ${messageId}: ${(parseErr as Error).message}`);
          }
        }

        result.scannedCount = count;
      } finally {
        mailbox.release();
      }

      // Disconnect gracefully
      await client.logout();
    } catch (error) {
      const err = error as Error;
      result.errors.push(`IMAP connection failed: ${err.message}`);

      // Try to close connection if still open
      try { await client.close(); } catch {}
    }

    return result;
  }

  /**
   * Test the IMAP connection without scanning.
   * Returns true if connection succeeds.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.tls,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      logger: false,
      tls: this.config.tls ? { rejectUnauthorized: true } : undefined,
    });

    try {
      await client.connect();
      await client.logout();
      return { success: true };
    } catch (error) {
      const err = error as Error;
      let message = err.message;

      // Provide user-friendly error messages
      if (message.includes('AUTHENTICATIONFAILED') || message.includes('Invalid credentials')) {
        message = 'Invalid username or password. If using Gmail/Yahoo/iCloud, make sure to use an app-specific password.';
      } else if (message.includes('ECONNREFUSED')) {
        message = `Cannot connect to ${this.config.host}:${this.config.port}. Check the server address and port.`;
      } else if (message.includes('ENOTFOUND')) {
        message = `Server "${this.config.host}" not found. Check the hostname.`;
      } else if (message.includes('certificate')) {
        message = 'TLS certificate verification failed. The server may use a self-signed certificate.';
      }

      return { success: false, error: message };
    }
  }
}

// ─── Email Parsing Helpers ───────────────────────────────────────────────────

/**
 * Parse raw email source (RFC 2822) to extract text and HTML bodies.
 * Simple parser — handles common multipart structures.
 */
function parseEmailSource(source: string): { textBody: string; htmlBody: string } {
  let textBody = '';
  let htmlBody = '';

  // Check if multipart
  const boundaryMatch = /boundary="?([^";\r\n]+)"?/i.exec(source);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1]!;
    const parts = source.split(`--${boundary}`);

    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headers = part.slice(0, headerEnd).toLowerCase();
      const body = part.slice(headerEnd + 4).trim();

      if (headers.includes('content-type: text/plain') || headers.includes('content-type: text/plain;')) {
        textBody = decodeBody(body, headers);
      } else if (headers.includes('content-type: text/html') || headers.includes('content-type: text/html;')) {
        htmlBody = decodeBody(body, headers);
      }
    }
  } else {
    // Single-part email
    const headerEnd = source.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = source.slice(0, headerEnd).toLowerCase();
      const body = source.slice(headerEnd + 4);

      if (headers.includes('content-type: text/html')) {
        htmlBody = decodeBody(body, headers);
      } else {
        textBody = decodeBody(body, headers);
      }
    }
  }

  return { textBody, htmlBody };
}

/**
 * Decode email body based on Content-Transfer-Encoding.
 */
function decodeBody(body: string, headers: string): string {
  if (headers.includes('content-transfer-encoding: base64')) {
    try {
      return Buffer.from(body.replace(/\r?\n/g, ''), 'base64').toString('utf-8');
    } catch {
      return body;
    }
  }

  if (headers.includes('content-transfer-encoding: quoted-printable')) {
    return body
      .replace(/=\r?\n/g, '') // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  return body;
}
