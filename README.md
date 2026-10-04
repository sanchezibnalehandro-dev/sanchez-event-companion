# SANCHEZ Event Companion

Web-first event companion built around the first useful vertical slice:

**Guest link → TODAY → PROGRAM / SESSION → SANCHEZ LIVE Q&A**

This repository is a separate product from **SANCHEZ LIVE Q&A**. Companion owns
event program data, publication and the event's effective current session. It does
not own Q&A rooms, questions, votes, moderation, or Q&A current-room state.

## Current scope

Implemented and verified in the current product line:

- mobile-first TODAY with actual NOW, NEXT and a neutral LIVE CTA;
- published PROGRAM with past/current/concurrent/upcoming states;
- session detail with location, summary and assigned speakers;
- organizer session create/edit/delete, multi-speaker assignment and location choice;
- location-aware transactional schedule shifting with parallel program lanes;
- explicit publish/unpublish;
- explicit set/clear manual current override;
- safe local demo seed with fictional sessions, gaps, parallel locations and non-LIVE blocks;
- server-side publication filtering;
- link-only SANCHEZ LIVE Q&A adapter;
- PostgreSQL production persistence;
- PostgreSQL-backed organizer email/password authentication and sessions;
- verified PostgreSQL TLS with provider CA validation;
- Timeweb Cloud App Platform production deployment in Moscow;
- a minimal authenticated Organizer Console root and explicit logout.

Explicitly out of scope until a concrete requirement exists:

- People, participant profiles, Meetings, messaging and AI;
- Word Cloud, backstage tasks and speaker self-service;
- a Q&A status API or direct Q&A database access;
- shared Companion/Q&A database ownership;
- iframe embedding of LIVE Q&A;
- unified Q&A management authentication;
- custom production domain and broader event-platform expansion.

In this product, **current session means event current state, not Q&A current
room**. Q&A state never participates in the event-current resolver.

## Stack

Application:

- Next.js 16 App Router and React 19;
- strict TypeScript;
- Node.js 24;
- server components and server actions;
- Vitest and ESLint;
- no UI framework, ORM, Supabase client or Q&A SDK.

Persistence:

- PostgreSQL is the production persistence backend;
- Node.js built-in SQLite remains supported for local/demo compatibility only.

Production hosting:

- Timeweb Cloud App Platform for the SSR application;
- Timeweb Cloud PostgreSQL;
- Moscow region for both services.

The production stack and trust boundary are accepted architecture decisions. Do not
switch provider, persistence model or TLS policy as incidental cleanup.

## Local demo

Requires Node.js 24 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run demo:seed
npm run dev:demo
```

`npm run dev:demo` explicitly enables `EVENT_COMPANION_LOCAL_DEMO=true` and binds
the development server to `127.0.0.1`. Production always rejects both the demo
bypass and the development Bearer token, regardless of environment configuration.

Current product time contract: Europe/Moscow. Event times are entered and displayed
in Moscow time, while persisted timestamps remain absolute ISO/UTC instants.

The seed is non-destructive: if the demo event already exists, it exits without
overwriting data.

Demo routes:

- Guest Hub: `/e/future-industry-day`
- Guest PROGRAM: `/e/future-industry-day/program`
- Organizer: `/organizer/events/demo-event-2026/program`

When `EVENT_COMPANION_LOCAL_DEMO=true`, the root route redirects to the seeded demo
event. Without that local-demo flag, `/` stays neutral and asks the guest to use the
event link supplied by the organizer; it does not assume a production event slug.

## Production PostgreSQL

Production requires:

```text
EVENT_COMPANION_DATABASE_DRIVER=postgres
DATABASE_URL=<production PostgreSQL URL>
DATABASE_CA_CERT=<complete Timeweb root CA PEM>
```

`DATABASE_URL` uses the provider database domain rather than a hard-coded raw IP.
`DATABASE_CA_CERT` contains the complete PEM value, including the certificate boundary
lines; it is not a local filesystem path.

PostgreSQL TLS certificate verification remains enabled with
`rejectUnauthorized=true`. Do not disable verification as a workaround and do not
commit production connection strings, passwords, CA contents or other secrets.

## Commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run demo:seed
npm run dev:demo
npm run organizer:create
```

The organizer creation CLI currently has known Windows password-input UX debt. Do
not use ad-hoc production password-reset one-liners as a normal maintenance path;
a dedicated reset command is planned.

## Event current-session rule

The resolver is deterministic and accepts an explicit clock:

1. valid organizer manual override for this event;
2. planned session satisfying `starts_at <= now < ends_at`;
3. `null`.

When manual NOW is active, NEXT follows the saved program order after that session.
Otherwise NEXT is the earliest future session. Gaps remain gaps. Parallel active
sessions remain visible as concurrent context while one deterministic session remains
the primary effective NOW state.

## Publication behavior

- `draft`: public lookup behaves as not found and returns no program payload;
- `published`: the program is available;
- `unpublished`: public routes receive only a payload-free unavailable result.

Filtering occurs inside the server repository before route rendering.

## LIVE integration

A session can map to an event-level provider integration, but the guest URL always
uses the integration's `external_event_key`:

```text
https://sanchez-live-qna.vercel.app/ask.html?event=<event_key>
```

There is no iframe, Q&A Supabase access, direct write, `questions_open` inference,
or current assumption of a public LIVE status endpoint. Unmapped sessions simply omit
the CTA.

## Source of truth and project state

- GitHub `main` is source-code truth;
- Timeweb PostgreSQL is production database/runtime truth;
- Timeweb App Platform is deployed-application truth;
- repository docs record durable architecture and checkpoints, not volatile live values.

Before production-sensitive work, verify the connected service rather than trusting a
stored URL, IP, environment value or deployment state.

Current accepted architecture and handoff documents:

- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [ADR-001 — Event Companion / LIVE Q&A Boundary](docs/ADR-001_EVENT_COMPANION_LIVE_BOUNDARY_v3.md)
- [ADR-002 — Event Companion Production Stack](docs/ADR-002_EVENT_COMPANION_PRODUCTION_STACK.md)
- [Project State — 2026-10-03](docs/EVENT_COMPANION_STATE_2026-10-03.md)
