# Decisions

## ADR-001 — Event Companion / LIVE Q&A boundary

- **Status:** Accepted for initial implementation
- **Accepted:** 2026-10-02
- **Source:** `ADR-001_EVENT_COMPANION_LIVE_BOUNDARY_v2.md`

### Context

SANCHEZ LIVE Q&A is a verified production product. Event Companion is broader, but
its event state is not the same as Q&A state. Registration, breaks and networking
may be current event sessions without any Q&A room.

### Decision

1. Event Companion is a separate product and repository.
2. It owns its persistence and never writes to Q&A tables.
3. It owns planned program, publication and effective event current session.
4. SANCHEZ LIVE Q&A owns Q&A current room, intake state, moderation, questions and
   votes.
5. Session-to-LIVE mapping is optional.
6. Phase 1 integration is link-only using
   `https://sanchez-live-qna.vercel.app/ask.html?event=<event_key>`.
7. No iframe is used.
8. NEXUS is a concept donor, not the base repository.

### Current-session rule

The event current session resolves in this order:

1. valid organizer manual override for the event;
2. planned session where `starts_at <= now < ends_at`;
3. no current session.

LIVE Q&A state is not an input to this rule.

### Consequences

- LIVE remains isolated and rollbackable.
- Companion can represent program blocks without Q&A.
- richer LIVE status requires a later, explicitly approved read contract.
- there is no shared transaction or auth state between the products.

### Deferred

- final hosted database provider and region;
- production organizer authentication;
- People and Meetings;
- participant personal-data architecture;
- Q&A public status endpoint;
- shared product shell and final multi-track semantics.

## Phase 1 implementation decisions

### SQLite for local foundation

Use Node's built-in SQLite driver and a repository boundary. This proves persistence
and constraints locally without selecting Supabase, creating infrastructure, adding
an ORM, or pretending SQLite is the final hosted database.

### Server components only on public data paths

Keep public program fetching and rendering on the server. This makes publication
filtering structural rather than a client-side display convention.

### Production-safe auth placeholder

Use a local Bearer-token boundary that always denies in production. Do not invent
credentials or couple to existing Q&A auth.

### NEXUS reuse

Port only the concepts of NOW/NEXT, a clear coming-soon state and separate
publication control. Do not copy `ProgramClient`, Supabase helpers, migrations,
cumulative-duration timing, Q&A tables, AI import or brand/background systems.

## Phase 2 implementation decisions

### Server actions over a client data layer

Organizer mutations are server actions behind the organizer-auth boundary. They
write through the SQLite repository, then invalidate only the organizer and public
event paths affected by the command. The browser never receives database access.

### Program order and clock time remain distinct

`sort_order` is the organizer's explicit saved program order. Timestamps are the
source of planned current-session resolution and gap detection. Manual-current NEXT
uses saved program order so an override does not create a misleading clock-based
successor.

### Overlap stays visible

The effective-current invariant still produces one NOW session. A simultaneous
session is retained in the program timeline with a `concurrent` label instead of
being hidden or incorrectly marked upcoming.

### Local demo auth uses an explicit loopback-bound launch

The Phase 2 demo command explicitly enables the demo switch and binds the development
server to `127.0.0.1`. Request Host headers are not trusted as an authentication
boundary. Production rejects both demo bypass and development Bearer auth.
Production organizer authentication remains explicitly deferred.

### Demo data is fictional and non-destructive

`npm run demo:seed` inserts one known fictional event into the configured local
SQLite file and refuses to overwrite an event with the same ID. Its LIVE mappings
exercise URL generation only; they do not claim or require a real Q&A event.

## Phase 3 implementation decisions

### Auto-shift is a bounded repository operation

Auto-shift keeps explicit timestamps and runs with the edited session and speaker
links in one SQLite transaction. Same-location edits ripple by the edited end delta.
Moving between locations compresses the source lane, then applies only the overlap
required by the first following destination session. A destination start inside an
occupied interval is rejected atomically. Fixed anchors and a universal scheduling
engine remain deferred.

### Parallel presentation does not redefine NOW

Strictly overlapping intervals form a shared visual range with one lane per location.
Back-to-back intervals stay separate. The effective-current resolver is unchanged:
one session remains primary and active alternatives are presented as concurrent.
