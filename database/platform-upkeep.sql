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
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "impersonatedBy" TEXT
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "verified" BOOLEAN,
  "failedVerificationCount" INTEGER,
  "lockedUntil" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "passkey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "credentialID" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL,
  "transports" TEXT,
  "createdAt" TIMESTAMPTZ,
  "aaguid" TEXT
);

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN;

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");

CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx" ON "twoFactor"("secret");

CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON "twoFactor"("userId");

CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey"("userId");

CREATE INDEX IF NOT EXISTS "passkey_credentialID_idx" ON "passkey"("credentialID");

CREATE TABLE IF NOT EXISTS "$FILES" (
  "id" TEXT PRIMARY KEY,
  "mimeType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "data" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_matches" (
  "userId" TEXT NOT NULL,
  "matchId" TEXT PRIMARY KEY REFERENCES "Match"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "creator_matches_user_idx" ON "creator_matches"("userId");

CREATE TABLE IF NOT EXISTS "app_role" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "isPredefined" BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_user_role" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL REFERENCES "app_role"("id"),
  PRIMARY KEY ("userId", "roleId")
);

INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('admin', 'admin', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('unassigned', 'unassigned', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('guest', 'guest', true) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('player', 'player', false) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "app_role" ("id", "name", "isPredefined") VALUES ('scorekeeper', 'scorekeeper', false) ON CONFLICT ("id") DO NOTHING;

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


ALTER TABLE "GameType" ALTER COLUMN "name" SET DEFAULT '';
ALTER TABLE "GameType" ALTER COLUMN "category" SET DEFAULT '';
ALTER TABLE "GameType" ALTER COLUMN "rulesVariant" SET DEFAULT '';
ALTER TABLE "GameType" ALTER COLUMN "defaultRating" SET DEFAULT 0;
ALTER TABLE "GameType" ALTER COLUMN "description" SET DEFAULT '';
ALTER TABLE "Player" ALTER COLUMN "nickname" SET DEFAULT '';
ALTER TABLE "Player" ALTER COLUMN "fullName" SET DEFAULT '';
ALTER TABLE "Player" ALTER COLUMN "emailAddress" SET DEFAULT '';
ALTER TABLE "Player" ALTER COLUMN "avatar" SET DEFAULT '';
ALTER TABLE "Player" ALTER COLUMN "bio" SET DEFAULT '';
ALTER TABLE "Player" ALTER COLUMN "joinedDate" DROP NOT NULL;
ALTER TABLE "Player" ALTER COLUMN "userAccountId" SET DEFAULT '';
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "playerId" SET DEFAULT '';
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "gameId" SET DEFAULT '';
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "rating" SET DEFAULT 0;
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "matchesPlayed" SET DEFAULT 0;
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "wins" SET DEFAULT 0;
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "losses" SET DEFAULT 0;
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "draws" SET DEFAULT 0;
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "lastPlayedAt" DROP NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "gameId" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "playerOneId" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "playerTwoId" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "scheduledAt" DROP NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "status" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "outcome" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "playerOneScore" SET DEFAULT 0;
ALTER TABLE "Match" ALTER COLUMN "playerTwoScore" SET DEFAULT 0;
ALTER TABLE "Match" ALTER COLUMN "playerOneRatingDelta" SET DEFAULT 0;
ALTER TABLE "Match" ALTER COLUMN "playerTwoRatingDelta" SET DEFAULT 0;
ALTER TABLE "Match" ALTER COLUMN "notes" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "recordedById" SET DEFAULT '';
ALTER TABLE "Match" ALTER COLUMN "createdAt" DROP NOT NULL;

ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "requireEmailVerification" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "allowAccountDeletion" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "inviteOnly" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "showStaleData" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "app_config" ADD COLUMN IF NOT EXISTS "aiConsentRequired" BOOLEAN NOT NULL DEFAULT TRUE;
INSERT INTO "app_config" ("id", "requireEmailVerification", "allowAccountDeletion", "inviteOnly", "showStaleData", "aiConsentRequired") VALUES ('singleton', TRUE, TRUE, FALSE, FALSE, TRUE) ON CONFLICT ("id") DO NOTHING;

