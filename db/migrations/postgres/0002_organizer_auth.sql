BEGIN;

CREATE TABLE organizer_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TIMESTAMPTZ,
  CHECK (length(email) > 0),
  CHECK (email = lower(btrim(email)))
);

CREATE TABLE organizer_sessions (
  token_hash TEXT PRIMARY KEY,
  organizer_user_id TEXT NOT NULL REFERENCES organizer_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CHECK (expires_at > created_at)
);

CREATE INDEX organizer_sessions_user_idx
  ON organizer_sessions(organizer_user_id);

CREATE INDEX organizer_sessions_expires_idx
  ON organizer_sessions(expires_at);

COMMIT;
