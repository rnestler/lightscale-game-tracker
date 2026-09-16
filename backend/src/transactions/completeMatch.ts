import type { TransactionContext } from '../transaction-context.js';
import { PreconditionError } from '../utils/precondition.js';
import { computeEloDelta } from '../functions.js';

export async function performCompleteMatch(
  context: TransactionContext,
  requestBody: { match: string; outcome: string }
): Promise<void> {
  const { client } = context;
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
      message: 'Match must be scheduled or in progress to complete',
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
  const entryRows0 = (await client.query('SELECT * FROM "LeaderboardEntry"')).rows as Array<{
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
  for (const entry of entryRows0) {
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
    const entryRows1 = (await client.query('SELECT * FROM "LeaderboardEntry"')).rows as Array<{
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
    for (const entry of entryRows1) {
      __budget();
      if (entry.gameId === match.gameId && entry.playerId === match.playerOneId) {
        Object.assign(entry, { rating: entry.rating + delta1_ });
        await client.query('UPDATE "LeaderboardEntry" SET "rating" = $1 WHERE id = $2', [
          entry.rating,
          entry.id,
        ]);
        Object.assign(entry, { matchesPlayed: entry.matchesPlayed + 1 });
        await client.query('UPDATE "LeaderboardEntry" SET "matchesPlayed" = $1 WHERE id = $2', [
          entry.matchesPlayed,
          entry.id,
        ]);
        if (outcome === 'playerOneWin') {
          Object.assign(entry, { wins: entry.wins + 1 });
          await client.query('UPDATE "LeaderboardEntry" SET "wins" = $1 WHERE id = $2', [
            entry.wins,
            entry.id,
          ]);
        } else {
          if (outcome === 'playerTwoWin') {
            Object.assign(entry, { losses: entry.losses + 1 });
            await client.query('UPDATE "LeaderboardEntry" SET "losses" = $1 WHERE id = $2', [
              entry.losses,
              entry.id,
            ]);
          } else {
            Object.assign(entry, { draws: entry.draws + 1 });
            await client.query('UPDATE "LeaderboardEntry" SET "draws" = $1 WHERE id = $2', [
              entry.draws,
              entry.id,
            ]);
          }
        }
        Object.assign(entry, { lastPlayedAt: new Date().toISOString() });
        await client.query('UPDATE "LeaderboardEntry" SET "lastPlayedAt" = $1 WHERE id = $2', [
          entry.lastPlayedAt,
          entry.id,
        ]);
      }
    }
  } else {
    const reference2Row = await client.query('SELECT * FROM "GameType" WHERE id = $1', [
      match.gameId,
    ]);
    if (reference2Row.rows.length === 0) {
      throw new PreconditionError({ kind: 'precondition' });
    }
    const reference2 = reference2Row.rows[0] as {
      id: string;
      name: string;
      category: string;
      rulesVariant: string;
      defaultRating: number;
      description: string;
      displayName: string;
      leaderboard: string[];
    };
    await client.query(
      'INSERT INTO "LeaderboardEntry" ("id", "playerId", "gameId", "rating", "matchesPlayed", "wins", "losses", "draws", "lastPlayedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        crypto.randomUUID(),
        match.playerOneId,
        match.gameId,
        reference2.defaultRating + delta1_,
        1,
        outcome === 'playerOneWin' ? 1 : 0,
        outcome === 'playerTwoWin' ? 1 : 0,
        outcome === 'draw' ? 1 : 0,
        new Date().toISOString(),
      ]
    );
  }
  if (p2Found) {
    const entryRows2 = (await client.query('SELECT * FROM "LeaderboardEntry"')).rows as Array<{
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
      if (entry.gameId === match.gameId && entry.playerId === match.playerTwoId) {
        Object.assign(entry, { rating: entry.rating + delta2_ });
        await client.query('UPDATE "LeaderboardEntry" SET "rating" = $1 WHERE id = $2', [
          entry.rating,
          entry.id,
        ]);
        Object.assign(entry, { matchesPlayed: entry.matchesPlayed + 1 });
        await client.query('UPDATE "LeaderboardEntry" SET "matchesPlayed" = $1 WHERE id = $2', [
          entry.matchesPlayed,
          entry.id,
        ]);
        if (outcome === 'playerTwoWin') {
          Object.assign(entry, { wins: entry.wins + 1 });
          await client.query('UPDATE "LeaderboardEntry" SET "wins" = $1 WHERE id = $2', [
            entry.wins,
            entry.id,
          ]);
        } else {
          if (outcome === 'playerOneWin') {
            Object.assign(entry, { losses: entry.losses + 1 });
            await client.query('UPDATE "LeaderboardEntry" SET "losses" = $1 WHERE id = $2', [
              entry.losses,
              entry.id,
            ]);
          } else {
            Object.assign(entry, { draws: entry.draws + 1 });
            await client.query('UPDATE "LeaderboardEntry" SET "draws" = $1 WHERE id = $2', [
              entry.draws,
              entry.id,
            ]);
          }
        }
        Object.assign(entry, { lastPlayedAt: new Date().toISOString() });
        await client.query('UPDATE "LeaderboardEntry" SET "lastPlayedAt" = $1 WHERE id = $2', [
          entry.lastPlayedAt,
          entry.id,
        ]);
      }
    }
  } else {
    const reference3Row = await client.query('SELECT * FROM "GameType" WHERE id = $1', [
      match.gameId,
    ]);
    if (reference3Row.rows.length === 0) {
      throw new PreconditionError({ kind: 'precondition' });
    }
    const reference3 = reference3Row.rows[0] as {
      id: string;
      name: string;
      category: string;
      rulesVariant: string;
      defaultRating: number;
      description: string;
      displayName: string;
      leaderboard: string[];
    };
    await client.query(
      'INSERT INTO "LeaderboardEntry" ("id", "playerId", "gameId", "rating", "matchesPlayed", "wins", "losses", "draws", "lastPlayedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        crypto.randomUUID(),
        match.playerTwoId,
        match.gameId,
        reference3.defaultRating + delta2_,
        1,
        outcome === 'playerTwoWin' ? 1 : 0,
        outcome === 'playerOneWin' ? 1 : 0,
        outcome === 'draw' ? 1 : 0,
        new Date().toISOString(),
      ]
    );
  }
  Object.assign(match, { status: 'completed' });
  await client.query('UPDATE "Match" SET "status" = $1 WHERE id = $2', [match.status, match.id]);
  Object.assign(match, { outcome });
  await client.query('UPDATE "Match" SET "outcome" = $1 WHERE id = $2', [match.outcome, match.id]);
  if (outcome === 'playerOneWin') {
    Object.assign(match, { playerOneScore: 1 });
    await client.query('UPDATE "Match" SET "playerOneScore" = $1 WHERE id = $2', [
      match.playerOneScore,
      match.id,
    ]);
    Object.assign(match, { playerTwoScore: -1 });
    await client.query('UPDATE "Match" SET "playerTwoScore" = $1 WHERE id = $2', [
      match.playerTwoScore,
      match.id,
    ]);
  } else {
    if (outcome === 'playerTwoWin') {
      Object.assign(match, { playerOneScore: -1 });
      await client.query('UPDATE "Match" SET "playerOneScore" = $1 WHERE id = $2', [
        match.playerOneScore,
        match.id,
      ]);
      Object.assign(match, { playerTwoScore: 1 });
      await client.query('UPDATE "Match" SET "playerTwoScore" = $1 WHERE id = $2', [
        match.playerTwoScore,
        match.id,
      ]);
    } else {
      Object.assign(match, { playerOneScore: 0.5 });
      await client.query('UPDATE "Match" SET "playerOneScore" = $1 WHERE id = $2', [
        match.playerOneScore,
        match.id,
      ]);
      Object.assign(match, { playerTwoScore: 0.5 });
      await client.query('UPDATE "Match" SET "playerTwoScore" = $1 WHERE id = $2', [
        match.playerTwoScore,
        match.id,
      ]);
    }
  }
  Object.assign(match, { playerOneRatingDelta: delta1_ });
  await client.query('UPDATE "Match" SET "playerOneRatingDelta" = $1 WHERE id = $2', [
    match.playerOneRatingDelta,
    match.id,
  ]);
  Object.assign(match, { playerTwoRatingDelta: delta2_ });
  await client.query('UPDATE "Match" SET "playerTwoRatingDelta" = $1 WHERE id = $2', [
    match.playerTwoRatingDelta,
    match.id,
  ]);
}
