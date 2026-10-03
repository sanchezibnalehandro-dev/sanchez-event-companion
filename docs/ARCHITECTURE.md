# Architecture

## Product boundary

SANCHEZ Event Companion is one deployable with its own data ownership boundary. It
owns event content, publication and overall event runtime state.

SANCHEZ LIVE Q&A remains a separate production product and owns all Q&A behavior.
The products do not share direct table ownership and Companion does not write to Q&A
tables.

```text
public route ──> publication-filtered repository ──> Companion persistence
     │
     └─ mapped session ──> LIVE adapter ──> external guest URL

organizer route ──> Companion organizer auth ──> organizer repository
```

There is no client-side database access. Public route components are server-side and
public reads pass through the publication boundary before event aggregates are loaded.

The accepted cross-product boundary is defined by
`ADR-001_EVENT_COMPANION_LIVE_BOUNDARY_v3.md`.

## Current production stack

Production Companion runs as a Next.js SSR/backend application on Timeweb Cloud App
Platform in Moscow and uses Timeweb Cloud PostgreSQL in Moscow for durable production
persistence.

Production requires:

- Node.js runtime;
- `npm run build`;
- `npm start`;
- `EVENT_COMPANION_DATABASE_DRIVER=postgres`;
- `DATABASE_URL` using the provider database domain;
- `DATABASE_CA_CERT` containing the complete provider root CA PEM.

SQLite remains supported for local/demo compatibility only. It is not the production
persistence backend.

The production stack and PostgreSQL trust boundary are defined by
`ADR-002_EVENT_COMPANION_PRODUCTION_STACK.md`.

## Modules

- `app/e/[eventSlug]`: public TODAY, complete program and session detail routes.
- `app/organizer`: protected organizer surfaces and server-action program editing.
- `lib/domain`: types, invariants, presentation helpers and current-session logic.
- `lib/data`: repository contracts plus SQLite and PostgreSQL persistence adapters.
- `lib/live`: provider-neutral LIVE integration contract and link-only SANCHEZ adapter.
- `lib/auth`: isolated organizer authentication boundary.
- `db/migrations`: Companion-owned persistence schema, including PostgreSQL migrations.
- `scripts`: local/demo and organizer maintenance tooling.

## Persistence boundary

The application keeps route/domain behavior behind repository contracts rather than
coupling UI code directly to a particular database driver.

### Production PostgreSQL

Production uses PostgreSQL. The initial production migrations are:

- `db/migrations/postgres/0001_initial.sql`;
- `db/migrations/postgres/0002_organizer_auth.sql`.

The production schema includes event/program state and Companion-owned organizer
identity/session state.

The PostgreSQL connection policy is shared by both normal Companion repository access
and the PostgreSQL organizer auth store so they cannot silently drift into different
TLS behavior.

### Local/demo SQLite

The local demo retains Node's built-in SQLite driver. Existing local/demo flows remain
valid, but SQLite must not be treated as the App Platform production persistence
contract.

## PostgreSQL trust boundary

Production database traffic uses verified TLS.

The canonical connection is expressed through the Timeweb PostgreSQL domain and the
provider root CA. When `DATABASE_CA_CERT` is present, the shared connection helper uses
certificate verification with `rejectUnauthorized=true` and removes conflicting
SSL/libpq connection-string flags.

Do not:

- hard-code observed DB public/private IPs as durable configuration;
- set `rejectUnauthorized=false`;
- use `sslmode=disable`;
- commit CA contents or production connection secrets;
- introduce a second PostgreSQL connection policy for organizer auth.

Observed IP addresses, deployment URLs and environment values are runtime facts and
must be re-checked in Timeweb when they matter.

## Program time model

Sessions store explicit absolute `starts_at` / `ends_at` timestamps. Do not replace
this with a cumulative-duration-only schedule model.

Application validation requires timezone-bearing timestamps. The current product time
contract is Europe/Moscow: organizer-facing event times are interpreted/displayed as
Moscow time while persisted instants remain absolute ISO/UTC values.

Parallel locations are valid.

## Effective current session

`resolveEffectiveCurrentSession` represents overall event/program state, not Q&A
state. Resolution order is:

1. a valid explicit organizer manual override for the event;
2. otherwise a planned session satisfying `starts_at <= now < ends_at`;
3. otherwise `null`.

When planned sessions overlap, one deterministic session remains the primary effective
NOW session while other simultaneous sessions are retained as concurrent program
context.

Q&A current room, intake and moderation state are intentionally absent from this
resolver.

## Location-aware program flow

Organizer schedule editing may transactionally shift following sessions while keeping
explicit timestamps as the source of truth.

Current semantics:

- same-location timing changes ripple only within that location lane when auto-shift
  is enabled;
- existing gaps are preserved;
- moving between locations is treated as cut from the old lane plus insert into the
  new lane;
- the old lane collapses by the removed duration;
- the destination lane moves only by the minimum required collision amount;
- insertion into an already occupied interval whose session began earlier is rejected
  atomically;
- back-to-back boundaries are valid;
- with auto-shift disabled, only the target session changes;
- manual current-session state is not rewritten by schedule ripple logic.

The public program derives overlap groups from explicit intervals and renders location
lanes without redefining the primary effective NOW rule.

## Publication boundary

Public reads expose only published event content.

- a missing or `draft` event behaves as not found and does not leak its program;
- `unpublished` yields a payload-free unavailable state;
- only `published` loads the public aggregate.

Organizer reads are separate and occur only after organizer authorization. Draft
program data is not sent to the browser and then hidden client-side.

## LIVE adapter

LIVE integration remains link-only for the current product stage.

A Companion session may optionally map to a LIVE provider integration. For
SANCHEZ LIVE Q&A, the guest destination uses the stable event route:

```text
https://sanchez-live-qna.vercel.app/ask.html?event=<event_key>
```

The adapter produces a destination only. It does not own or infer Q&A availability.
A missing or disabled mapping produces no CTA.

Companion must not:

- write into Q&A tables;
- use Q&A current room as the event-program clock;
- claim Q&A is open or closed without a trustworthy Q&A-owned status source;
- iframe the standalone Q&A product merely to make the two products look unified.

A richer read-only Q&A context contract is a separate future architecture decision.

## Organizer authentication boundary

Production organizer authentication is Companion-owned and PostgreSQL-backed.

The production flow is:

```text
browser
→ /organizer/login
→ organizer_users
→ password verification
→ organizer_sessions
→ secure HttpOnly session cookie
→ protected /organizer
```

Raw session tokens exist only in the browser cookie; persisted session identity is
stored server-side. Organizer authentication remains outside program-domain repository
semantics.

The existing `sanchez-live-qna` Supabase Auth flow is unchanged and remains a separate
maintenance/auth path. No LIVE Q&A cookie or session is reused by Companion today.

Outside production, the explicit loopback demo switch and optional development Bearer
mechanism remain local-only. Production does not fall back to them when a valid
Companion PostgreSQL organizer session is absent.

## Source-of-truth hierarchy

For current facts:

- GitHub `main` is source-code truth;
- Timeweb PostgreSQL is production database/runtime truth;
- Timeweb App Platform is deployed-application truth.

Repository architecture/state documents are durable decisions and checkpoints, not
authority for volatile deployment health, environment values, database contents,
network addresses or current organizer sessions.

## Product scope restraint

People, Meetings, participant profiles, messaging and AI remain outside the current
approved production scope. They may be explored later, but they must not be added to
this architecture merely because they are attractive product directions.

The next product milestone is a coherent production Organizer/Event workflow and one
realistic event run end-to-end. Stable LIVE Q&A architecture is not reopened as part
of that work without a concrete integration bug or requirement.
