BEGIN;

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  timezone TEXT NOT NULL CHECK (length(btrim(timezone)) > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  program_state TEXT NOT NULL CHECK (program_state IN ('draft', 'published', 'unpublished')),
  published_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at),
  CHECK (program_state <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (id, event_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  summary TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (ends_at > starts_at),
  UNIQUE (event_id, slug),
  UNIQUE (id, event_id),
  FOREIGN KEY (location_id, event_id) REFERENCES locations(id, event_id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  role TEXT,
  company TEXT,
  bio TEXT,
  photo_url TEXT,
  UNIQUE (id, event_id)
);

CREATE TABLE IF NOT EXISTS session_speakers (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  session_role TEXT,
  PRIMARY KEY (session_id, speaker_id)
);

CREATE OR REPLACE FUNCTION enforce_session_speaker_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sessions AS session
    JOIN speakers AS speaker ON speaker.event_id = session.event_id
    WHERE session.id = NEW.session_id AND speaker.id = NEW.speaker_id
  ) THEN
    RAISE EXCEPTION 'session and speaker must belong to the same event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_speakers_same_event ON session_speakers;
CREATE TRIGGER session_speakers_same_event
BEFORE INSERT OR UPDATE OF session_id, speaker_id ON session_speakers
FOR EACH ROW EXECUTE FUNCTION enforce_session_speaker_same_event();

CREATE TABLE IF NOT EXISTS event_runtime (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  manual_current_session_id TEXT,
  override_set_at TIMESTAMPTZ,
  override_set_by TEXT,
  FOREIGN KEY (manual_current_session_id, event_id) REFERENCES sessions(id, event_id)
    ON DELETE RESTRICT,
  CHECK (
    (manual_current_session_id IS NULL AND override_set_at IS NULL AND override_set_by IS NULL)
    OR manual_current_session_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS live_integrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (length(btrim(provider)) > 0),
  external_event_key TEXT NOT NULL CHECK (length(btrim(external_event_key)) > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (event_id, provider),
  UNIQUE (id, event_id)
);

CREATE TABLE IF NOT EXISTS live_session_mappings (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL REFERENCES live_integrations(id) ON DELETE CASCADE,
  external_room_slug TEXT NOT NULL CHECK (length(btrim(external_room_slug)) > 0),
  PRIMARY KEY (session_id, integration_id)
);

CREATE OR REPLACE FUNCTION enforce_live_mapping_same_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sessions AS session
    JOIN live_integrations AS integration ON integration.event_id = session.event_id
    WHERE session.id = NEW.session_id AND integration.id = NEW.integration_id
  ) THEN
    RAISE EXCEPTION 'session and LIVE integration must belong to the same event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_session_mappings_same_event ON live_session_mappings;
CREATE TRIGGER live_session_mappings_same_event
BEFORE INSERT OR UPDATE OF session_id, integration_id ON live_session_mappings
FOR EACH ROW EXECUTE FUNCTION enforce_live_mapping_same_event();

CREATE INDEX IF NOT EXISTS sessions_event_schedule_idx
  ON sessions(event_id, starts_at, ends_at, sort_order);

CREATE INDEX IF NOT EXISTS session_speakers_order_idx
  ON session_speakers(session_id, sort_order);

COMMIT;
