/**
 * Email Service
 *
 * Abstracted email sending with provider support:
 * - Console (development) — logs to stdout
 * - AWS SES (production) — sends via SES API
 *
 * Features:
 * - Template-based sending (fetches from DB)
 * - Variable interpolation ({{name}}, {{url}}, etc.)
 * - Retry logic (3 attempts, exponential backoff)
 * - Send logging to email_send_log table
 * - Configurable sender addresses per template
 */
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

export type EmailProvider = 'console' | 'ses' | 'sendgrid';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

interface SendTemplateOptions {
  to: string;
  templateSlug: string;
  variables: Record<string, string>;
  fromOverride?: string;
}

export class EmailService {
  private provider: EmailProvider;
  private db: Kysely<Database>;
  private defaultFrom: string;
  private sesRegion?: string;

  constructor(db: Kysely<Database>, options?: { provider?: EmailProvider; defaultFrom?: string; sesRegion?: string }) {
    this.db = db;
    this.provider = options?.provider ?? (process.env.EMAIL_PROVIDER as EmailProvider) ?? 'console';
    this.defaultFrom = options?.defaultFrom ?? process.env.SES_FROM_ADDRESS ?? 'noreply@neyya.ai';
    this.sesRegion = options?.sesRegion ?? process.env.SES_REGION ?? 'eu-west-1';
  }

  /**
   * Send an email using a template from the database.
   * Variables like {{name}} are replaced with provided values.
   */
  async sendTemplate(options: SendTemplateOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, templateSlug, variables, fromOverride } = options;

    // Fetch template from DB
    const template = await (this.db.selectFrom('email_templates' as any) as any)
      .selectAll()
      .where('slug', '=', templateSlug)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!template) {
      console.error(`[Email] Template not found or inactive: ${templateSlug}`);
      return { success: false, error: `Template "${templateSlug}" not found` };
    }

    // Resolve sender address
    let fromEmail = fromOverride ?? this.defaultFrom;
    if (template.sender_address_id) {
      const sender = await (this.db.selectFrom('email_sender_addresses' as any) as any)
        .select(['email', 'name'])
        .where('id', '=', template.sender_address_id)
        .executeTakeFirst();
      if (sender) fromEmail = `${sender.name} <${sender.email}>`;
    }

    // Interpolate variables in subject and body
    let subject = template.subject as string;
    let html = template.html_body as string;
    let text = (template.text_body as string) ?? '';

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(pattern, value);
      html = html.replace(pattern, value);
      text = text.replace(pattern, value);
    }

    // Send with retry
    return this.sendWithRetry({
      to,
      subject,
      html,
      text: text || undefined,
      from: fromEmail,
      replyTo: (template.reply_to as string) ?? undefined,
    }, templateSlug);
  }

  /**
   * Send a raw email (no template).
   */
  async sendRaw(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendWithRetry(options);
  }

  /**
   * Send with retry logic (3 attempts, exponential backoff).
   */
  private async sendWithRetry(options: SendEmailOptions, templateSlug?: string, maxAttempts = 3): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.send(options);

        // Log success
        await this.logSend(templateSlug ?? 'raw', options.to, options.from ?? this.defaultFrom, options.subject ?? '', 'sent', attempt);

        return { success: true, messageId: result.messageId };
      } catch (err: any) {
        lastError = err.message ?? 'Unknown error';
        console.error(`[Email] Attempt ${attempt}/${maxAttempts} failed for ${options.to}: ${lastError}`);

        if (attempt < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    // Log failure
    await this.logSend(templateSlug ?? 'raw', options.to, options.from ?? this.defaultFrom, options.subject ?? '', 'failed', maxAttempts, lastError);

    return { success: false, error: lastError };
  }

  /**
   * Provider-specific send implementation.
   */
  private async send(options: SendEmailOptions): Promise<{ messageId: string }> {
    switch (this.provider) {
      case 'console':
        return this.sendConsole(options);
      case 'ses':
        return this.sendSES(options);
      case 'sendgrid':
        return this.sendSendGrid(options);
      default:
        return this.sendConsole(options);
    }
  }

  /**
   * Console provider — logs email to stdout (development).
   */
  private async sendConsole(options: SendEmailOptions): Promise<{ messageId: string }> {
    const msgId = `console_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log('\n┌─── EMAIL SENT (console) ───────────────────────');
    console.log(`│ To:      ${options.to}`);
    console.log(`│ From:    ${options.from ?? this.defaultFrom}`);
    console.log(`│ Subject: ${options.subject}`);
    if (options.replyTo) console.log(`│ Reply-To: ${options.replyTo}`);
    console.log(`│ ID:      ${msgId}`);
    console.log('│ Body:    (HTML template rendered)');
    console.log('└────────────────────────────────────────────────\n');
    return { messageId: msgId };
  }

  /**
   * AWS SES provider (production).
   */
  private async sendSES(options: SendEmailOptions): Promise<{ messageId: string }> {
    // Dynamic import to avoid requiring aws-sdk in dev
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const client = new SESClient({ region: this.sesRegion });

    const command = new SendEmailCommand({
      Source: options.from ?? this.defaultFrom,
      Destination: { ToAddresses: [options.to] },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      Message: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: options.html, Charset: 'UTF-8' },
          ...(options.text ? { Text: { Data: options.text, Charset: 'UTF-8' } } : {}),
        },
      },
    });

    const result = await client.send(command);
    return { messageId: result.MessageId ?? `ses_${Date.now()}` };
  }

  /**
   * SendGrid provider (alternative).
   */
  private async sendSendGrid(options: SendEmailOptions): Promise<{ messageId: string }> {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('SENDGRID_API_KEY not configured');

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: options.from ?? this.defaultFrom },
        reply_to: options.replyTo ? { email: options.replyTo } : undefined,
        subject: options.subject,
        content: [
          { type: 'text/html', value: options.html },
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
        ],
      }),
    });

    if (!res.ok) throw new Error(`SendGrid error: ${res.status} ${await res.text()}`);
    return { messageId: res.headers.get('x-message-id') ?? `sg_${Date.now()}` };
  }

  /**
   * Log send attempt to email_send_log table.
   */
  private async logSend(templateSlug: string, to: string, from: string, subject: string, status: string, attempts: number, error?: string): Promise<void> {
    try {
      await (this.db.insertInto('email_send_log' as any) as any).values({
        template_slug: templateSlug,
        to_email: to,
        from_email: from,
        subject,
        status,
        attempts,
        last_error: error ?? null,
        sent_at: status === 'sent' ? new Date() : null,
      }).execute();
    } catch (e) {
      console.error('[Email] Failed to log send:', e);
    }
  }
}
