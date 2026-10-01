import type { TransactionContext } from '../transaction-context.js';
import { PreconditionError } from '../utils/precondition.js';
import { updateRecord } from '../constraints.js';

export async function performStartMatch(
  context: TransactionContext,
  requestBody: { match: string }
): Promise<void> {
  const { client, callerId } = context;
  const matchRow = await client.query('SELECT * FROM "Match" WHERE id = $1', [requestBody.match]);
  if (matchRow.rows.length === 0) {
    throw new PreconditionError({ kind: 'precondition' });
  }
  const match = matchRow.rows[0] as {
    id: string;
    gameId: string;
    playerOneId: string;
    playerTwoId: string;
    scheduledAt: string;
    status: string;
    outcome: string;
    playerOneScore: number;
    playerTwoScore: number;
    playerOneRatingDelta: number;
    playerTwoRatingDelta: number;
    notes: string;
    recordedById: string;
    createdAt: string;
    title: string;
    gameDisplayName: string;
  };
  if (match.status !== 'scheduled') {
    throw new PreconditionError({
      kind: 'stated',
      message: { en: 'Match must be scheduled to start' },
    });
  }
  Object.assign(match, { status: 'inProgress' });
  await updateRecord(client, callerId, 'Match', match.id, { status: match.status });
}
