# Architecture

## Product boundary

Event Companion is one deployable with one data ownership boundary. It owns event
content, publication and event runtime state. SANCHEZ LIVE Q&A remains an external
provider and owns all Q&A behavior.

```text
public route ──> publication-filtered repository ──> Companion SQLite
     │
     └─ mapped session ──> LIVE adapter ──> external guest URL

organizer route ──> organizer auth boundary ──> unfiltered organizer repository
```

There is no client-side database access. All route components are server components,
and all public reads pass through `getPublicProgramBySlug`.

## Modules

- `app/e/[eventSlug]`: public TODAY, program and session route skeletons.
- `app/organizer`: protected organizer route skeletons.
- `lib/domain`: types, invariants, presentation helpers and current-session logic.
- `lib/data`: repository contract and SQLite implementation.
- `lib/live`: provider-neutral contract and link-only SANCHEZ adapter.
- `lib/auth`: isolated organizer authentication boundary.
- `db/migrations`: Companion-owned persistence schema.

## Persistence

Phase 1 uses Node's built-in SQLite driver to keep the local dependency set small.
The migration enforces:

- `ends_at > starts_at` for events and sessions;
- session slug uniqueness inside an event;
- event-local location references;
- many-to-many session speakers;
- event-local runtime overrides;
- normalized event-level LIVE integrations plus optional session mappings.

Application validation additionally requires timezone-bearing timestamps and a valid
IANA event timezone. Instants are normalized to UTC ISO strings before persistence;
the IANA timezone controls display, not instant comparison.

The final hosted database provider and region are deliberately deferred. A future
adapter may replace SQLite without changing route/domain contracts. The current
SQLite file is a local Phase 1 foundation, not a Vercel persistence recommendation.

## Effective current session

`resolveEffectiveCurrentSession` is pure and accepts an explicit `Date`, making tests
deterministic. Its order is exact:

1. a manual session ID that resolves to a session belonging to the same event;
2. a session satisfying `starts_at <= now < ends_at`;
3. `null`.

If malformed data contains overlapping planned sessions, selection is deterministic:
earliest start, then `sort_order`, then ID. Multi-track current-state semantics are
not defined in Phase 1.

Q&A current room and `questions_open` are intentionally absent from this resolver.

## Publication boundary

The public repository first reads only `id` and `program_state`:

- a missing or `draft` event returns `not_found`;
- `unpublished` returns a payload-free `unavailable` result;
- only `published` triggers loading of the aggregate.

Organizer reads use a separate method and execute only after organizer authorization.
No public route receives draft sessions for client-side hiding.

## LIVE adapter

The provider-neutral contract accepts an event integration and a session mapping.
The SANCHEZ adapter validates both but builds its guest URL from
`external_event_key`; `external_room_slug` never replaces the event key in the URL.

The adapter produces a destination only. It does not query availability and cannot
claim that Q&A is open. A disabled or missing mapping produces no CTA.

## Authentication boundary

No LIVE Q&A cookie or session is reused. The Phase 1 placeholder accepts a configured
Bearer token only outside production. Production always denies it. Choosing and
integrating production auth requires a separate decision and real infrastructure.
