import { userKey } from '../utils/collections.js';
import type { TransactionContext } from '../transaction-context.js';
import { PreconditionError } from '../utils/precondition.js';
import { computeEloDelta } from '../functions.js';
import { filledValue, insertRecord, updateRecord } from '../constraints.js';

export async function performCompleteMatch(
  context: TransactionContext,
  requestBody: { match: string; outcome: string }
): Promise<void> {
  const { client, callerId } = context;
  const __budget = context.budget;
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
  const { outcome } = requestBody;
  if (!(match.status === 'scheduled' || match.status === 'inProgress')) {
    throw new PreconditionError({
      kind: 'stated',
      message: { en: 'Match must be scheduled or in progress to complete' },
    });
  }
  const reference0Row = await client.query('SELECT * FROM "GameType" WHERE id = $1', [
    match.gameId,
  ]);
  if (reference0Row.rows.length === 0) {
    throw new PreconditionError({ kind: 'precondition' });
  }
  const reference0 = reference0Row.rows[0] as {
    id: string;
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
    displayName: string;
    leaderboard: string[];
  };
  let p1Rating = reference0.defaultRating;
  const reference1Row = await client.query('SELECT * FROM "GameType" WHERE id = $1', [
    match.gameId,
  ]);
  if (reference1Row.rows.length === 0) {
    throw new PreconditionError({ kind: 'precondition' });
  }
  const reference1 = reference1Row.rows[0] as {
    id: string;
    name: string;
    category: string;
    rulesVariant: string;
    defaultRating: number;
    description: string;
    displayName: string;
    leaderboard: string[];
  };
  let p2Rating = reference1.defaultRating;
  let p1Found = false;
  let p2Found = false;
  const entryRows2 = (
    await client.query<Record<string, unknown>>('SELECT * FROM "LeaderboardEntry"')
  ).rows as Array<{
    id: string;
    playerId: string;
    gameId: string;
    rating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    lastPlayedAt: string;
    playerNickname: string;
  }>;
  for (const entry of entryRows2) {
    __budget();
    if (entry.gameId === match.gameId && entry.playerId === match.playerOneId) {
      p1Rating = entry.rating;
      p1Found = true;
    }
    if (entry.gameId === match.gameId && entry.playerId === match.playerTwoId) {
      p2Rating = entry.rating;
      p2Found = true;
    }
  }
  const delta1_ = computeEloDelta(client, __budget, p1Rating, p2Rating, outcome);
  const delta2_ = 0 - delta1_;
  if (p1Found) {
    const entryRows3 = (
      await client.query<Record<string, unknown>>('SELECT * FROM "LeaderboardEntry"')
    ).rows as Array<{
      id: string;
      playerId: string;
      gameId: string;
      rating: number;
      matchesPlayed: number;
      wins: number;
      losses: number;
      draws: number;
      lastPlayedAt: string;
      playerNickname: string;
    }>;
    for (const entry of entryRows3) {
      __budget();
      if (entry.gameId === match.gameId && entry.playerId === match.playerOneId) {
        Object.assign(entry, { rating: entry.rating + delta1_ });
        await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
          rating: entry.rating,
        });
        Object.assign(entry, { matchesPlayed: entry.matchesPlayed + 1 });
        await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
          matchesPlayed: entry.matchesPlayed,
        });
        if (outcome === 'playerOneWin') {
          Object.assign(entry, { wins: entry.wins + 1 });
          await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, { wins: entry.wins });
        } else {
          if (outcome === 'playerTwoWin') {
            Object.assign(entry, { losses: entry.losses + 1 });
            await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
              losses: entry.losses,
            });
          } else {
            Object.assign(entry, { draws: entry.draws + 1 });
            await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
              draws: entry.draws,
            });
          }
        }
        Object.assign(entry, { lastPlayedAt: new Date().toISOString() });
        await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
          lastPlayedAt: entry.lastPlayedAt,
        });
      }
    }
  } else {
    const reference4Row = await client.query('SELECT * FROM "GameType" WHERE id = $1', [
      match.gameId,
    ]);
    if (reference4Row.rows.length === 0) {
      throw new PreconditionError({ kind: 'precondition' });
    }
    const reference4 = reference4Row.rows[0] as {
      id: string;
      name: string;
      category: string;
      rulesVariant: string;
      defaultRating: number;
      description: string;
      displayName: string;
      leaderboard: string[];
    };
    const addedId5 = crypto.randomUUID();
    await insertRecord(client, callerId, 'LeaderboardEntry', {
      id: addedId5,
      playerId: match.playerOneId,
      gameId: match.gameId,
      rating: filledValue(reference4.defaultRating + delta1_, 1200),
      matchesPlayed: filledValue(1, 0),
      wins: filledValue(outcome === 'playerOneWin' ? 1 : 0, 0),
      losses: filledValue(outcome === 'playerTwoWin' ? 1 : 0, 0),
      draws: filledValue(outcome === 'draw' ? 1 : 0, 0),
      lastPlayedAt: filledValue(new Date().toISOString(), new Date().toISOString()),
    });
    await client.query(
      'INSERT INTO "creator_leaderboards" ("leaderboardEntryId", "userId") VALUES ($1, $2)',
      [addedId5, userKey(callerId)]
    );
  }
  if (p2Found) {
    const entryRows6 = (
      await client.query<Record<string, unknown>>('SELECT * FROM "LeaderboardEntry"')
    ).rows as Array<{
      id: string;
      playerId: string;
      gameId: string;
      rating: number;
      matchesPlayed: number;
      wins: number;
      losses: number;
      draws: number;
      lastPlayedAt: string;
      playerNickname: string;
    }>;
    for (const entry of entryRows6) {
      __budget();
      if (entry.gameId === match.gameId && entry.playerId === match.playerTwoId) {
        Object.assign(entry, { rating: entry.rating + delta2_ });
        await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
          rating: entry.rating,
        });
        Object.assign(entry, { matchesPlayed: entry.matchesPlayed + 1 });
        await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
          matchesPlayed: entry.matchesPlayed,
        });
        if (outcome === 'playerTwoWin') {
          Object.assign(entry, { wins: entry.wins + 1 });
          await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, { wins: entry.wins });
        } else {
          if (outcome === 'playerOneWin') {
            Object.assign(entry, { losses: entry.losses + 1 });
            await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
              losses: entry.losses,
            });
          } else {
            Object.assign(entry, { draws: entry.draws + 1 });
            await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
              draws: entry.draws,
            });
          }
        }
        Object.assign(entry, { lastPlayedAt: new Date().toISOString() });
        await updateRecord(client, callerId, 'LeaderboardEntry', entry.id, {
          lastPlayedAt: entry.lastPlayedAt,
        });
      }
    }
  } else {
    const reference7Row = await client.query('SELECT * FROM "GameType" WHERE id = $1', [
      match.gameId,
    ]);
    if (reference7Row.rows.length === 0) {
      throw new PreconditionError({ kind: 'precondition' });
    }
    const reference7 = reference7Row.rows[0] as {
      id: string;
      name: string;
      category: string;
      rulesVariant: string;
      defaultRating: number;
      description: string;
      displayName: string;
      leaderboard: string[];
    };
    const addedId8 = crypto.randomUUID();
    await insertRecord(client, callerId, 'LeaderboardEntry', {
      id: addedId8,
      playerId: match.playerTwoId,
      gameId: match.gameId,
      rating: filledValue(reference7.defaultRating + delta2_, 1200),
      matchesPlayed: filledValue(1, 0),
      wins: filledValue(outcome === 'playerTwoWin' ? 1 : 0, 0),
      losses: filledValue(outcome === 'playerOneWin' ? 1 : 0, 0),
      draws: filledValue(outcome === 'draw' ? 1 : 0, 0),
      lastPlayedAt: filledValue(new Date().toISOString(), new Date().toISOString()),
    });
    await client.query(
      'INSERT INTO "creator_leaderboards" ("leaderboardEntryId", "userId") VALUES ($1, $2)',
      [addedId8, userKey(callerId)]
    );
  }
  Object.assign(match, { status: 'completed' });
  await updateRecord(client, callerId, 'Match', match.id, { status: match.status });
  Object.assign(match, { outcome });
  await updateRecord(client, callerId, 'Match', match.id, { outcome: match.outcome });
  if (outcome === 'playerOneWin') {
    Object.assign(match, { playerOneScore: 1 });
    await updateRecord(client, callerId, 'Match', match.id, {
      playerOneScore: match.playerOneScore,
    });
    Object.assign(match, { playerTwoScore: -1 });
    await updateRecord(client, callerId, 'Match', match.id, {
      playerTwoScore: match.playerTwoScore,
    });
  } else {
    if (outcome === 'playerTwoWin') {
      Object.assign(match, { playerOneScore: -1 });
      await updateRecord(client, callerId, 'Match', match.id, {
        playerOneScore: match.playerOneScore,
      });
      Object.assign(match, { playerTwoScore: 1 });
      await updateRecord(client, callerId, 'Match', match.id, {
        playerTwoScore: match.playerTwoScore,
      });
    } else {
      Object.assign(match, { playerOneScore: 0.5 });
      await updateRecord(client, callerId, 'Match', match.id, {
        playerOneScore: match.playerOneScore,
      });
      Object.assign(match, { playerTwoScore: 0.5 });
      await updateRecord(client, callerId, 'Match', match.id, {
        playerTwoScore: match.playerTwoScore,
      });
    }
  }
  Object.assign(match, { playerOneRatingDelta: delta1_ });
  await updateRecord(client, callerId, 'Match', match.id, {
    playerOneRatingDelta: match.playerOneRatingDelta,
  });
  Object.assign(match, { playerTwoRatingDelta: delta2_ });
  await updateRecord(client, callerId, 'Match', match.id, {
    playerTwoRatingDelta: match.playerTwoRatingDelta,
  });
}
