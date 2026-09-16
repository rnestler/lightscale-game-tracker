import { betterAuth } from 'better-auth';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { toNodeHandler } from 'better-auth/node';
import { APIError } from 'better-auth/api';
import type { Request, Response } from 'express';
import { admin, twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { createAccessControl } from 'better-auth/plugins/access';
import { pool } from './db.js';
import nodemailer from 'nodemailer';
import { renderEmailHtml } from './email-format.js';
import { backendAddress, publicAddress } from './public-address.js';

const APP_NAME = 'GameRank Tracker';
const EMAIL_LANGUAGE = 'en';
const AUTH_EMAILS = {
  linkFallback: 'Or paste this link into your browser:',
  resetPassword: {
    subject: 'Reset your password',
    heading: 'Reset your GameRank Tracker password',
    body: 'Use the button below to choose a new password. If you did not request this, you can safely ignore this email.',
    action: 'Reset password',
  },
  verifyEmail: {
    subject: 'Verify your email',
    heading: 'Verify your email for GameRank Tracker',
    body: 'Confirm your email address using the button below to finish signing in. If you did not create an account, you can safely ignore this email.',
    action: 'Verify email',
  },
  invitation: {
    subject: 'You have been invited to GameRank Tracker',
    heading: 'Join GameRank Tracker',
    body: 'You have been invited to join GameRank Tracker. Use the button below to create your account.',
    action: 'Accept invitation',
  },
  adminInvitation: {
    subject: 'You have been invited to administer GameRank Tracker',
    heading: 'Administer GameRank Tracker',
    body: 'You have been invited to administer GameRank Tracker. Use the button below to create your administrator account.',
    action: 'Create administrator account',
  },
  duplicateSubmission: {
    subject: 'Your submission to GameRank Tracker',
    heading: 'A record with your address already exists',
    body: 'A new submission with this email address was made to GameRank Tracker. A record with this address already exists, so nothing was changed. If this was not you, you can ignore this email.',
  },
};
export const COOKIE_PREFIX = 'gamerank-tracker';

const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

interface ActionEmailText {
  subject: string;
  heading: string;
  body: string;
  action: string;
}

function actionEmailHtml(text: ActionEmailText, url: string): string {
  const safeUrl = escapeHtml(url);
  return [
    '<!doctype html><html lang="',
    escapeHtml(EMAIL_LANGUAGE),
    '"><body style="margin:0;padding:0;background-color:#f5f5f4;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;">',
    '<tr><td align="center" style="padding:40px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">',
    '<tr><td style="background-color:#ffffff;border:1px solid #e7e5e4;border-radius:14px;padding:40px;font-family:',
    EMAIL_FONT_STACK,
    ';">',
    '<h1 style="margin:0 0 18px;font-size:20px;line-height:28px;font-weight:600;color:#0c0a09;">',
    escapeHtml(text.heading),
    '</h1>',
    '<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#44403c;">',
    escapeHtml(text.body),
    '</p>',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 26px;"><tr>',
    '<td style="border-radius:10px;background-color:#0c0a09;">',
    '<a href="',
    safeUrl,
    '" style="display:inline-block;padding:13px 28px;font-family:',
    EMAIL_FONT_STACK,
    ';font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">',
    escapeHtml(text.action),
    '</a>',
    '</td></tr></table>',
    '<p style="margin:0;font-size:13px;line-height:20px;color:#a8a29e;">',
    escapeHtml(AUTH_EMAILS.linkFallback),
    '<br>',
    '<a href="',
    safeUrl,
    '" style="color:#78716c;word-break:break-all;">',
    safeUrl,
    '</a></p>',
    '<p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #f0eeec;font-size:12px;line-height:18px;color:#a8a29e;">Powered by Lightscale AI</p>',
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

async function userHasCredentialAccount(userId: string): Promise<boolean> {
  const result = await pool.query<{ providerId: string }>(
    'SELECT "providerId" FROM "account" WHERE "userId" = $1',
    [userId]
  );
  return result.rows.some((row) => row.providerId === 'credential');
}

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  inReplyTo: string | null;
  attachments: EmailAttachment[];
}

export interface NotificationEmail {
  recipient: string;
  subject: string;
  body: string;
  html: string;
  inReplyTo: string;
  attachmentName: string;
  attachmentBody: string;
}

async function sendEmail(message: OutgoingEmail): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('Email delivery is not configured');
  }
  const port = Number(process.env.SMTP_PORT ?? '587');
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? `${APP_NAME} <${user}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    inReplyTo: message.inReplyTo ?? undefined,
    references: message.inReplyTo ?? undefined,
    attachments: message.attachments,
  });
}

async function sendActionEmail(email: string, text: ActionEmailText, url: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: text.subject,
    text: `${text.body}\n\n${url}`,
    html: actionEmailHtml(text, url),
    inReplyTo: null,
    attachments: [],
  });
}

function logUndeliveredLink(label: string, email: string, url: string): void {
  console.log(
    `[email not configured] Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env to deliver mail. ${label} for ${email}: ${url}`
  );
}

async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  if (!emailDeliveryConfigured()) {
    logUndeliveredLink('Password reset link', email, url);
    return;
  }
  await sendActionEmail(email, AUTH_EMAILS.resetPassword, url);
}

async function sendVerificationEmail(email: string, url: string): Promise<void> {
  if (!emailDeliveryConfigured()) {
    logUndeliveredLink('Verification link', email, url);
    return;
  }
  await sendActionEmail(email, AUTH_EMAILS.verifyEmail, url);
}

function servedPublicly(address: string): boolean {
  return URL.canParse(address) && new URL(address).origin === publicAddress().origin;
}

function buildVerifyLink(verificationUrl: string, token: string): string {
  const callbackUrl = new URL(verificationUrl).searchParams.get('callbackURL');
  if (callbackUrl === null || !servedPublicly(callbackUrl)) {
    return verificationUrl;
  }
  const separator = callbackUrl.includes('?') ? '&' : '?';
  return `${callbackUrl}${separator}token=${encodeURIComponent(token)}`;
}

async function getRequireEmailVerification(): Promise<boolean> {
  const result = await pool.query<{ requireEmailVerification: boolean }>(
    'SELECT "requireEmailVerification" FROM "app_config" LIMIT 1'
  );
  return result.rows.at(0)?.requireEmailVerification ?? true;
}

async function getInviteOnly(): Promise<boolean> {
  const result = await pool.query<{ inviteOnly: boolean }>(
    'SELECT "inviteOnly" FROM "app_config" LIMIT 1'
  );
  return result.rows.at(0)?.inviteOnly ?? false;
}

async function findPendingInvitation(
  email: string
): Promise<{ id: string; roleId: string } | null> {
  const result = await pool.query<{ id: string; roleId: string }>(
    'SELECT id, "roleId" FROM "app_invitation" WHERE LOWER(email) = LOWER($1) AND "expiresAt" > NOW() LIMIT 1',
    [email]
  );
  return result.rows.at(0) ?? null;
}

async function findInvitationByToken(
  token: string,
  email: string
): Promise<{ id: string; roleId: string } | null> {
  const result = await pool.query<{ id: string; roleId: string }>(
    'SELECT id, "roleId" FROM "app_invitation" WHERE token = $1 AND LOWER(email) = LOWER($2) AND "expiresAt" > NOW() LIMIT 1',
    [token, email]
  );
  return result.rows.at(0) ?? null;
}

function isCredentialSignUp(context: unknown): boolean {
  return (context as { path?: unknown } | null)?.path === '/sign-up/email';
}

function invitationTokenFromContext(context: unknown): string | null {
  const body = (context as { body?: unknown } | null)?.body;
  const token = (body as { inviteToken?: unknown } | undefined)?.inviteToken;
  return typeof token === 'string' && token !== '' ? token : null;
}

function pendingInvitationForSignUp(
  email: string,
  context: unknown
): Promise<{ id: string; roleId: string } | null> {
  if (isCredentialSignUp(context)) {
    const token = invitationTokenFromContext(context);
    if (token === null) {
      return Promise.resolve(null);
    }
    return findInvitationByToken(token, email);
  }
  return findPendingInvitation(email);
}

async function consumeInvitation(userId: string, context: unknown): Promise<void> {
  const userResult = await pool.query<{ email: string }>('SELECT email FROM "user" WHERE id = $1', [
    userId,
  ]);
  const email = userResult.rows.at(0)?.email;
  if (email === undefined) {
    return;
  }
  const invitation = await pendingInvitationForSignUp(email, context);
  if (invitation === null) {
    return;
  }
  if (invitation.roleId !== '') {
    await pool.query(
      'INSERT INTO "app_user_role" ("userId", "roleId") VALUES ($1, $2) ON CONFLICT ("userId", "roleId") DO NOTHING',
      [userId, invitation.roleId]
    );
  }
  await pool.query('DELETE FROM "app_invitation" WHERE id = $1', [invitation.id]);
}

export async function sendInvitationEmail(email: string, url: string): Promise<void> {
  if (!emailDeliveryConfigured()) {
    logUndeliveredLink('Invitation link', email, url);
    return;
  }
  await sendActionEmail(email, AUTH_EMAILS.invitation, url);
}

function notificationAttachments(email: NotificationEmail): EmailAttachment[] {
  if (email.attachmentName === '') {
    return [];
  }
  return [
    {
      filename: email.attachmentName,
      content: email.attachmentBody,
      contentType: 'text/calendar; method=PUBLISH; charset=utf-8',
    },
  ];
}

export async function sendNotificationEmail(email: NotificationEmail): Promise<void> {
  if (!emailDeliveryConfigured()) {
    throw new Error('Email delivery is not configured');
  }
  await sendEmail({
    to: email.recipient,
    subject: email.subject,
    text: email.body,
    html: renderEmailHtml(email.body, email.html),
    inReplyTo: email.inReplyTo === '' ? null : email.inReplyTo,
    attachments: notificationAttachments(email),
  });
}

const accessControl = createAccessControl({
  resource: ['create', 'read', 'update', 'delete'],
} as const);

const playerRole = accessControl.newRole({ resource: ['read'] });
const scorekeeperRole = accessControl.newRole({ resource: ['read'] });

const socialProviders: Record<string, unknown> = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders['google'] = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders['apple'] = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  };
}
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  socialProviders['microsoft'] = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  };
}

export function configuredSocialProviders(): string[] {
  return Object.keys(socialProviders);
}

function corsOrigins(): string[] {
  const origin = process.env.CORS_ORIGIN ?? '';
  return origin === '' ? [] : [origin];
}

const PUBLIC_ADDRESS = publicAddress();
const BACKEND_ADDRESS = backendAddress();

export function authPlugins(): BetterAuthPlugin[] {
  return [
    admin({ ac: accessControl, roles: { player: playerRole, scorekeeper: scorekeeperRole } }),
    twoFactor({ issuer: APP_NAME }),
    passkey({ rpID: PUBLIC_ADDRESS.hostname, rpName: APP_NAME, origin: PUBLIC_ADDRESS.origin }),
  ];
}

export function buildAuthOptions(requireEmailVerification: boolean): BetterAuthOptions {
  return {
    appName: APP_NAME,
    baseURL: BACKEND_ADDRESS.origin,
    database: pool,
    trustedOrigins: corsOrigins(),
    advanced: {
      cookiePrefix: COOKIE_PREFIX,
    },
    rateLimit: {
      enabled: false,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }): Promise<void> => {
        if (!(await userHasCredentialAccount(user.id))) {
          return;
        }
        await sendPasswordResetEmail(user.email, url);
      },
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      sendOnSignIn: requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }): Promise<void> => {
        if (user.emailVerified) {
          return;
        }
        await sendVerificationEmail(user.email, buildVerifyLink(url, token));
      },
    },
    socialProviders,
    databaseHooks: {
      user: {
        create: {
          before: async (
            user: { email: string },
            context: unknown
          ): Promise<{ data: { email: string; emailVerified: boolean } } | undefined> => {
            const invitation = await pendingInvitationForSignUp(user.email, context);
            if (invitation !== null) {
              return { data: { ...user, emailVerified: true } };
            }
            if (isCredentialSignUp(context) && (await findPendingInvitation(user.email)) !== null) {
              throw new APIError('UNPROCESSABLE_ENTITY', {
                message: 'User already exists. Use another email.',
                code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
              });
            }
            if (await getInviteOnly()) {
              throw new APIError('FORBIDDEN', {
                message: 'Sign-up is by invitation only',
                code: 'SIGNUP_INVITATION_REQUIRED',
              });
            }
            return undefined;
          },
        },
      },
      account: {
        create: {
          after: async (account: { userId: string }, context: unknown): Promise<void> => {
            await consumeInvitation(account.userId, context);
          },
        },
      },
    },
    plugins: authPlugins(),
  };
}

export const auth = betterAuth(buildAuthOptions(false));

const authHandlers = new Map<string, (request: Request, response: Response) => Promise<void>>();

function authHandlerFor(
  requireEmailVerification: boolean
): (request: Request, response: Response) => Promise<void> {
  const key = String(requireEmailVerification);
  let handler = authHandlers.get(key);
  if (handler === undefined) {
    handler = toNodeHandler(requireEmailVerification ? betterAuth(buildAuthOptions(true)) : auth);
    authHandlers.set(key, handler);
  }
  return handler;
}

export async function authRequestHandler(request: Request, response: Response): Promise<void> {
  const requireEmailVerification = await getRequireEmailVerification();
  await authHandlerFor(requireEmailVerification)(request, response);
}
