/**
 * Email Automation Engine
 *
 * Processes trigger-based email sequences:
 * - Welcome series (triggered on lead signup)
 * - Trial conversion (triggered on trial start)
 * - Re-engagement (triggered on inactivity)
 * - Upgrade nudge (triggered on plan limit hit)
 *
 * Admin:
 *  - GET  /api/admin/automations           — list automation sequences
 *  - PUT  /api/admin/automations/:id       — enable/disable/edit automation
 *  - POST /api/admin/automations/process   — manually trigger processing (for testing)
 *
 * Internal:
 *  - Called by lead capture and subscription events to trigger sequences
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

interface AutomationOptions {
  db: Kysely<Database>;
}

export async function registerAutomationRoutes(
  app: FastifyInstance,
  options: AutomationOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/admin/automations ────────────────────────────────────────────
  app.get('/api/admin/automations', async (_request: FastifyRequest, reply: FastifyReply) => {
    const automations = await (db as any).selectFrom('email_automations').selectAll().orderBy('created_at', 'asc').execute();

    // Get send stats per automation
    const enriched = await Promise.all(automations.map(async (auto: any) => {
      const sends = await (db as any).selectFrom('email_sends')
        .select(sql`count(*)`.as('total'))
        .where('automation_id', '=', auto.id)
        .executeTakeFirst();
      const opened = await (db as any).selectFrom('email_sends')
        .select(sql`count(*)`.as('total'))
        .where('automation_id', '=', auto.id)
        .where('opened_at', 'is not', null)
        .executeTakeFirst();

      return {
        ...auto,
        total_sent: Number(sends?.total ?? 0),
        total_opened: Number(opened?.total ?? 0),
      };
    }));

    return reply.send({ statusCode: 200, data: enriched });
  });

  // ─── PUT /api/admin/automations/:id — toggle/edit automation ───────────────
  app.put('/api/admin/automations/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { is_active, steps, name } = request.body as any;

    const updates: any = { updated_at: new Date() };
    if (is_active !== undefined) updates.is_active = is_active;
    if (steps) updates.steps = JSON.stringify(steps);
    if (name) updates.name = name;

    await (db as any).updateTable('email_automations').set(updates).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Automation updated' });
  });

  // ─── POST /api/admin/automations/process — process pending automation sends ─
  app.post('/api/admin/automations/process', async (_request: FastifyRequest, reply: FastifyReply) => {
    const results = await processAutomations(db);
    return reply.send({ statusCode: 200, data: results });
  });

  // ─── Internal: Trigger automation on event ─────────────────────────────────
  // This is called internally when events occur (lead signup, trial start, etc.)
  app.post('/api/internal/trigger-automation', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { event, email, name, userId, leadId } = request.body as any;
    if (!event || !email) {
      return reply.status(400).send({ statusCode: 400, error: 'Event and email required' });
    }

    // Find matching automation
    const automation = await (db as any).selectFrom('email_automations')
      .selectAll()
      .where('trigger_event', '=', event)
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!automation) {
      return reply.send({ statusCode: 200, message: 'No active automation for this event' });
    }

    // Queue the first step (day 0)
    const steps = typeof automation.steps === 'string' ? JSON.parse(automation.steps) : automation.steps;
    const firstStep = steps.find((s: any) => s.day === 0);

    if (firstStep) {
      await (db as any).insertInto('email_sends').values({
        automation_id: automation.id,
        recipient_email: email,
        recipient_name: name ?? null,
        lead_id: leadId ?? null,
        user_id: userId ?? null,
        subject: firstStep.subject,
        status: 'queued',
      }).execute().catch(() => {});
    }

    // Queue future steps with scheduled dates
    for (const step of steps.filter((s: any) => s.day > 0)) {
      const sendDate = new Date(Date.now() + step.day * 24 * 60 * 60 * 1000);
      await (db as any).insertInto('email_sends').values({
        automation_id: automation.id,
        recipient_email: email,
        recipient_name: name ?? null,
        lead_id: leadId ?? null,
        user_id: userId ?? null,
        subject: step.subject,
        status: 'scheduled',
        sent_at: sendDate, // Using sent_at as scheduled time for now
      }).execute().catch(() => {});
    }

    return reply.send({
      statusCode: 200,
      message: `Automation "${automation.name}" triggered for ${email}`,
      data: { automationId: automation.id, stepsQueued: steps.length },
    });
  });
}

/**
 * Process all pending automation sends.
 * In production, this would be called by a scheduled Lambda/cron.
 */
async function processAutomations(db: Kysely<Database>): Promise<{ processed: number; sent: number; errors: number }> {
  // Get all queued sends that should be sent now
  const pendingSends = await (db as any).selectFrom('email_sends')
    .selectAll()
    .where('status', 'in', ['queued', 'scheduled'])
    .where((eb: any) => eb.or([
      eb('status', '=', 'queued'),
      eb('sent_at', '<=', new Date()), // scheduled time has passed
    ]))
    .limit(50) // Process in batches
    .execute();

  let sent = 0;
  let errors = 0;

  const { EmailService } = await import('../services/email.js');
  const emailService = new EmailService(db);
  const trackingBaseUrl = process.env.API_URL ?? 'https://api-qa.neyya.ai';

  for (const send of pendingSends) {
    try {
      // Look up template content from automation steps or campaign template
      let html = `<p>Hi ${send.recipient_name?.split(' ')[0] ?? 'there'},</p>`;
      let subject = send.subject ?? 'Update from Neyya';

      // If this send has an automation_id, fetch the step template
      if (send.automation_id) {
        const automation = await (db as any).selectFrom('email_automations')
          .select('steps')
          .where('id', '=', send.automation_id)
          .executeTakeFirst();
        if (automation) {
          const steps = typeof automation.steps === 'string' ? JSON.parse(automation.steps) : automation.steps;
          const matchingStep = steps.find((s: any) => s.subject === send.subject);
          if (matchingStep?.html) {
            html = matchingStep.html
              .replace(/\{\{name\}\}/g, send.recipient_name?.split(' ')[0] ?? 'there')
              .replace(/\{\{email\}\}/g, send.recipient_email ?? '');
          } else if (matchingStep?.body) {
            html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">${matchingStep.body.replace(/\{\{name\}\}/g, send.recipient_name?.split(' ')[0] ?? 'there')}</div>`;
          }
        }
      }

      // If this send has a campaign_id, fetch the campaign template
      if (send.campaign_id && !send.automation_id) {
        const campaign = await (db as any).selectFrom('email_campaigns')
          .select('template_id')
          .where('id', '=', send.campaign_id)
          .executeTakeFirst();
        if (campaign?.template_id) {
          const template = await (db as any).selectFrom('email_templates')
            .selectAll()
            .where('id', '=', campaign.template_id)
            .executeTakeFirst();
          if (template) {
            html = (template.body_html ?? template.bodyHtml ?? html)
              .replace(/\{\{name\}\}/g, send.recipient_name?.split(' ')[0] ?? 'there')
              .replace(/\{\{email\}\}/g, send.recipient_email ?? '');
          }
        }
      }

      // Add tracking pixel and unsubscribe link
      html += `<img src="${trackingBaseUrl}/api/email/track/open/${send.id}" width="1" height="1" style="display:none" alt="" />`;
      html += `<p style="font-size:11px;color:#999;text-align:center;margin-top:20px;"><a href="${trackingBaseUrl}/api/email/unsubscribe?email=${encodeURIComponent(send.recipient_email)}" style="color:#999;">Unsubscribe</a></p>`;

      const result = await emailService.sendRaw({
        to: send.recipient_email,
        subject,
        html,
        from: 'Neyya <noreply@neyya.ai>',
      });

      if (result.success) {
        await (db as any).updateTable('email_sends').set({
          status: 'sent',
          sent_at: new Date(),
          message_id: result.messageId,
        }).where('id', '=', send.id).execute();
        sent++;
      } else {
        await (db as any).updateTable('email_sends').set({
          status: 'failed',
          error_message: result.error?.slice(0, 500),
        }).where('id', '=', send.id).execute();
        errors++;
      }
    } catch (err: any) {
      await (db as any).updateTable('email_sends').set({
        status: 'failed',
        error_message: err.message?.slice(0, 500) ?? 'Unknown error',
      }).where('id', '=', send.id).execute();
      errors++;
    }

    // Rate limit: 14/second for SES sandbox
    if (sent % 14 === 0 && sent > 0) {
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  return { processed: pendingSends.length, sent, errors };
}
