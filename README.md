# SANCHEZ Event Companion

Web-first event companion built around the first useful vertical slice:

**Guest link → TODAY → PROGRAM / SESSION → SANCHEZ LIVE Q&A**

This repository is a separate product from **SANCHEZ LIVE Q&A**. Companion owns
event program data, publication and the event's effective current session. It does
not own Q&A rooms, questions, votes, moderation, or Q&A current-room state.

## Current scope

Implemented:

- mobile-first TODAY with actual NOW, NEXT and a neutral LIVE CTA;
- published PROGRAM with past/current/concurrent/upcoming states;
- session detail with location, summary and all assigned speakers;
- organizer session create/edit/delete, multi-speaker assignment and location choice;
- one-transaction session reorder;
- explicit publish/unpublish;
- explicit set/clear manual current override;
- safe local demo seed with eight fictional sessions, parallel locations, gaps, a panel and a non-LIVE break;
- server-side publication filtering;
- link-only SANCHEZ LIVE Q&A adapter;
- production organizer email/password authentication with PostgreSQL-backed sessions;
- a minimal Organizer Console root and explicit logout.

Explicitly out of scope:

- People, participant profiles, Meetings, messaging and AI;
- Word Cloud, backstage tasks and speaker self-service;
- a Q&A status API or direct Q&A database access;
- hosted deployment, unified Q&A management authentication and infrastructure rollout.

In this product, **current session means event current state, not Q&A current
room**. Q&A state never participates in the resolver.

## Stack

- Next.js 16 App Router and React 19;
- strict TypeScript;
- server components and server actions;
- PostgreSQL production persistence and Node.js built-in SQLite for local demo;
- Vitest and ESLint;
- no UI framework, ORM, Supabase client or Q&A SDK.

SQLite is a local demo persistence layer. It is not the production hosting decision.

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

## Event current-session rule

The resolver is deterministic and accepts an explicit clock:

1. valid organizer manual override for this event;
2. planned session satisfying `starts_at <= now < ends_at`;
3. `null`.

When manual NOW is active, NEXT follows the saved program order after that session.
Otherwise NEXT is the earliest future session. Gaps remain gaps; overlapping planned
sessions are marked separately rather than silently hidden.

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

There is no iframe, Q&A Supabase access, write, `questions_open` inference, or
`/api/public/live-context`. Unmapped sessions simply omit the CTA.

See [Architecture](docs/ARCHITECTURE.md) and [Decisions](docs/DECISIONS.md).
