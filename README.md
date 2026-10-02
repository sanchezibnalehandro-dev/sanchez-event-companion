# SANCHEZ Event Companion

Phase 1 foundation for a web-first event companion built around:

**TODAY → PROGRAM → LIVE**

This repository is a separate product from **SANCHEZ LIVE Q&A**. It owns event
program data and the event's effective current session. It does not own Q&A rooms,
questions, votes, moderation, or the Q&A current-room state.

## Phase 1 boundary

Included:

- event-first public route skeletons;
- protected organizer route skeletons;
- Event, Location, Session, Speaker, SessionSpeaker and EventRuntime models;
- normalized, provider-neutral LIVE integration and per-session mapping;
- server-side publication filtering;
- deterministic `manual override → planned schedule → null` current-session resolver;
- link-only SANCHEZ LIVE Q&A adapter;
- local SQLite persistence and automated unit/integration tests.

Explicitly out of scope:

- People, participant profiles, Meetings, messaging and AI;
- a polished Program Editor or organizer CRUD UI;
- Word Cloud and backstage tasks;
- a Q&A status API;
- direct access to SANCHEZ LIVE Q&A tables, Supabase, cookies or sessions;
- production deployment and production authentication.

In this product, **current session means the event's current state, not the Q&A
current room**. Q&A state never participates in the Phase 1 resolver.

## Stack

- Next.js 16 App Router
- React 19
- strict TypeScript
- Node.js built-in SQLite (`node:sqlite`)
- Vitest
- ESLint

The repository intentionally has no UI framework, ORM, Supabase client or Q&A SDK.

## Local setup

Requires Node.js 24 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The database is created lazily at `.data/event-companion.sqlite`. The migration is
in `db/migrations/0001_initial.sql`. No seed data is added automatically.

## Commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Routes

Public, server-filtered:

- `/e/[eventSlug]` — TODAY / NOW / NEXT;
- `/e/[eventSlug]/program` — published agenda;
- `/e/[eventSlug]/sessions/[sessionSlug]` — published session detail.

Organizer skeletons:

- `/organizer/events/[eventId]/program`;
- `/organizer/events/[eventId]/settings`.

The organizer routes read the program only after authorization. Phase 1 provides a
safe local-development placeholder: set `ORGANIZER_DEV_BEARER_TOKEN` and pass it as
an `Authorization: Bearer ...` header. This placeholder is always disabled when
`NODE_ENV=production`; it does not reuse LIVE Q&A authentication.

## Publication behavior

- `draft`: public lookup behaves as not found and returns no event/program payload;
- `published`: the server returns the program;
- `unpublished`: the server returns only a payload-free unavailable state, rendered
  as a coming-soon page.

Filtering occurs inside the server repository before a route receives program data.

## LIVE integration

The first adapter is provider-neutral at its interface and supports the provider
identifier `sanchez-live-qna`. A session may be mapped to an external room, but the
guest link deliberately uses only the event-level key:

```text
https://sanchez-live-qna.vercel.app/ask.html?event=<event_key>
```

There is no iframe, direct Q&A data access, write, `questions_open` inference, or
future `/api/public/live-context` implementation in Phase 1. A session without a
LIVE mapping remains valid.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/DECISIONS.md](docs/DECISIONS.md).
