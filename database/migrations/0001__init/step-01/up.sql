CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "role" TEXT,
  "banned" BOOLEAN,
  "banReason" TEXT,
  "banExpires" TIMESTAMPTZ,
  "twoFactorEnabled" BOOLEAN
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  "impersonatedBy" TEXT
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  "verified" BOOLEAN,
  "failedVerificationCount" INTEGER,
  "lockedUntil" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx" ON "twoFactor"("secret");
CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON "twoFactor"("userId");

CREATE TABLE IF NOT EXISTS "passkey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  "credentialID" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL,
  "transports" TEXT,
  "createdAt" TIMESTAMPTZ,
  "aaguid" TEXT
);
CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey"("userId");
CREATE INDEX IF NOT EXISTS "passkey_credentialID_idx" ON "passkey"("credentialID");

CREATE TABLE "GameType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '' CHECK ("category" IN ('', 'chess', 'billiards', 'tableTennis', 'darts', 'boardGames', 'cardGames', 'custom')),
  "rulesVariant" TEXT NOT NULL DEFAULT '',
  "defaultRating" BIGINT NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE "Player" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nickname" TEXT NOT NULL DEFAULT '',
  "fullName" TEXT NOT NULL DEFAULT '',
  "emailAddress" TEXT NOT NULL DEFAULT '',
  "avatar" TEXT NOT NULL DEFAULT '',
  "bio" TEXT NOT NULL DEFAULT '',
  "joinedDate" DATE,
  "userAccountId" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE "LeaderboardEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerId" TEXT NOT NULL DEFAULT '',
  "gameId" TEXT NOT NULL DEFAULT '',
  "rating" BIGINT NOT NULL DEFAULT 0,
  "matchesPlayed" BIGINT NOT NULL DEFAULT 0,
  "wins" BIGINT NOT NULL DEFAULT 0,
  "losses" BIGINT NOT NULL DEFAULT 0,
  "draws" BIGINT NOT NULL DEFAULT 0,
  "lastPlayedAt" TIMESTAMP WITH TIME ZONE
);

CREATE TABLE "Match" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "gameId" TEXT NOT NULL DEFAULT '',
  "playerOneId" TEXT NOT NULL DEFAULT '',
  "playerTwoId" TEXT NOT NULL DEFAULT '',
  "scheduledAt" TIMESTAMP WITH TIME ZONE,
  "status" TEXT NOT NULL DEFAULT '' CHECK ("status" IN ('', 'scheduled', 'inProgress', 'completed', 'disputed', 'cancelled')),
  "outcome" TEXT NOT NULL DEFAULT '' CHECK ("outcome" IN ('', 'playerOneWin', 'playerTwoWin', 'draw')),
  "playerOneScore" NUMERIC NOT NULL DEFAULT 0,
  "playerTwoScore" NUMERIC NOT NULL DEFAULT 0,
  "playerOneRatingDelta" BIGINT NOT NULL DEFAULT 0,
  "playerTwoRatingDelta" BIGINT NOT NULL DEFAULT 0,
  "notes" TEXT NOT NULL DEFAULT '',
  "recordedById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ux_Player_nickname" ON "Player" ("nickname") WHERE "nickname" <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "ux_Player_emailAddress" ON "Player" ("emailAddress") WHERE "emailAddress" <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "ux_LeaderboardEntry_playerId_gameId" ON "LeaderboardEntry" ("playerId", "gameId") WHERE "playerId" <> '' AND "gameId" <> '';

ALTER TABLE "LeaderboardEntry" ADD COLUMN "playerId$reference" TEXT GENERATED ALWAYS AS (NULLIF("playerId", '')) STORED;
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "fk_LeaderboardEntry_playerId" FOREIGN KEY ("playerId$reference") REFERENCES "Player" ("id") DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "ix_LeaderboardEntry_playerId" ON "LeaderboardEntry" ("playerId$reference");
ALTER TABLE "LeaderboardEntry" ADD COLUMN "gameId$reference" TEXT GENERATED ALWAYS AS (NULLIF("gameId", '')) STORED;
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "fk_LeaderboardEntry_gameId" FOREIGN KEY ("gameId$reference") REFERENCES "GameType" ("id") DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "ix_LeaderboardEntry_gameId" ON "LeaderboardEntry" ("gameId$reference");
ALTER TABLE "Match" ADD COLUMN "gameId$reference" TEXT GENERATED ALWAYS AS (NULLIF("gameId", '')) STORED;
ALTER TABLE "Match" ADD CONSTRAINT "fk_Match_gameId" FOREIGN KEY ("gameId$reference") REFERENCES "GameType" ("id") DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "ix_Match_gameId" ON "Match" ("gameId$reference");
ALTER TABLE "Match" ADD COLUMN "playerOneId$reference" TEXT GENERATED ALWAYS AS (NULLIF("playerOneId", '')) STORED;
ALTER TABLE "Match" ADD CONSTRAINT "fk_Match_playerOneId" FOREIGN KEY ("playerOneId$reference") REFERENCES "Player" ("id") DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "ix_Match_playerOneId" ON "Match" ("playerOneId$reference");
ALTER TABLE "Match" ADD COLUMN "playerTwoId$reference" TEXT GENERATED ALWAYS AS (NULLIF("playerTwoId", '')) STORED;
ALTER TABLE "Match" ADD CONSTRAINT "fk_Match_playerTwoId" FOREIGN KEY ("playerTwoId$reference") REFERENCES "Player" ("id") DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "ix_Match_playerTwoId" ON "Match" ("playerTwoId$reference");

CREATE TABLE IF NOT EXISTS "$FILES" (
  "id" TEXT PRIMARY KEY,
  "mimeType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "data" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "_outbox" (
  "id" TEXT PRIMARY KEY,
  "notification" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "html" TEXT NOT NULL DEFAULT '',
  "inReplyTo" TEXT NOT NULL DEFAULT '',
  "attachmentName" TEXT NOT NULL DEFAULT '',
  "attachmentBody" TEXT NOT NULL DEFAULT '',
  "createdAt" TEXT NOT NULL,
  "sentAt" TEXT NOT NULL DEFAULT '',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "creator_games" (
  "userId" TEXT NOT NULL,
  "gameTypeId" TEXT PRIMARY KEY REFERENCES "GameType"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "creator_games_user_idx" ON "creator_games"("userId");

CREATE TABLE IF NOT EXISTS "creator_players" (
  "userId" TEXT NOT NULL,
  "playerId" TEXT PRIMARY KEY REFERENCES "Player"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "creator_players_user_idx" ON "creator_players"("userId");

CREATE TABLE IF NOT EXISTS "creator_matches" (
  "userId" TEXT NOT NULL,
  "matchId" TEXT PRIMARY KEY REFERENCES "Match"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "creator_matches_user_idx" ON "creator_matches"("userId");

CREATE TABLE IF NOT EXISTS "creator_leaderboards" (
  "userId" TEXT NOT NULL,
  "leaderboardEntryId" TEXT PRIMARY KEY REFERENCES "LeaderboardEntry"("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "creator_leaderboards_user_idx" ON "creator_leaderboards"("userId");

CREATE TABLE IF NOT EXISTS "app_role" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "isPredefined" BOOLEAN NOT NULL
);
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('admin', 'admin', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('unassigned', 'unassigned', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('guest', 'guest', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('player', 'player', false) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('scorekeeper', 'scorekeeper', false) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "app_user_role" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL REFERENCES "app_role"("id") DEFERRABLE INITIALLY IMMEDIATE,
  PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE IF NOT EXISTS "app_config" (
  "id" TEXT PRIMARY KEY,
  "requireEmailVerification" BOOLEAN NOT NULL DEFAULT TRUE,
  "allowAccountDeletion" BOOLEAN NOT NULL DEFAULT TRUE,
  "inviteOnly" BOOLEAN NOT NULL DEFAULT FALSE,
  "showStaleData" BOOLEAN NOT NULL DEFAULT FALSE,
  "aiConsentRequired" BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO "app_config" ("id", "requireEmailVerification", "allowAccountDeletion", "inviteOnly", "showStaleData", "aiConsentRequired") VALUES ('singleton', TRUE, TRUE, FALSE, FALSE, TRUE) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "app_invitation" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "roleId" TEXT NOT NULL DEFAULT '',
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "invitedBy" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "app_privacy_inquiry" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL DEFAULT 'access',
  "attributes" TEXT NOT NULL DEFAULT '{}',
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "verifyToken" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedAt" TEXT NOT NULL DEFAULT '',
  "resolution" TEXT NOT NULL DEFAULT '',
  "resolvedAt" TEXT NOT NULL DEFAULT ''
);


