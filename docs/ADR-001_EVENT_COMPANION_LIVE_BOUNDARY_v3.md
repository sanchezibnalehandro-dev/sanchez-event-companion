# ADR-001 — Event Companion / LIVE Q&A Boundary

Date: 2026-10-02  
Status: Accepted  
Revision: 3  
Last revised: 2026-10-03

## Context

SANCHEZ LIVE Q&A is already a verified production product with stable live invariants around:

- guest questions;
- moderation;
- voting;
- speaker/panel modes;
- multi-session events;
- explicit Q&A current-session switching;
- Realtime session following;
- stale-action rejection.

A broader Event Companion is being developed from real event usage and selected lessons from NEXUS.

The new product needs a clean distinction between:

1. **event state** — what is actually happening at the event;
2. **Q&A state** — which LIVE Q&A room is current and whether Q&A is open.

These are related but are not the same thing. Coffee breaks, registration, networking, tours and other program blocks may have no LIVE Q&A at all.

## Decision

### 1. Separate products / repositories

Keep:

- `sanchez-live-qna` as the stable production LIVE Q&A product;
- `sanchez-event-companion` as a separate product/repository.

Do not expand the current Q&A repository into a broad event platform.

### 2. Separate backend boundary

Event Companion owns its own data model and persistence.

Do not share direct table ownership with LIVE Q&A.  
Do not write from Companion into Q&A tables.

The current accepted Companion production stack is documented separately in:

`ADR-002_EVENT_COMPANION_PRODUCTION_STACK.md`

### 3. Event Companion owns event current state

Event Companion owns:

- planned program;
- session content;
- locations;
- speakers used by the program;
- publication state;
- the event's effective current session.

Effective current session resolution:

1. explicit organizer manual current-session override, if present;
2. otherwise the planned session whose `starts_at <= now < ends_at`;
3. otherwise no current session.

This state answers the participant question:

> What is happening at the event now?

### 4. LIVE Q&A owns Q&A current state

SANCHEZ LIVE Q&A owns:

- which Q&A room is current for its `event_key`;
- whether question intake is open;
- moderation;
- questions;
- votes;
- speaker/panel live behavior.

This state answers:

> What is happening with Q&A now?

LIVE Q&A must not be used as the authoritative source for the overall event current session.

### 5. Session-to-LIVE integration is optional

A Companion session may optionally map to LIVE Q&A.

Example conceptual mapping:

- provider: `sanchez-live-qna`
- external_event_key
- external_room_slug
- enabled

A session without LIVE mapping remains a fully valid program session.

### 6. Initial integration is link-only

For the current product stage:

- Companion does not require a public LIVE status API;
- guest CTA links to the stable LIVE event route:
  `https://sanchez-live-qna.vercel.app/ask.html?event=<event_key>`;
- Companion must not claim that LIVE/Q&A is open unless it has a trustworthy Q&A-owned source for that fact.

A dedicated Q&A-owned read-only `live-context` endpoint may be considered later as a separate change.

### 7. No iframe integration

Guest transitions into LIVE through a normal route/deep link.

Branding should make the transition coherent, but products remain operationally separate.

### 8. NEXUS is a donor/reference, not the base repository

Potential donors:

- public program concepts;
- NOW / NEXT presentation;
- publish/unpublish;
- organizer program editing;
- manual current override concept;
- drag-and-drop interaction patterns;
- selected tests and degraded-state ideas.

Do not inherit:

- NEXUS single-room assumptions;
- cumulative-duration-only timing model;
- NEXUS Q&A schema coupling;
- Word Cloud;
- backstage tasks/team;
- meeting intelligence;
- NEXUS visual identity as a mandatory product shell.

### 9. Explicit timestamps remain the Program source of truth

Companion sessions store explicit start/end timestamps.

Organizer schedule editing may provide auto-shift behavior for convenience, but it must not replace the underlying explicit timestamps with a cumulative-duration-only model.

Parallel locations are valid.

Back-to-back sessions are distinct; true time overlaps may be presented as parallel program groups.

## Consequences

### Positive

- LIVE Q&A remains protected and rollbackable.
- Event current state can represent non-Q&A blocks correctly.
- Program supports explicit start/end timestamps, gaps and parallel locations.
- Event Companion can evolve independently toward later product areas.
- LIVE integration remains replaceable/provider-neutral.
- Companion production infrastructure can evolve without forcing a Q&A migration.

### Negative

- Two deployables must be integrated intentionally.
- Brand continuity requires design work.
- A future richer LIVE status integration needs an explicit read contract.
- There is no distributed transaction across Companion and LIVE.
- Event Program and Q&A live state can diverge unless operators manage both intentionally.

## Resolved since Revision 2

The following items were previously deferred and are now resolved for the current implementation:

- Companion production provider/region: Timeweb Cloud, Moscow;
- Companion production persistence: PostgreSQL;
- organizer authentication: PostgreSQL-backed organizer users/sessions;
- initial multi-track presentation: explicit timestamps with location-aware parallel groups and transactional auto-shift editing.

See:

- `ADR-002_EVENT_COMPANION_PRODUCTION_STACK.md`
- `EVENT_COMPANION_STATE_2026-10-03.md`

## Deferred decisions

Still not decided:

- People/Meetings data model;
- participant authentication/profile model;
- internal messaging vs messenger handoff;
- Q&A public status endpoint / richer read contract;
- whether both products eventually share a broader shell;
- custom production domain;
- commercialization model.
