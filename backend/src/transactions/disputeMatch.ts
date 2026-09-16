import type { TransactionContext } from '../transaction-context.js';
import { PreconditionError } from '../utils/precondition.js';

export async function performDisputeMatch(
  context: TransactionContext,
  requestBody: { match: string }
): Promise<void> {
  const { client } = context;
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
  if (match.status !== 'completed') {
    throw new PreconditionError({
      kind: 'stated',
      message: 'Only completed matches can be disputed',
    });
  }
  Object.assign(match, { status: 'disputed' });
  await client.query('UPDATE "Match" SET "status" = $1 WHERE id = $2', [match.status, match.id]);
}
