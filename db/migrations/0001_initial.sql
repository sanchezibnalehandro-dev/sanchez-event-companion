PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  program_state TEXT NOT NULL CHECK (program_state IN ('draft', 'published', 'unpublished')),
  published_at TEXT,
  CHECK (ends_at > starts_at),
  CHECK (program_state <> 'published' OR published_at IS NOT NULL)
) STRICT;

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (id, event_id)
) STRICT;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  summary TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  location_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (ends_at > starts_at),
  UNIQUE (event_id, slug),
  UNIQUE (id, event_id),
  FOREIGN KEY (location_id, event_id) REFERENCES locations(id, event_id)
    ON DELETE RESTRICT
) STRICT;

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  role TEXT,
  company TEXT,
  bio TEXT,
  photo_url TEXT,
  UNIQUE (id, event_id)
) STRICT;

CREATE TABLE IF NOT EXISTS session_speakers (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  session_role TEXT,
  PRIMARY KEY (session_id, speaker_id)
) STRICT;

CREATE TRIGGER IF NOT EXISTS session_speakers_same_event_insert
BEFORE INSERT ON session_speakers
WHEN NOT EXISTS (
  SELECT 1
  FROM sessions AS session
  JOIN speakers AS speaker ON speaker.event_id = session.event_id
  WHERE session.id = NEW.session_id AND speaker.id = NEW.speaker_id
)
BEGIN
  SELECT RAISE(ABORT, 'session and speaker must belong to the same event');
END;

CREATE TABLE IF NOT EXISTS event_runtime (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  manual_current_session_id TEXT,
  override_set_at TEXT,
  override_set_by TEXT,
  FOREIGN KEY (manual_current_session_id, event_id) REFERENCES sessions(id, event_id)
    ON DELETE RESTRICT,
  CHECK (
    (manual_current_session_id IS NULL AND override_set_at IS NULL AND override_set_by IS NULL)
    OR manual_current_session_id IS NOT NULL
  )
) STRICT;

CREATE TABLE IF NOT EXISTS live_integrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (length(trim(provider)) > 0),
  external_event_key TEXT NOT NULL CHECK (length(trim(external_event_key)) > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  UNIQUE (event_id, provider),
  UNIQUE (id, event_id)
) STRICT;

CREATE TABLE IF NOT EXISTS live_session_mappings (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL REFERENCES live_integrations(id) ON DELETE CASCADE,
  external_room_slug TEXT NOT NULL CHECK (length(trim(external_room_slug)) > 0),
  PRIMARY KEY (session_id, integration_id)
) STRICT;

CREATE TRIGGER IF NOT EXISTS live_session_mappings_same_event_insert
BEFORE INSERT ON live_session_mappings
WHEN NOT EXISTS (
  SELECT 1
  FROM sessions AS session
  JOIN live_integrations AS integration ON integration.event_id = session.event_id
  WHERE session.id = NEW.session_id AND integration.id = NEW.integration_id
)
BEGIN
  SELECT RAISE(ABORT, 'session and LIVE integration must belong to the same event');
END;

CREATE INDEX IF NOT EXISTS sessions_event_schedule_idx
  ON sessions(event_id, starts_at, ends_at, sort_order);

CREATE INDEX IF NOT EXISTS session_speakers_order_idx
  ON session_speakers(session_id, sort_order);
