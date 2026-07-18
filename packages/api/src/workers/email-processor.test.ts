/**
 * Tests for the SQS Email Processor Worker.
 *
 * Tests cover:
 * - Message parsing and validation
 * - Message enqueuing (local mode)
 * - Worker start/stop lifecycle
 * - Default process handler routing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EmailProcessorWorker,
  defaultEmailProcessHandler,
  DEFAULT_PROCESSOR_CONFIG,
  type EmailProcessingMessage,
  type ProcessEmailPayload,
  type GmailNotificationPayload,
  type ScanInboxPayload,
} from './email-processor.js';

// ─── Message Parsing Tests ───────────────────────────────────────────────────

describe('EmailProcessorWorker.parseMessage', () => {
  let worker: EmailProcessorWorker;

  beforeEach(() => {
    worker = new EmailProcessorWorker({}, async () => {});
  });

  it('should parse a valid process_email message', () => {
    const message: EmailProcessingMessage = {
      type: 'process_email',
      userId: 'user-123',
      payload: {
        from: 'airline@delta.com',
        subject: 'Your Booking Confirmation',
        htmlBody: '<p>Confirmed</p>',
        textBody: 'Confirmed',
        attachments: [],
      },
    };

    const result = worker.parseMessage(JSON.stringify(message));
    expect(result.type).toBe('process_email');
    expect(result.userId).toBe('user-123');
    expect((result.payload as ProcessEmailPayload).from).toBe('airline@delta.com');
    expect((result.payload as ProcessEmailPayload).subject).toBe('Your Booking Confirmation');
  });

  it('should parse a valid gmail_notification message', () => {
    const message: EmailProcessingMessage = {
      type: 'gmail_notification',
      userId: 'user-456',
      payload: {
        emailAddress: 'user@gmail.com',
        historyId: '12345',
        connectionId: 'conn-abc',
      },
    };

    const result = worker.parseMessage(JSON.stringify(message));
    expect(result.type).toBe('gmail_notification');
    expect((result.payload as GmailNotificationPayload).emailAddress).toBe('user@gmail.com');
    expect((result.payload as GmailNotificationPayload).historyId).toBe('12345');
  });

  it('should parse a valid scan_inbox message', () => {
    const message: EmailProcessingMessage = {
      type: 'scan_inbox',
      userId: 'user-789',
      payload: {
        connectionId: 'conn-xyz',
        provider: 'outlook',
        scanDays: 90,
      },
    };

    const result = worker.parseMessage(JSON.stringify(message));
    expect(result.type).toBe('scan_inbox');
    expect((result.payload as ScanInboxPayload).provider).toBe('outlook');
    expect((result.payload as ScanInboxPayload).scanDays).toBe(90);
  });

  it('should throw on invalid JSON', () => {
    expect(() => worker.parseMessage('not json at all')).toThrow(
      'Failed to parse SQS message body as JSON',
    );
  });

  it('should throw on missing type field', () => {
    const message = { userId: 'user-1', payload: {} };
    expect(() => worker.parseMessage(JSON.stringify(message))).toThrow(
      'Invalid message format: missing required fields',
    );
  });

  it('should throw on missing userId field', () => {
    const message = { type: 'process_email', payload: {} };
    expect(() => worker.parseMessage(JSON.stringify(message))).toThrow(
      'Invalid message format: missing required fields',
    );
  });

  it('should throw on missing payload field', () => {
    const message = { type: 'process_email', userId: 'user-1' };
    expect(() => worker.parseMessage(JSON.stringify(message))).toThrow(
      'Invalid message format: missing required fields',
    );
  });

  it('should throw on invalid message type', () => {
    const message = { type: 'invalid_type', userId: 'user-1', payload: {} };
    expect(() => worker.parseMessage(JSON.stringify(message))).toThrow(
      'Invalid message type: invalid_type',
    );
  });
});

// ─── Message Enqueuing Tests ─────────────────────────────────────────────────

describe('EmailProcessorWorker.enqueueMessage', () => {
  it('should return a local message ID when enqueuing', async () => {
    const message: EmailProcessingMessage = {
      type: 'process_email',
      userId: 'user-123',
      payload: {
        from: 'test@example.com',
        subject: 'Test',
        htmlBody: '',
        textBody: 'test',
        attachments: [],
      },
    };

    const messageId = await EmailProcessorWorker.enqueueMessage(
      'http://sqs.us-east-1.amazonaws.com/123/queue',
      message,
    );

    expect(messageId).toMatch(/^local-\d+$/);
  });

  it('should handle different message types', async () => {
    const gmailMessage: EmailProcessingMessage = {
      type: 'gmail_notification',
      userId: 'user-456',
      payload: {
        emailAddress: 'user@gmail.com',
        historyId: '999',
        connectionId: 'conn-1',
      },
    };

    const messageId = await EmailProcessorWorker.enqueueMessage(
      'http://sqs.us-east-1.amazonaws.com/123/queue',
      gmailMessage,
    );

    expect(messageId).toMatch(/^local-\d+$/);
  });
});

// ─── Worker Lifecycle Tests ──────────────────────────────────────────────────

describe('EmailProcessorWorker lifecycle', () => {
  it('should create a worker with default config', () => {
    const worker = new EmailProcessorWorker({}, async () => {});
    expect(worker).toBeInstanceOf(EmailProcessorWorker);
  });

  it('should override config values', () => {
    const customConfig = {
      queueUrl: 'https://sqs.us-west-2.amazonaws.com/123/custom-queue',
      maxMessages: 5,
      waitTimeSeconds: 10,
    };

    const worker = new EmailProcessorWorker(customConfig, async () => {});
    expect(worker).toBeInstanceOf(EmailProcessorWorker);
  });

  it('should stop the worker gracefully', () => {
    const worker = new EmailProcessorWorker({}, async () => {});
    // Calling stop before start should not throw
    expect(() => worker.stop()).not.toThrow();
  });
});

// ─── Default Process Handler Tests ───────────────────────────────────────────

describe('defaultEmailProcessHandler', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle process_email message type', async () => {
    const message: EmailProcessingMessage = {
      type: 'process_email',
      userId: 'user-1',
      payload: {
        from: 'bookings@airline.com',
        subject: 'Flight Confirmation #ABC123',
        htmlBody: '<p>Your flight is booked</p>',
        textBody: 'Your flight is booked',
        attachments: [],
      },
    };

    await expect(defaultEmailProcessHandler(message)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Processing email from bookings@airline.com'),
    );
  });

  it('should handle gmail_notification message type', async () => {
    const message: EmailProcessingMessage = {
      type: 'gmail_notification',
      userId: 'user-2',
      payload: {
        emailAddress: 'user@gmail.com',
        historyId: '54321',
        connectionId: 'conn-abc',
      },
    };

    await expect(defaultEmailProcessHandler(message)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Gmail notification for user@gmail.com'),
    );
  });

  it('should handle scan_inbox message type', async () => {
    const message: EmailProcessingMessage = {
      type: 'scan_inbox',
      userId: 'user-3',
      payload: {
        connectionId: 'conn-xyz',
        provider: 'gmail',
        scanDays: 90,
      },
    };

    await expect(defaultEmailProcessHandler(message)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scanning gmail inbox for last 90 days'),
    );
  });
});

// ─── Default Config Tests ────────────────────────────────────────────────────

describe('DEFAULT_PROCESSOR_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_PROCESSOR_CONFIG.maxMessages).toBe(10);
    expect(DEFAULT_PROCESSOR_CONFIG.waitTimeSeconds).toBe(20);
    expect(DEFAULT_PROCESSOR_CONFIG.visibilityTimeout).toBe(120);
    expect(DEFAULT_PROCESSOR_CONFIG.region).toBe('us-east-1');
  });
});
