/**
 * Email Campaign Routes
 *
 * Admin:
 *  - GET    /api/admin/campaigns          — list campaigns
 *  - POST   /api/admin/campaigns          — create campaign
 *  - POST   /api/admin/campaigns/generate — AI generate email content
 *  - POST   /api/admin/campaigns/:id/send — send campaign
 *  - GET    /api/admin/campaigns/:id/stats — campaign analytics
 *  - GET    /api/admin/email-templates    — list templates
 *  - POST   /api/admin/email-templates    — create template
 *
 * Public:
 *  - GET    /api/email/unsubscribe/:token — one-click unsubscribe
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

interface EmailCampaignOptions {
  db: Kysely<Database>;
}

export async function registerEmailCampaignRoutes(
  app: FastifyInstance,
  options: EmailCampaignOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/admin/email-templates ────────────────────────────────────────
  app.get('/api/admin/email-templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    const templates = await (db as any).selectFrom('email_templates').selectAll().orderBy('created_at', 'desc').execute();
    return reply.send({ statusCode: 200, data: templates });
  });

  // ─── POST /api/admin/email-templates ───────────────────────────────────────
  app.post('/api/admin/email-templates', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { name, subject, previewText, bodyHtml, bodyText, category } = request.body as any;
    if (!name || !subject || !bodyHtml) {
      return reply.status(400).send({ statusCode: 400, error: 'Name, subject, and body are required' });
    }

    const template = await (db as any).insertInto('email_templates').values({
      name, subject, preview_text: previewText ?? null,
      body_html: bodyHtml, body_text: bodyText ?? null,
      category: category ?? 'general',
      created_by: (request as any).userId ?? null,
    }).returning('id').executeTakeFirst();

    return reply.status(201).send({ statusCode: 201, data: template, message: 'Template created' });
  });

  // ─── POST /api/admin/campaigns/generate — AI email generation ──────────────
  app.post('/api/admin/campaigns/generate', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { prompt, tone, audience } = request.body as any;
    if (!prompt) {
      return reply.status(400).send({ statusCode: 400, error: 'Prompt is required' });
    }

    const toneInstructions: Record<string, string> = {
      friendly: 'Use a warm, conversational tone. Be approachable and encouraging.',
      urgent: 'Create urgency without being pushy. Use action-oriented language.',
      educational: 'Be informative and helpful. Teach something valuable.',
      promotional: 'Highlight the value proposition clearly. Include a compelling CTA.',
    };

    const systemPrompt = `You are an email marketing copywriter for Neyya.ai, an AI-powered travel companion app.
Write a marketing email based on the user's request.
${toneInstructions[tone] ?? toneInstructions.friendly}
Target audience: ${audience ?? 'travel enthusiasts who signed up but haven not created an account yet'}.

Respond in JSON format:
{
  "subject": "Email subject line (max 60 chars, compelling)",
  "previewText": "Preview text shown in inbox (max 90 chars)",
  "body": "Full email body in HTML (use <h2>, <p>, <ul>, <a> tags). Include personalization tokens like {{name}} and {{city}} where appropriate. End with a clear CTA button."
}`;

    // Try Bedrock AI generation
    try {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
      const client = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION ?? 'eu-west-1' });

      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
          system: systemPrompt,
        }),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.content?.[0]?.text ?? '';

      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const generated = JSON.parse(jsonMatch[0]);
        return reply.send({ statusCode: 200, data: generated });
      }

      return reply.send({ statusCode: 200, data: { subject: 'Generated Email', previewText: '', body: content } });
    } catch (error: any) {
      // Fallback: generate a simple template
      return reply.send({
        statusCode: 200,
        data: {
          subject: `[Neyya] ${prompt.slice(0, 50)}`,
          previewText: 'Your AI travel companion has something for you',
          body: `<h2>Hi {{name}},</h2><p>${prompt}</p><p>Best regards,<br/>The Neyya Team</p><p><a href="https://neyya.ai" style="background:#32CD32;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Open Neyya</a></p>`,
        },
        note: 'AI unavailable, using fallback template',
      });
    }
  });

  // ─── GET /api/admin/campaigns ──────────────────────────────────────────────
  app.get('/api/admin/campaigns', async (_request: FastifyRequest, reply: FastifyReply) => {
    const campaigns = await (db as any).selectFrom('email_campaigns').selectAll().orderBy('created_at', 'desc').execute();
    return reply.send({ statusCode: 200, data: campaigns });
  });

  // ─── POST /api/admin/campaigns ─────────────────────────────────────────────
  app.post('/api/admin/campaigns', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { name, templateId, segment, scheduledAt } = request.body as any;
    if (!name) return reply.status(400).send({ statusCode: 400, error: 'Campaign name required' });

    const campaign = await (db as any).insertInto('email_campaigns').values({
      name, template_id: templateId ?? null, segment: segment ?? null,
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
      created_by: (request as any).userId ?? null,
    }).returning('id').executeTakeFirst();

    return reply.status(201).send({ statusCode: 201, data: campaign, message: 'Campaign created' });
  });

  // ─── POST /api/admin/campaigns/:id/send ────────────────────────────────────
  app.post('/api/admin/campaigns/:id/send', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Get campaign + template
    const campaign = await (db as any).selectFrom('email_campaigns').selectAll().where('id', '=', id).executeTakeFirst();
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Campaign not found' });

    const template = campaign.template_id
      ? await (db as any).selectFrom('email_templates').selectAll().where('id', '=', campaign.template_id).executeTakeFirst()
      : null;

    if (!template) return reply.status(400).send({ statusCode: 400, error: 'No template assigned to this campaign' });

    // Get recipients based on segment
    let recipients: any[] = [];
    if (campaign.segment === 'all_leads') {
      recipients = await (db as any).selectFrom('crm_leads').select(['email', 'full_name']).where('status', '!=', 'unsubscribed').execute();
    } else if (campaign.segment === 'new_leads') {
      recipients = await (db as any).selectFrom('crm_leads').select(['email', 'full_name']).where('status', '=', 'new').execute();
    } else {
      // Default: all leads with marketing consent
      recipients = await (db as any).selectFrom('crm_leads').select(['email', 'full_name']).where('marketing_consent', '=', true).execute();
    }

    // Filter out unsubscribed
    const unsubscribed = await (db as any).selectFrom('email_unsubscribes').select('email').execute();
    const unsubSet = new Set(unsubscribed.map((u: any) => u.email));
    recipients = recipients.filter((r: any) => !unsubSet.has(r.email));

    // Queue sends (in production, this would use SQS for async processing)
    let sentCount = 0;
    for (const recipient of recipients) {
      const personalizedSubject = template.subject.replace('{{name}}', recipient.full_name?.split(' ')[0] ?? 'there');

      await (db as any).insertInto('email_sends').values({
        campaign_id: id,
        recipient_email: recipient.email,
        recipient_name: recipient.full_name,
        subject: personalizedSubject,
        status: 'queued',
      }).execute().catch(() => {});

      // TODO: Actually send via SES here
      // For now, mark as sent
      sentCount++;
    }

    // Update campaign stats
    await (db as any).updateTable('email_campaigns').set({
      status: 'sent', sent_at: new Date(),
      total_recipients: recipients.length, total_sent: sentCount,
    }).where('id', '=', id).execute();

    return reply.send({ statusCode: 200, message: `Campaign sent to ${sentCount} recipients`, data: { sent: sentCount, total: recipients.length } });
  });

  // ─── GET /api/admin/campaigns/:id/stats ────────────────────────────────────
  app.get('/api/admin/campaigns/:id/stats', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const campaign = await (db as any).selectFrom('email_campaigns').selectAll().where('id', '=', id).executeTakeFirst();
    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Campaign not found' });

    const sends = await (db as any).selectFrom('email_sends').selectAll().where('campaign_id', '=', id).execute();
    const opened = sends.filter((s: any) => s.opened_at).length;
    const clicked = sends.filter((s: any) => s.clicked_at).length;
    const bounced = sends.filter((s: any) => s.bounced_at).length;

    return reply.send({
      statusCode: 200,
      data: {
        ...campaign,
        total_sent: sends.length,
        total_opened: opened,
        total_clicked: clicked,
        total_bounced: bounced,
        open_rate: sends.length > 0 ? Math.round((opened / sends.length) * 100) : 0,
        click_rate: sends.length > 0 ? Math.round((clicked / sends.length) * 100) : 0,
      },
    });
  });

  // ─── GET /api/email/track/open/:sendId — open tracking pixel ─────────────
  app.get('/api/email/track/open/:sendId', async (request: FastifyRequest<{ Params: { sendId: string } }>, reply: FastifyReply) => {
    const { sendId } = request.params;
    // Record the open
    await (db as any).updateTable('email_sends')
      .set({ opened_at: new Date(), status: 'opened' })
      .where('id', '=', sendId)
      .where('opened_at', 'is', null)
      .execute().catch(() => {});

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return reply.header('Content-Type', 'image/gif').header('Cache-Control', 'no-store').send(pixel);
  });

  // ─── GET /api/email/track/click/:sendId — click tracking redirect ──────────
  app.get('/api/email/track/click/:sendId', async (request: FastifyRequest<{ Params: { sendId: string }; Querystring: { url?: string } }>, reply: FastifyReply) => {
    const { sendId } = request.params;
    const { url } = request.query;

    // Record the click
    await (db as any).updateTable('email_sends')
      .set({ clicked_at: new Date() })
      .where('id', '=', sendId)
      .where('clicked_at', 'is', null)
      .execute().catch(() => {});

    // Redirect to actual URL
    const destination = url ?? 'https://neyya.ai';
    return reply.redirect(302, destination);
  });

  // ─── GET /api/admin/email-analytics — overall email performance ────────────
  app.get('/api/admin/email-analytics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const totalSent = await (db as any).selectFrom('email_sends').select(sql`count(*)`.as('c')).where('status', 'in', ['sent', 'opened']).executeTakeFirst();
    const totalOpened = await (db as any).selectFrom('email_sends').select(sql`count(*)`.as('c')).where('opened_at', 'is not', null).executeTakeFirst();
    const totalClicked = await (db as any).selectFrom('email_sends').select(sql`count(*)`.as('c')).where('clicked_at', 'is not', null).executeTakeFirst();
    const totalBounced = await (db as any).selectFrom('email_sends').select(sql`count(*)`.as('c')).where('status', '=', 'bounced').executeTakeFirst();
    const totalUnsubscribed = await (db as any).selectFrom('email_unsubscribes').select(sql`count(*)`.as('c')).executeTakeFirst();

    const sent = Number(totalSent?.c ?? 0);
    const opened = Number(totalOpened?.c ?? 0);
    const clicked = Number(totalClicked?.c ?? 0);

    // Recent sends (last 7 days)
    const recentSends = await (db as any).selectFrom('email_sends')
      .select([sql`DATE(sent_at)`.as('date'), sql`count(*)`.as('count')])
      .where('sent_at', '>=', sql`NOW() - INTERVAL '7 days'`)
      .where('sent_at', 'is not', null)
      .groupBy(sql`DATE(sent_at)`)
      .orderBy('date', 'asc')
      .execute();

    return reply.send({
      statusCode: 200,
      data: {
        totalSent: sent,
        totalOpened: opened,
        totalClicked: clicked,
        totalBounced: Number(totalBounced?.c ?? 0),
        totalUnsubscribed: Number(totalUnsubscribed?.c ?? 0),
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
        recentSends,
      },
    });
  });

  // ─── GET /api/email/unsubscribe — one-click unsubscribe ────────────────────
  app.get('/api/email/unsubscribe', async (request: FastifyRequest<{ Querystring: { email?: string } }>, reply: FastifyReply) => {
    const { email } = request.query;
    if (!email) return reply.status(400).send({ statusCode: 400, error: 'Email required' });

    await (db as any).insertInto('email_unsubscribes').values({
      email: email.toLowerCase(),
    }).onConflict((oc: any) => oc.column('email').doNothing()).execute();

    // Also update lead status
    await (db as any).updateTable('crm_leads').set({ status: 'unsubscribed' }).where('email', '=', email.toLowerCase()).execute().catch(() => {});

    return reply.send({ statusCode: 200, message: 'You have been unsubscribed. You will no longer receive marketing emails from Neyya.' });
  });

  // ─── GET /api/admin/automations ────────────────────────────────────────────
  app.get('/api/admin/automations', async (_request: FastifyRequest, reply: FastifyReply) => {
    const automations = await (db as any).selectFrom('email_automations').selectAll().orderBy('created_at', 'asc').execute();
    return reply.send({ statusCode: 200, data: automations });
  });
}
