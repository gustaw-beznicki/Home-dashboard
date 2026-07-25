-- Better Auth's own tables (ADR 0009). Generated, not hand-written:
--   npx auth@latest generate --config ./scripts/auth-schema.mjs \
--     --output migrations/0003_better_auth_tables.sql -y
--
-- Identity lives here; authorization still lives in `users` (role + status),
-- joined on email. `users` is deliberately untouched by this migration, so it
-- is additive and safe to apply before the new Worker deploys (ADR 0007) —
-- the currently-live Worker reads none of these tables.
--
-- Two things to know before editing by hand:
--   * columns are camelCase (Better Auth's Kysely adapter defaults to
--     casing: "camel"), unlike `users`/`tasks`/`completions` above;
--   * `date` columns hold ISO-8601 TEXT and booleans hold integer 0/1, so
--     don't add CHECK constraints here — the adapter only ever binds strings
--     and numbers, never Date objects.
--
-- `role` on "user" is the admin plugin's, used only so its endpoints can
-- authorize themselves. `users.role` remains the real gate; worker/auth.js
-- keeps the two in step.
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "role" text, "banned" integer, "banReason" text, "banExpires" date);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "impersonatedBy" text);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create table "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");