# Decisions

This file is a compact decision register for the current Event Companion line.
Accepted ADRs are authoritative for their topics. Historical phase notes are retained
only where they still describe current behavior.

## ADR-001 — Event Companion / LIVE Q&A boundary

- **Status:** Accepted
- **Accepted:** 2026-10-02
- **Revision:** 3, revised 2026-10-03
- **Source:** `ADR-001_EVENT_COMPANION_LIVE_BOUNDARY_v3.md`

### Decision

1. `sanchez-event-companion` and `sanchez-live-qna` remain separate products and
   repositories.
2. Companion owns its own persistence and must not write into Q&A tables.
3. Companion owns planned program, publication and overall effective event current
   session.
4. LIVE Q&A owns Q&A current room, intake, moderation, questions, votes and live
   speaker/panel behavior.
5. Event current state resolves as manual override → planned time match → no current
   session.
6. Session-to-LIVE mapping is optional.
7. Current LIVE integration is link-only through the stable Q&A event route.
8. Companion must not claim Q&A availability without a trustworthy Q&A-owned source.
9. No iframe integration.
10. Explicit start/end timestamps remain the Program source of truth; parallel
    locations are valid.
11. NEXUS remains a concept donor/reference rather than the base repository.

### Consequences

- Companion can represent registration, breaks, networking and other non-Q&A blocks
  correctly.
- LIVE Q&A stays isolated, independently deployable and rollbackable.
- Event Program and Q&A live state may diverge unless an explicit future integration
  contract coordinates them.
- A richer Q&A read contract requires a separate architecture decision.

## ADR-002 — Production stack and PostgreSQL trust boundary

- **Status:** Accepted
- **Accepted:** 2026-10-03
- **Source:** `ADR-002_EVENT_COMPANION_PRODUCTION_STACK.md`

### Decision

1. Production application hosting uses Timeweb Cloud App Platform in Moscow.
2. Production persistence uses Timeweb Cloud PostgreSQL in Moscow.
3. Companion remains operationally separate from LIVE Q&A, including database
   ownership and deployment.
4. Production runs Next.js in SSR/backend mode with Node.js, `npm run build` and
   `npm start`.
5. `EVENT_COMPANION_DATABASE_DRIVER=postgres` is required in production.
6. SQLite remains local/demo compatibility only.
7. The canonical production DB endpoint is the provider PostgreSQL domain, not a
   stored raw IPv4.
8. PostgreSQL certificate verification is mandatory using the complete provider root
   CA PEM in `DATABASE_CA_CERT` with `rejectUnauthorized=true`.
9. Production repository access and organizer auth use one shared PostgreSQL
   connection policy.
10. Production connection strings, passwords, CA contents and other secrets stay out
    of source control.
11. GitHub, Timeweb PostgreSQL and Timeweb App Platform are the live sources of truth
    for code, database/runtime and deployed application respectively.

### Explicit non-decisions

ADR-002 does not decide custom domain, backups beyond provider defaults, monitoring,
high availability, People/Meetings data models, participant auth, richer Q&A status
API or long-term provider portability.

## Current implementation decisions

### Server-side public data paths

Public program data is fetched and filtered on the server. Publication filtering is
structural rather than a client-side display convention.

### Organizer mutations use server actions

Organizer program mutations are server-side and execute behind the organizer auth
boundary. Browser code does not receive direct database access.

### Program order and clock time are distinct

`sort_order` is saved organizer order. Explicit timestamps remain the source of
planned current-session resolution and gap/overlap behavior.

With a valid manual NOW override, NEXT follows saved program order after the selected
session. Without an override, NEXT is the earliest future session by timestamp.

### Parallel presentation does not redefine NOW

Strictly overlapping sessions may appear as parallel location lanes while one
deterministic session remains the primary effective NOW state. Back-to-back sessions
remain separate rather than being treated as overlaps.

### Auto-shift is bounded and transactional

Organizer auto-shift edits remain bounded lane operations rather than a universal
scheduling engine.

Same-location edits ripple only within that lane. Moving between locations behaves as
cut from the source lane plus insert into the destination lane. The destination shifts
only by the minimum collision amount and invalid occupied-interval insertion is
rejected atomically.

### Companion auth is the primary Organizer Console identity

Production organizer users and sessions are Companion-owned and PostgreSQL-backed.
Passwords use the production hashing implementation; browser session cookies carry a
raw random token while persisted session state stores the server-side representation.

The existing `sanchez-live-qna` Supabase Auth flow is not replaced or integrated by
this decision. A future server-side Q&A management handoff without a second login is
still a separate integration problem.

### Local access remains explicit and non-production only

Local demo access and development Bearer authentication remain explicit local tools.
Production does not fall back to them when a valid PostgreSQL organizer session is
missing or invalid.

## Current product stage

The production foundation is implemented and verified: PostgreSQL persistence,
organizer authentication, verified CA/TLS handling and Timeweb deployment are no
longer deferred architecture questions.

The current gap is product workflow rather than infrastructure. `/organizer` is still
a minimal authenticated landing surface, and the next milestone is a coherent
Organizer/Event path through one real production event.

## Known technical debt

### Organizer CLI password UX

`npm run organizer:create` currently has known Windows terminal-input problems and no
password confirmation. The next maintenance slice should:

- add password confirmation;
- make Windows paste/input behavior reliable;
- add a dedicated `organizer:reset-password` command;
- reuse the production password hashing implementation;
- add regression coverage.

Do not normalize ad-hoc PowerShell or `node -e` password maintenance as an operations
workflow.

## Deferred product decisions

Still not approved:

- People/Meetings data model;
- participant authentication/profile model;
- internal messaging versus messenger handoff;
- Q&A public status endpoint / richer read contract;
- shared broader product shell;
- custom production domain;
- commercialization model;
- broader AI features.

These are not implementation backlog by default. They require concrete organizer or
participant evidence before entering production scope.

## Near-term sequence

1. fix organizer CLI password creation/reset UX;
2. complete a real Organizer event-management path from authenticated root into
   event/program management;
3. create one intentional non-demo production event;
4. verify publish → public Program → current state → LIVE link end-to-end;
5. run a realistic organizer + guest production smoke test;
6. only then return to visual polish or broader product exploration.

Do not reopen stable Q&A architecture as part of this sequence unless a concrete
integration bug requires it.
