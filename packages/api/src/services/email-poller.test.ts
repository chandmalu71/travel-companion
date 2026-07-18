/**
 * Tests for the Email Poller Service.
 *
 * Tests cover:
 * - Poller configuration and defaults
 * - Start/stop lifecycle
 * - Initial scan date calculation (90 days)
 * - Polling interval behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailPollerService, DEFAULT_POLLER_CONFIG, type EmailPollerConfig } from './email-poller.js';

// Mock the email-connection module
vi.mock('./email-connection.js', () => ({
  decryptToken: vi.fn().mockReturnValue('mock-access-token'),
  refreshAccessToken: vi.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    expiresIn: 3600,
    newRefreshToken: undefined,
  }),
  encryptToken: vi.fn().mockReturnValue('encrypted-token'),
}));

// Mock the email-processor module
vi.mock('../workers/email-processor.js', () => ({
  EmailProcessorWorker: {
    enqueueMessage: vi.fn().mockResolvedValue('mock-message-id'),
  },
}));

// ─── Default Config Tests ────────────────────────────────────────────────────

describe('DEFAULT_POLLER_CONFIG', () => {
  it('should have 5-minute poll interval', () => {
    expect(DEFAULT_POLLER_CONFIG.pollIntervalMs).toBe(5 * 60 * 1000);
  });

  it('should scan last 90 days on initial connection', () => {
    expect(DEFAULT_POLLER_CONFIG.initialScanDays).toBe(90);
  });
});

// ─── EmailPollerService Tests ────────────────────────────────────────────────

describe('EmailPollerService', () => {
  let mockDb: any;
  let pollerConfig: EmailPollerConfig;

  beforeEach(() => {
    vi.useFakeTimers();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    pollerConfig = {
      pollIntervalMs: 5 * 60 * 1000,
      initialScanDays: 90,
      sqsQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123/email-queue',
      emailConnectionConfig: {
        gmailClientId: 'test-gmail-client-id',
        gmailClientSecret: 'test-gmail-secret',
        outlookClientId: 'test-outlook-client-id',
        outlookClientSecret: 'test-outlook-secret',
        encryptionKey: 'a'.repeat(64),
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should create a poller instance', () => {
    const poller = new EmailPollerService(mockDb, pollerConfig);
    expect(poller).toBeInstanceOf(EmailPollerService);
  });

  it('should start polling and immediately run the first poll', () => {
    const poller = new EmailPollerService(mockDb, pollerConfig);

    poller.start();

    // Should have called the DB to get connections
    expect(mockDb.selectFrom).toHaveBeenCalled();

    poller.stop();
  });

  it('should not start twice if already running', () => {
    const poller = new EmailPollerService(mockDb, pollerConfig);

    poller.start();
    const firstCallCount = mockDb.selectFrom.mock.calls.length;

    poller.start(); // Second call should be a no-op
    expect(mockDb.selectFrom.mock.calls.length).toBe(firstCallCount);

    poller.stop();
  });

  it('should stop gracefully', () => {
    const poller = new EmailPollerService(mockDb, pollerConfig);
    poller.start();
    expect(() => poller.stop()).not.toThrow();
  });

  it('should not throw when stopping a non-started poller', () => {
    const poller = new EmailPollerService(mockDb, pollerConfig);
    expect(() => poller.stop()).not.toThrow();
  });

  it('should poll all connections when no connections exist', async () => {
    mockDb.execute.mockResolvedValue([]);

    const poller = new EmailPollerService(mockDb, pollerConfig);
    await poller.pollAllConnections();

    // Should have queried but done nothing since no connections
    expect(mockDb.selectFrom).toHaveBeenCalled();
  });

  it('should calculate initial scan date as 90 days ago', () => {
    const poller = new EmailPollerService(mockDb, pollerConfig);

    // Access private method via prototype
    const getInitialScanDate = (poller as any).getInitialScanDate.bind(poller);
    const scanDate = getInitialScanDate() as Date;

    const now = new Date();
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - 90);

    // Should be approximately 90 days ago (within 1 second)
    expect(Math.abs(scanDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
  });

  it('should use configured scanDays for initial scan calculation', () => {
    const customConfig = { ...pollerConfig, initialScanDays: 30 };
    const poller = new EmailPollerService(mockDb, customConfig);

    const getInitialScanDate = (poller as any).getInitialScanDate.bind(poller);
    const scanDate = getInitialScanDate() as Date;

    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - 30);

    expect(Math.abs(scanDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
  });
});

// ─── Gmail Message Fetching Tests (unit level) ───────────────────────────────

describe('EmailPollerService.fetchGmailMessages', () => {
  let mockDb: any;
  let poller: EmailPollerService;

  beforeEach(() => {
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    const pollerConfig: EmailPollerConfig = {
      pollIntervalMs: 300000,
      initialScanDays: 90,
      sqsQueueUrl: 'https://sqs.example.com/queue',
      emailConnectionConfig: {
        gmailClientId: 'client-id',
        gmailClientSecret: 'client-secret',
        outlookClientId: 'outlook-id',
        outlookClientSecret: 'outlook-secret',
        encryptionKey: 'a'.repeat(64),
      },
    };

    poller = new EmailPollerService(mockDb, pollerConfig);
  });

  it('should return empty array when Gmail API returns no messages', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] }),
    } as Response);

    const since = new Date(Date.now() - 5 * 60 * 1000);
    const result = await poller.fetchGmailMessages('mock-token', since);

    expect(result).toEqual([]);
    mockFetch.mockRestore();
  });

  it('should return empty array when Gmail API returns no messages field', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const since = new Date(Date.now() - 5 * 60 * 1000);
    const result = await poller.fetchGmailMessages('mock-token', since);

    expect(result).toEqual([]);
    mockFetch.mockRestore();
  });

  it('should return empty array on Gmail API failure', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const since = new Date(Date.now() - 5 * 60 * 1000);
    const result = await poller.fetchGmailMessages('invalid-token', since);

    expect(result).toEqual([]);
    mockFetch.mockRestore();
  });

  it('should construct query with booking-related keywords', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] }),
    } as Response);

    const since = new Date('2024-01-01T00:00:00Z');
    await poller.fetchGmailMessages('mock-token', since);

    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('googleapis.com/gmail');
    expect(callUrl).toContain('booking');
    expect(callUrl).toContain('confirmation');
    expect(callUrl).toContain('reservation');
    expect(callUrl).toContain('itinerary');

    mockFetch.mockRestore();
  });
});

// ─── Outlook Message Fetching Tests (unit level) ─────────────────────────────

describe('EmailPollerService.fetchOutlookMessages', () => {
  let mockDb: any;
  let poller: EmailPollerService;

  beforeEach(() => {
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    const pollerConfig: EmailPollerConfig = {
      pollIntervalMs: 300000,
      initialScanDays: 90,
      sqsQueueUrl: 'https://sqs.example.com/queue',
      emailConnectionConfig: {
        gmailClientId: 'client-id',
        gmailClientSecret: 'client-secret',
        outlookClientId: 'outlook-id',
        outlookClientSecret: 'outlook-secret',
        encryptionKey: 'a'.repeat(64),
      },
    };

    poller = new EmailPollerService(mockDb, pollerConfig);
  });

  it('should return empty array when Outlook API returns no messages', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    } as Response);

    const since = new Date();
    const result = await poller.fetchOutlookMessages('mock-token', since);

    expect(result).toEqual([]);
    mockFetch.mockRestore();
  });

  it('should return empty array when Outlook API returns no value field', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const since = new Date();
    const result = await poller.fetchOutlookMessages('mock-token', since);

    expect(result).toEqual([]);
    mockFetch.mockRestore();
  });

  it('should return empty array on Outlook API failure', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    const since = new Date();
    const result = await poller.fetchOutlookMessages('bad-token', since);

    expect(result).toEqual([]);
    mockFetch.mockRestore();
  });

  it('should parse Outlook messages correctly', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: 'msg-001',
            subject: 'Hotel Booking Confirmation',
            from: {
              emailAddress: {
                address: 'reservations@marriott.com',
                name: 'Marriott Reservations',
              },
            },
            body: { contentType: 'html', content: '<p>Your room is booked</p>' },
            receivedDateTime: '2024-01-15T10:30:00Z',
            hasAttachments: false,
          },
        ],
      }),
    } as Response);

    const since = new Date('2024-01-01T00:00:00Z');
    const result = await poller.fetchOutlookMessages('mock-token', since);

    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('reservations@marriott.com');
    expect(result[0]!.subject).toBe('Hotel Booking Confirmation');
    expect(result[0]!.htmlBody).toBe('<p>Your room is booked</p>');
    expect(result[0]!.messageId).toBe('msg-001');

    mockFetch.mockRestore();
  });

  it('should handle text content type messages', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: 'msg-002',
            subject: 'Car Rental Confirmation',
            from: {
              emailAddress: {
                address: 'noreply@enterprise.com',
                name: 'Enterprise',
              },
            },
            body: { contentType: 'text', content: 'Your rental is confirmed' },
            receivedDateTime: '2024-01-15T12:00:00Z',
            hasAttachments: false,
          },
        ],
      }),
    } as Response);

    const since = new Date('2024-01-01T00:00:00Z');
    const result = await poller.fetchOutlookMessages('mock-token', since);

    expect(result).toHaveLength(1);
    expect(result[0]!.textBody).toBe('Your rental is confirmed');
    expect(result[0]!.htmlBody).toBe('');

    mockFetch.mockRestore();
  });
});
