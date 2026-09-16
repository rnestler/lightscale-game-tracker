import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { pool } from '../db.js';
import { auth } from '../auth.js';
import { getEffectiveUserRoles, type Caller } from '../authorization.js';
import { canDownloadFile } from '../file-access.js';
import { downloadContentType } from '../files.js';

export const filesRouter = Router();

function sanitizeHeaderFileName(fileName: string): string {
  return fileName.replace(/[\r\n"\\]/g, '_');
}

filesRouter.get('/:id/download', async (request, response) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  const caller: Caller = session
    ? { userId: session.user.id, roles: await getEffectiveUserRoles(pool, session.user.id) }
    : { userId: null, roles: ['guest'] };
  const allowed = await canDownloadFile(request.params.id, caller);
  if (!allowed && !session) {
    response
      .status(401)
      .json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
    return;
  }
  if (!allowed) {
    response.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { rows } = await pool.query<{ fileName: string; data: string }>(
    'SELECT "fileName", "data" FROM "$FILES" WHERE "id" = $1',
    [request.params.id]
  );
  const row = rows.at(0);
  if (row === undefined) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  response.setHeader('Content-Type', downloadContentType(row.fileName));
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${sanitizeHeaderFileName(row.fileName)}"`
  );
  response.send(Buffer.from(row.data, 'base64'));
});
