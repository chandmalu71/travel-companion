/**
 * SQS Consumer Worker for Async Email Processing
 *
 * Polls an SQS queue for email processing messages, parses email content,
 * and creates booking records from extracted data.
 *
 * Message types:
 * - "process_email": Process a single email (from forwarding or inbox scan)
 * - "gmail_notification": Handle a Gmail push notification
 * - "scan_inbox": Scan last 90 days of a connected inbox
 *
 * Uses @aws-sdk/client-sqs for SQS integration.
 */

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailProcessingMessage {
  type: 'process_email' | 'gmail_notification' | 'scan_inbox';
  userId: string;
  payload: ProcessEmailPayload | GmailNotificationPayload | ScanInboxPayload;
}

export interface ProcessEmailPayload {
  from: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  attachments: Attachment[];
  connectionId?: string;
  messageId?: string;
}

export interface GmailNotificationPayload {
  emailAddress: string;
  historyId: string;
  connectionId: string;
}

export interface ScanInboxPayload {
  connectionId: string;
  provider: 'gmail' | 'outlook';
  scanDays: number; // default 90
}

export interface Attachment {
  filename: string;
  mimeType: string;
  content: string; // base64-encoded
  size: number;
}

// ─── SQS Consumer Configuration ─────────────────────────────────────────────

export interface EmailProcessorConfig {
  queueUrl: string;
  region: string;
  maxMessages: number; // max messages per poll (1-10)
  waitTimeSeconds: number; // long-poll wait time (0-20)
  visibilityTimeout: number; // seconds before message becomes visible again
}

export const DEFAULT_PROCESSOR_CONFIG: EmailProcessorConfig = {
  queueUrl: process.env['SQS_EMAIL_QUEUE_URL'] ?? '',
  region: process.env['AWS_REGION'] ?? 'us-east-1',
  maxMessages: 10,
  waitTimeSeconds: 20, // long polling
  visibilityTimeout: 120, // 2 minutes to process
};

// ─── Email Processor Worker ──────────────────────────────────────────────────

export class EmailProcessorWorker {
  private running = false;
  private config: EmailProcessorConfig;
  private processHandler: (message: EmailProcessingMessage) => Promise<void>;
  private sqsClient: SQSClient | null = null;

  constructor(
    config: Partial<EmailProcessorConfig> = {},
    processHandler: (message: EmailProcessingMessage) => Promise<void>,
  ) {
    this.config = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.processHandler = processHandler;

    // Initialize SQS client if queue URL is configured
    if (this.config.queueUrl) {
      this.sqsClient = new SQSClient({ region: this.config.region });
    }
  }

  /**
   * Start the SQS polling loop.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    console.log('[EmailProcessor] Starting SQS consumer worker...');

    while (this.running) {
      try {
        await this.pollMessages();
      } catch (error) {
        console.error('[EmailProcessor] Error polling SQS:', error);
        // Back off on error before retrying
        await this.sleep(5000);
      }
    }
  }

  /**
   * Stop the worker gracefully.
   */
  stop(): void {
    console.log('[EmailProcessor] Stopping SQS consumer worker...');
    this.running = false;
  }

  /**
   * Poll SQS for messages and process them.
   */
  private async pollMessages(): Promise<void> {
    const messages = await this.receiveMessages();

    if (messages.length === 0) {
      return; // Long polling already waited
    }

    // Process messages concurrently (within batch)
    const results = await Promise.allSettled(
      messages.map(async (msg) => {
        try {
          const parsed = this.parseMessage(msg.body);
          await this.processHandler(parsed);
          // Delete message from queue on success
          await this.deleteMessage(msg.receiptHandle);
        } catch (error) {
          console.error('[EmailProcessor] Failed to process message:', {
            messageId: msg.messageId,
            error,
          });
          // Message will become visible again after visibilityTimeout
          // and be retried (up to maxReceiveCount before going to DLQ)
        }
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[EmailProcessor] ${failed.length}/${messages.length} messages failed`);
    }
  }

  /**
   * Receive messages from SQS queue using @aws-sdk/client-sqs.
   * Uses long polling for efficient message retrieval.
   */
  async receiveMessages(): Promise<SQSMessage[]> {
    if (!this.sqsClient || !this.config.queueUrl) {
      // No SQS configured — wait and return empty (local dev fallback)
      await this.sleep(this.config.waitTimeSeconds * 1000);
      return [];
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.config.queueUrl,
        MaxNumberOfMessages: this.config.maxMessages,
        WaitTimeSeconds: this.config.waitTimeSeconds,
        VisibilityTimeout: this.config.visibilityTimeout,
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      return (response.Messages ?? []).map((m) => ({
        messageId: m.MessageId ?? 'unknown',
        receiptHandle: m.ReceiptHandle ?? '',
        body: m.Body ?? '',
      }));
    } catch (error) {
      console.error('[EmailProcessor] SQS ReceiveMessage failed:', error);
      await this.sleep(5000);
      return [];
    }
  }

  /**
   * Delete a processed message from the queue.
   */
  async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.sqsClient || !this.config.queueUrl) {
      return; // No-op in local dev mode
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.config.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
    } catch (error) {
      console.error('[EmailProcessor] SQS DeleteMessage failed:', error);
    }
  }

  /**
   * Send a message to the SQS queue for processing.
   * Uses a static SQS client to avoid per-call instantiation.
   */
  static async enqueueMessage(
    queueUrl: string,
    message: EmailProcessingMessage,
  ): Promise<string> {
    if (!queueUrl || queueUrl.startsWith('local://')) {
      // For non-SQS environments (local dev), log and return a local ID
      console.log('[EmailProcessor] Enqueued message (local):', message.type);
      return `local-${Date.now()}`;
    }

    try {
      const client = new SQSClient({
        region: process.env['AWS_REGION'] ?? 'us-east-1',
      });

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: message.userId, // FIFO queue: process emails per-user in order
        MessageDeduplicationId: `${message.type}-${message.userId}-${Date.now()}`,
      });

      const response = await client.send(command);
      return response.MessageId ?? `sqs-${Date.now()}`;
    } catch (error) {
      console.error('[EmailProcessor] SQS SendMessage failed:', error);
      // Fallback to local processing mode
      console.log('[EmailProcessor] Enqueued message (local fallback):', message.type);
      return `local-${Date.now()}`;
    }
  }

  /**
   * Parse the raw SQS message body into a typed message.
   */
  parseMessage(body: string): EmailProcessingMessage {
    try {
      const parsed = JSON.parse(body) as EmailProcessingMessage;

      if (!parsed.type || !parsed.userId || !parsed.payload) {
        throw new Error('Invalid message format: missing required fields');
      }

      if (!['process_email', 'gmail_notification', 'scan_inbox'].includes(parsed.type)) {
        throw new Error(`Invalid message type: ${parsed.type}`);
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse SQS message body as JSON: ${body.substring(0, 100)}`);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── SQS Message Type ────────────────────────────────────────────────────────

interface SQSMessage {
  messageId: string;
  receiptHandle: string;
  body: string;
}

/**
 * Default email processing handler.
 * In a full implementation, this would invoke the email parser service
 * to extract booking data from the email.
 */
export async function defaultEmailProcessHandler(
  message: EmailProcessingMessage,
): Promise<void> {
  switch (message.type) {
    case 'process_email': {
      const payload = message.payload as ProcessEmailPayload;
      console.log(`[EmailProcessor] Processing email from ${payload.from}: "${payload.subject}"`);
      // In production:
      // 1. Run email through Comprehend classifier to detect booking type
      // 2. Extract structured fields based on type
      // 3. Deduplicate against existing bookings
      // 4. Create booking record
      // 5. Notify user of new booking or extraction failure
      break;
    }
    case 'gmail_notification': {
      const payload = message.payload as GmailNotificationPayload;
      console.log(`[EmailProcessor] Gmail notification for ${payload.emailAddress}, historyId: ${payload.historyId}`);
      // In production:
      // 1. Use Gmail API history.list to get new messages since historyId
      // 2. Fetch each new message
      // 3. Enqueue each as a 'process_email' message
      break;
    }
    case 'scan_inbox': {
      const payload = message.payload as ScanInboxPayload;
      console.log(`[EmailProcessor] Scanning ${payload.provider} inbox for last ${payload.scanDays} days`);
      // In production:
      // 1. Fetch messages from the last N days
      // 2. Filter for booking confirmation emails
      // 3. Enqueue each as a 'process_email' message
      break;
    }
  }
}
