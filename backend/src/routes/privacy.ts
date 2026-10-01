import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { fromNodeHeaders } from 'better-auth/node';
import { pool } from '../db.js';
import { withTransaction } from '../transaction.js';
import {
  auth,
  sendNotificationEmail,
  emailDeliveryConfigured,
  type NotificationEmail,
} from '../auth.js';
import { loadUserRoles, isAdmin } from '../authorization.js';
import { isEmailAddress } from '../validation.js';
import type { PersonalDataReport, SubjectSeed } from '../privacy.js';
import {
  identitySeed,
  seedForUser,
  verifiedAccountEmail,
  buildReportForSeed,
  buildAdminReport,
  buildSubjectIndex,
  findCompositeCandidates,
  eraseIdentitySubject,
  deleteUserAccount,
} from '../privacy.js';
import { backendLink } from '../public-address.js';

const APP_NAME = 'GameRank Tracker';

export const privacyRouter = Router();

type Row = Record<string, unknown>;

const INQUIRY_FIELDS =
  'id, "userId", email, kind, status, verified, "requestedAt", resolution, "resolvedAt"';

function getSession(request: Request): ReturnType<typeof auth.api.getSession> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

async function requireUser(request: Request, response: Response): Promise<string | null> {
  const session = await getSession(request);
  if (!session) {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  return session.user.id;
}

async function requireAdmin(request: Request, response: Response): Promise<string | null> {
  const userId = await requireUser(request, response);
  if (userId === null) {
    return null;
  }
  if (!isAdmin(await loadUserRoles(pool, userId))) {
    response
      .status(403)
      .json({ error: 'Unauthorized: Admin role required', code: 'ADMIN_REQUIRED' });
    return null;
  }
  return userId;
}

function sanitizeAttributes(input: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (input === null || typeof input !== 'object') {
    return result;
  }
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() !== '') {
      result[field] = value.trim();
    }
  }
  return result;
}

function parseAttributes(value: unknown): Record<string, string> {
  if (typeof value !== 'string' || value === '') {
    return {};
  }
  return sanitizeAttributes(JSON.parse(value));
}

function inquirySeed(inquiry: Row): SubjectSeed {
  const email = typeof inquiry['email'] === 'string' ? inquiry['email'] : '';
  const rawUserId = inquiry['userId'];
  return identitySeed({
    userId: typeof rawUserId === 'string' && rawUserId !== '' ? rawUserId : null,
    strongValues: email === '' ? [] : [email],
    attributes: parseAttributes(inquiry['attributes']),
  });
}

function grantedRecordMap(input: unknown): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (input === null || typeof input !== 'object') {
    return map;
  }
  for (const [resource, ids] of Object.entries(input)) {
    if (Array.isArray(ids)) {
      map.set(
        resource,
        new Set(ids.filter((id): id is string => typeof id === 'string' && id !== ''))
      );
    }
  }
  return map;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  return JSON.stringify(value);
}

function reportText(report: PersonalDataReport): string {
  const lines: string[] = [];
  for (const resource of report.resources) {
    lines.push(resource.resource);
    for (const record of resource.records) {
      lines.push(`  ${record.id}`);
      for (const [field, value] of Object.entries(record.fields)) {
        lines.push(`    ${field}: ${formatFieldValue(value)}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function writeReportPdf(response: Response, report: PersonalDataReport): void {
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="personal-data-report.pdf"');
  const document = new PDFDocument({ size: 'A4', margin: 56 });
  document.pipe(response);
  document.fontSize(18).text(`${APP_NAME} — personal data report`);
  document.moveDown();
  document.fontSize(10).text(new Date().toISOString());
  document.moveDown();
  if (report.resources.length === 0) {
    document.fontSize(12).text('No personal data found for this subject.');
  }
  for (const resource of report.resources) {
    document.moveDown();
    document.fontSize(13).text(resource.resource);
    for (const record of resource.records) {
      document.fontSize(9).text(record.id);
      for (const [field, value] of Object.entries(record.fields)) {
        document.fontSize(11).text(`${field}: ${formatFieldValue(value)}`, { indent: 16 });
      }
      document.moveDown(0.5);
    }
  }
  document.end();
}

function respondReport(request: Request, response: Response, report: PersonalDataReport): void {
  if (request.query['format'] === 'pdf') {
    writeReportPdf(response, report);
    return;
  }
  response.json({ report });
}

privacyRouter.get('/account/personal-data', async (request, response) => {
  const userId = await requireUser(request, response);
  if (userId === null) {
    return;
  }
  const report = await buildReportForSeed(pool, await seedForUser(pool, userId));
  response.json({ report });
});

privacyRouter.post('/account/erasure-request', async (request, response) => {
  const userId = await requireUser(request, response);
  if (userId === null) {
    return;
  }
  const pending = await pool.query<Row>(
    'SELECT id FROM "app_privacy_inquiry" WHERE "userId" = $1 AND status = $2 LIMIT 1',
    [userId, 'pending']
  );
  if (pending.rows.length > 0) {
    response.status(409).json({ error: 'An erasure request is already pending' });
    return;
  }
  await pool.query(
    'INSERT INTO "app_privacy_inquiry" (id, "userId", email, kind, attributes, verified, "verifyToken", status, "requestedAt", resolution, "resolvedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [
      randomUUID(),
      userId,
      await verifiedAccountEmail(pool, userId),
      'erasure',
      '{}',
      true,
      '',
      'pending',
      new Date().toISOString(),
      '',
      '',
    ]
  );
  response.json({ success: true });
});

privacyRouter.get('/admin/users/:userId/personal-data', async (request, response) => {
  if ((await requireAdmin(request, response)) === null) {
    return;
  }
  const report = await buildReportForSeed(pool, await seedForUser(pool, request.params.userId));
  respondReport(request, response, report);
});

privacyRouter.get('/admin/privacy-subjects', async (request, response) => {
  if ((await requireAdmin(request, response)) === null) {
    return;
  }
  response.json({ subjects: await buildSubjectIndex(pool) });
});

privacyRouter.get('/admin/privacy-subjects/report', async (request, response) => {
  if ((await requireAdmin(request, response)) === null) {
    return;
  }
  const email = typeof request.query['email'] === 'string' ? request.query['email'] : '';
  const attributes = parseAttributes(request.query['attributes']);
  if (email === '' && Object.keys(attributes).length === 0) {
    response.status(400).json({ error: 'email or attributes required' });
    return;
  }
  const userIdParam =
    typeof request.query['userId'] === 'string' && request.query['userId'] !== ''
      ? request.query['userId']
      : null;
  const seed = identitySeed({
    userId: userIdParam,
    strongValues: email === '' ? [] : [email],
    attributes,
  });
  respondReport(request, response, await buildAdminReport(pool, seed));
});

privacyRouter.get('/admin/privacy-inquiries', async (request, response) => {
  if ((await requireAdmin(request, response)) === null) {
    return;
  }
  const { rows } = await pool.query<Row>(
    `SELECT ${INQUIRY_FIELDS} FROM "app_privacy_inquiry" ORDER BY "requestedAt" DESC`
  );
  response.json({ inquiries: rows });
});

async function findInquiry(id: string): Promise<Row | undefined> {
  const { rows } = await pool.query<Row>('SELECT * FROM "app_privacy_inquiry" WHERE id = $1', [id]);
  return rows[0];
}

privacyRouter.get('/admin/privacy-inquiries/:id/candidates', async (request, response) => {
  if ((await requireAdmin(request, response)) === null) {
    return;
  }
  const inquiry = await findInquiry(request.params.id);
  if (inquiry === undefined) {
    response.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  response.json({ candidates: await findCompositeCandidates(pool, inquirySeed(inquiry)) });
});

privacyRouter.get('/admin/privacy-inquiries/:id/report', async (request, response) => {
  if ((await requireAdmin(request, response)) === null) {
    return;
  }
  const inquiry = await findInquiry(request.params.id);
  if (inquiry === undefined) {
    response.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  respondReport(request, response, await buildAdminReport(pool, inquirySeed(inquiry)));
});

function textEmail(recipient: string, subject: string, body: string): NotificationEmail {
  return {
    recipient,
    subject,
    body,
    html: '',
    inReplyTo: '',
    attachmentName: '',
    attachmentBody: '',
  };
}

async function mailReport(email: string, report: PersonalDataReport): Promise<void> {
  if (email === '' || !emailDeliveryConfigured()) {
    console.log(`[privacy] personal data report for ${email || 'unknown recipient'} not sent`);
    return;
  }
  await sendNotificationEmail(
    textEmail(
      email,
      `${APP_NAME} — your personal data`,
      `The personal data held about you:\n\n${reportText(report)}`
    )
  );
}

privacyRouter.post('/admin/privacy-inquiries/:id/resolve', async (request, response) => {
  const adminId = await requireAdmin(request, response);
  if (adminId === null) {
    return;
  }
  const body = request.body as { resolution?: unknown; granted?: unknown };
  const { resolution } = body;
  if (
    resolution !== 'report' &&
    resolution !== 'amend' &&
    resolution !== 'anonymize' &&
    resolution !== 'delete'
  ) {
    response.status(400).json({ error: 'resolution must be report, amend, anonymize, or delete' });
    return;
  }
  const inquiry = await findInquiry(request.params.id);
  if (inquiry === undefined) {
    response.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  if (inquiry['verified'] !== true) {
    response.status(400).json({ error: 'Inquiry is not verified' });
    return;
  }
  const seed = inquirySeed(inquiry);
  if (seed.userId !== null && seed.userId === adminId) {
    response.status(400).json({ error: 'Cannot erase your own account' });
    return;
  }
  if (resolution === 'report') {
    await mailReport(
      typeof inquiry['email'] === 'string' ? inquiry['email'] : '',
      await buildReportForSeed(pool, seed)
    );
  }
  if (resolution === 'anonymize' || resolution === 'delete') {
    const granted = grantedRecordMap(body.granted);
    await withTransaction(pool, async (client) => {
      await eraseIdentitySubject(client, seed, granted, resolution);
      if (resolution === 'delete' && seed.userId !== null) {
        await deleteUserAccount(client, seed.userId);
      }
    });
  }
  await pool.query(
    'UPDATE "app_privacy_inquiry" SET status = $1, resolution = $2, "resolvedAt" = $3 WHERE id = $4',
    ['resolved', resolution, new Date().toISOString(), request.params.id]
  );
  response.json({ success: true });
});

function isInquiryKind(value: unknown): value is 'access' | 'rectification' | 'erasure' {
  return value === 'access' || value === 'rectification' || value === 'erasure';
}

const INQUIRY_WINDOW_MS = 60 * 60 * 1000;
const INQUIRIES_PER_ADDRESS = 10;
const INQUIRIES_PER_EMAIL = 3;
const INQUIRY_SENDER_CAPACITY = 10_000;
const inquiryWindows = new Map<string, number[]>();

function pruneInquiryWindows(now: number): void {
  if (inquiryWindows.size >= INQUIRY_SENDER_CAPACITY) {
    for (const [sender, moments] of inquiryWindows) {
      if (moments.every((moment) => now - moment >= INQUIRY_WINDOW_MS)) {
        inquiryWindows.delete(sender);
      }
    }
  }
}

function inquiryAllowed(sender: string, limit: number): boolean {
  const now = Date.now();
  pruneInquiryWindows(now);
  const recent = (inquiryWindows.get(sender) ?? []).filter(
    (moment) => now - moment < INQUIRY_WINDOW_MS
  );
  if (recent.length >= limit) {
    inquiryWindows.set(sender, recent);
    return false;
  }
  recent.push(now);
  inquiryWindows.set(sender, recent);
  return true;
}

function verificationLink(token: string): string {
  return backendLink(`/api/privacy/inquiry/verify?token=${encodeURIComponent(token)}`);
}

privacyRouter.post('/privacy/inquiry', async (request, response) => {
  const body = request.body as { kind?: unknown; email?: unknown; attributes?: unknown };
  if (!isInquiryKind(body.kind)) {
    response.status(400).json({ error: 'kind must be access, rectification, or erasure' });
    return;
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!isEmailAddress(email)) {
    response.status(400).json({ error: 'A valid email is required' });
    return;
  }
  if (
    !inquiryAllowed(`address:${request.ip ?? ''}`, INQUIRIES_PER_ADDRESS) ||
    !inquiryAllowed(`email:${email.toLowerCase()}`, INQUIRIES_PER_EMAIL)
  ) {
    response.status(429).json({ error: 'Too many requests' });
    return;
  }
  const verifyToken = randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO "app_privacy_inquiry" (id, "userId", email, kind, attributes, verified, "verifyToken", status, "requestedAt", resolution, "resolvedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
    [
      randomUUID(),
      '',
      email,
      body.kind,
      JSON.stringify(sanitizeAttributes(body.attributes)),
      false,
      verifyToken,
      'unverified',
      new Date().toISOString(),
      '',
      '',
    ]
  );
  const link = verificationLink(verifyToken);
  if (emailDeliveryConfigured()) {
    await sendNotificationEmail(
      textEmail(
        email,
        `${APP_NAME} — confirm your data protection request`,
        `Confirm your request by opening this link:\n\n${link}`
      )
    );
  } else {
    console.log(`[email not configured] Data protection verification for ${email}: ${link}`);
  }
  response.json({ success: true });
});

privacyRouter.get('/privacy/inquiry/verify', async (request, response) => {
  const token = typeof request.query['token'] === 'string' ? request.query['token'] : '';
  if (token === '') {
    response.status(400).json({ error: 'token required' });
    return;
  }
  const updated = await pool.query(
    'UPDATE "app_privacy_inquiry" SET verified = TRUE, "verifyToken" = $1, status = $2 WHERE "verifyToken" = $3',
    ['', 'pending', token]
  );
  if (updated.rowCount === 0) {
    response.status(404).json({ error: 'Inquiry not found' });
    return;
  }
  response.json({ success: true });
});
