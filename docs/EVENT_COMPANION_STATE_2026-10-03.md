# SANCHEZ EVENT COMPANION — PROJECT STATE

Updated: 2026-10-03

## Purpose

This file is the durable handoff/current-state overview for **SANCHEZ Event Companion**.

It records the implementation checkpoint reached on 2026-10-03 and the product/architecture decisions that a new working chat should preserve.

It is **not** the source of truth for volatile live values such as:

- current production deployment health;
- current environment-variable values;
- current database contents;
- current app/database IP addresses;
- current organizer sessions;
- future GitHub commits after this checkpoint.

When those facts matter, re-check the connected service directly:

- GitHub `main` for source code;
- Timeweb Cloud PostgreSQL for production DB/runtime state;
- Timeweb App Platform for the deployed application.

## Product boundary

SANCHEZ Event Companion is a **separate product and repository** from `sanchez-live-qna`.

Repository:

`https://github.com/sanchezibnalehandro-dev/sanchez-event-companion`

SANCHEZ LIVE Q&A remains the stable production LIVE Q&A product.

Do not move Program / People / Meetings / Messaging / AI into the Q&A repository merely because those capabilities may belong to Event Companion later.

The current Companion integration with LIVE Q&A remains intentionally loose and link-based.

## Source checkpoint — 2026-10-03

GitHub `main` checkpoint after the verified PostgreSQL CA production fix:

`51aa83dc835e7b974151d75ecb0d1ce49b2232e4`

Important preceding implementation commits:

- `c7ec75d` — location-aware program flow and parallel schedule;
- `950cf24` — reject same-lane scheduling collisions;
- `1511ad2aa2e10922220591ec7b81b8da9fe35490` — Phase 4.1 production foundation;
- `ed934c5a7834aad51eb3f2d9b783b00c07618560` — Phase 4.2 organizer auth;
- `5f19ead` — verified PostgreSQL CA support in production;
- `51aa83dc835e7b974151d75ecb0d1ce49b2232e4` — merge checkpoint on `main`.

Before new source work, verify current remote `main`; do not assume this SHA is still latest.

## Current stack

Application:

- Next.js 16 App Router;
- React 19;
- TypeScript strict;
- Node.js 24;
- SSR production deployment;
- PostgreSQL persistence in production;
- SQLite retained for local/demo compatibility.

Production application hosting:

- provider: Timeweb Cloud App Platform;
- region: Moscow;
- app name: `event-companion-prod`;
- build command: `npm run build`;
- start command: `npm start`;
- automatic deployment: enabled at the verified checkpoint;
- application and DB are attached to the same Timeweb private network.

Verified technical application URL at this checkpoint:

`https://sanchezibnalehandro-dev-sanchez-event-companion-35c5.twc1.net`

Re-check Timeweb before treating the URL or deployment as current.

## Production PostgreSQL

Provider:

Timeweb Cloud PostgreSQL

Verified production database at this checkpoint:

- region: Moscow;
- database: `default_db`;
- database user: `gen_user`;
- private network: `192.168.0.0/24`;
- DB private IP observed at setup: `192.168.0.4`;
- app private IP observed at setup: `192.168.0.5`.

Do not treat those IPs as permanent configuration values. Re-check Timeweb when networking facts matter.

The canonical application connection uses the Timeweb database **domain** plus verified TLS, not a hard-coded raw public IPv4.

During setup, raw public IPv4 connections were intermittently unreliable even when TCP probing succeeded. Do not use that path as the production contract.

## Production TLS contract

Production PostgreSQL uses certificate verification.

Required application environment variables:

- `EVENT_COMPANION_DATABASE_DRIVER=postgres`
- `DATABASE_URL=<production PostgreSQL URL>`
- `DATABASE_CA_CERT=<complete Timeweb root CA PEM>`

`DATABASE_CA_CERT` contains the complete PEM value, including `BEGIN CERTIFICATE` / `END CERTIFICATE` lines.

It is **not** a local filesystem path.

The shared PostgreSQL connection helper is used by:

- the main PostgreSQL Companion repository;
- `PostgresOrganizerAuthStore`.

When `DATABASE_CA_CERT` is present, the connection uses verified TLS with `rejectUnauthorized=true` and removes conflicting SSL/libpq connection-string flags.

Do not set `rejectUnauthorized=false` and do not disable certificate verification as a workaround.

Do not commit the Timeweb CA file into the repository.

## Production DB migrations

Applied successfully on 2026-10-03:

- `db/migrations/postgres/0001_initial.sql`
- `db/migrations/postgres/0002_organizer_auth.sql`

Both completed with `COMMIT`.

Verified production tables:

- `event_runtime`
- `events`
- `live_integrations`
- `live_session_mappings`
- `locations`
- `organizer_sessions`
- `organizer_users`
- `session_speakers`
- `sessions`
- `speakers`

Migration success at this checkpoint does not replace live DB inspection for future schema work.

## Organizer authentication

Production organizer authentication is PostgreSQL-backed.

The verified production flow is:

browser
→ `/organizer/login`
→ PostgreSQL `organizer_users`
→ password verification
→ `organizer_sessions`
→ secure HTTP-only session cookie
→ protected `/organizer`

A live production login smoke test passed on 2026-10-03.

Verified organizer identity at the checkpoint:

- email: `sanchezibnalehandro@gmail.com`
- display name: `Sanchez`
- `disabled_at`: null at verification.

**Never store organizer passwords in Project sources, repository files or durable docs.**

The `/organizer` root is currently a minimal authenticated landing page, not yet a full organizer event dashboard.

## Program model

Sessions store explicit `startsAt` / `endsAt` timestamps.

Do not revert the domain to a cumulative-duration-only schedule model.

### Auto-shift behavior

Organizer editing supports an explicit auto-shift option for following sessions.

Current semantics:

- auto-shift is enabled by default in the organizer editor;
- same-location timing changes ripple following sessions in that location;
- other locations are not shifted;
- existing gaps are preserved by the lane-shift operation;
- moving a session between locations is treated as **cut from old lane + insert into new lane**;
- the old lane collapses by the removed session duration;
- the destination lane shifts downstream only by the **minimum required collision amount**;
- if the new session fits into an existing free gap, destination sessions do not move;
- inserting into a destination interval that is already occupied by a session that started earlier is rejected atomically;
- back-to-back boundaries are allowed;
- with auto-shift disabled, only the target session changes;
- manual NOW/current mappings are not rewritten by scheduling ripple logic.

Schedule writes that affect a lane remain transactional.

## Parallel program presentation

Public Program supports parallel sessions by location.

Presentation rules:

- sessions are grouped by strict time overlap;
- transitive overlap groups use the group's maximum end time;
- back-to-back sessions are separate groups, not overlaps;
- cards are grouped into location lanes;
- desktop/tablet may render locations side-by-side;
- mobile renders the same group vertically under the common time context;
- primary effective current session remains the main NOW session;
- concurrent active sessions are presented as parallel context rather than replacing the primary current session;
- guest UI uses human time language such as `Время по Москве`, not the technical `Europe/Moscow` identifier.

## Event current-state contract

Event Companion owns overall event/program current state.

Resolution order remains:

1. explicit organizer manual override, when present;
2. otherwise planned time match (`starts_at <= now < ends_at`);
3. otherwise no current session.

This answers: **what is happening at the event now?**

SANCHEZ LIVE Q&A separately owns Q&A current-room/intake/moderation state.

Do not infer one system's current state from the other without an explicit integration contract.

## LIVE Q&A integration

Initial integration remains link-only.

Companion may link a session to the stable Q&A event route:

`https://sanchez-live-qna.vercel.app/ask.html?event=<event_key>`

Companion must not:

- write directly into Q&A tables;
- treat Q&A as the authoritative event-program clock;
- claim Q&A is open/closed without a trustworthy Q&A-owned status source;
- embed the stable Q&A product through an iframe merely to make the products look unified.

A richer read-only LIVE context API remains a separate future decision.

## Current product stage

Implemented and verified in the current Companion line:

- Event Hub shell;
- public Program;
- session detail routes;
- NOW/current-session presentation;
- parallel locations;
- organizer Program editor;
- location-aware schedule ripple behavior;
- publication boundary;
- PostgreSQL repository adapter;
- SQLite compatibility for local/demo use;
- production PostgreSQL migrations;
- production organizer authentication;
- verified PostgreSQL CA handling;
- Timeweb App Platform production deployment;
- live organizer login smoke test.

The production database currently contains the production schema and organizer-auth state.

Do not assume demo event/program content has been seeded into production.

## Known technical debt

### 1. Organizer CLI password UX

`npm run organizer:create` currently uses hidden raw-terminal keypress handling and does not ask for password confirmation.

During the production setup, the password stored for the first organizer did not match the intended login password and had to be reset directly.

Do not assume pasted password input in this CLI is reliable on Windows until fixed.

Preferred follow-up:

- add password confirmation;
- make Windows paste handling reliable;
- add a dedicated `organizer:reset-password` command;
- use the same password hashing code as production auth;
- add regression tests.

### 2. Avoid ad-hoc password maintenance

Do not rely on long PowerShell / `node -e` one-liners for production password maintenance.

Use a dedicated repository CLI command once implemented.

### 3. Local pre-existing file state

At the implementation checkpoints leading into production, `next-env.d.ts` had a pre-existing local user change that was deliberately kept unstaged and out of focused commits.

Do not assume this remains true forever. Check `git status` before future work.

## Product scope restraint

Do **not** expand into People / Meetings / Messaging / AI merely because those areas remain attractive in discovery.

The next useful milestone is to make the production Organizer/Event workflow coherent and run one realistic production event end-to-end.

Only broaden the product boundary after concrete organizer requirements or observed participant behavior justify it.

## Recommended next work

Near-term sequence:

1. fix organizer CLI password creation/reset UX;
2. complete a real Organizer event-management path from authenticated root into event/program management;
3. create one non-demo production event intentionally;
4. verify publish → public Program → current state → LIVE link end-to-end;
5. run a realistic organizer + guest production smoke test;
6. only then return to visual polish and broader product exploration.

Do not reopen stable Q&A architecture as part of this work unless a concrete integration bug requires it.
