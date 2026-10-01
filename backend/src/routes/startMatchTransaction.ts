import { Router } from 'express';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';
import { pool } from '../db.js';
import { withTransaction, isRetriableTransactionError } from '../transaction.js';
import {
  getEffectiveUserRoles,
  isAdmin,
  hasAnyRole,
  refuseCall,
  type Caller,
  type CallPermission,
  type RecordParameter,
} from '../authorization.js';
import { recordRuntimeError } from '../utils/diagnostics.js';
import { PreconditionError } from '../utils/precondition.js';
import { errorRefusal } from '../error-refusals.js';
import { ConstraintViolationError } from '../constraints.js';
import { transactionContext } from '../transaction-context.js';
import { performStartMatch } from '../transactions/startMatch.js';

export const startMatchTransactionRouter = Router();

const ALLOWED_ROLES: string[] = ['player', 'scorekeeper'];
const CALL_PERMISSIONS: CallPermission[] = [
  { role: 'player', target: 'matches', scope: 'own' },
  { role: 'scorekeeper', target: 'matches', scope: 'all' },
];
const RECORD_PARAMETERS: RecordParameter[] = [{ name: 'match', path: 'matches', table: 'Match' }];

function isStartMatchParameters(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const body = value as Record<string, unknown>;
  if (!(typeof body['match'] === 'string' && body['match'] !== '')) {
    return false;
  }
  return true;
}

startMatchTransactionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTHENTICATION_REQUIRED' });
      return;
    }
    const caller: Caller = {
      userId: session.user.id,
      roles: await getEffectiveUserRoles(pool, session.user.id),
    };
    if (!isAdmin(caller.roles) && !hasAnyRole(caller.roles, ALLOWED_ROLES)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!isStartMatchParameters(req.body)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }
    const callRefusal = await refuseCall(
      pool,
      caller,
      CALL_PERMISSIONS,
      RECORD_PARAMETERS,
      req.body as Record<string, unknown>
    );
    if (callRefusal !== null) {
      res.status(403).json({ error: callRefusal });
      return;
    }
    try {
      await withTransaction(pool, (client) =>
        performStartMatch(transactionContext(client, caller.userId), req.body as { match: string })
      );
      res.json({ success: true });
    } catch (error) {
      recordRuntimeError('startMatch', error);
      const refusal = errorRefusal(error);
      if (error instanceof PreconditionError || error instanceof ConstraintViolationError) {
        res
          .status(422)
          .json({ error: error.message, code: 'PRECONDITION_FAILED', refusal: error.refusal });
      } else if (refusal !== null) {
        res.status(refusal.status).json(refusal.body);
      } else if (isRetriableTransactionError(error)) {
        res.status(409).json({ error: 'Concurrent update conflict' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  } catch (error) {
    recordRuntimeError('startMatch', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
