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
