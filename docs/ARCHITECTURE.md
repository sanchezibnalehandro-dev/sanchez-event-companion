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

- `app/e/[eventSlug]`: public TODAY, complete program and session detail routes.
- `app/organizer`: protected server-action program editor and event settings shell.
- `lib/domain`: types, invariants, presentation helpers and current-session logic.
- `lib/data`: repository contract and SQLite implementation.
- `lib/live`: provider-neutral contract and link-only SANCHEZ adapter.
- `lib/auth`: isolated organizer authentication boundary.
- `db/migrations`: Companion-owned persistence schema.

## Persistence

The local vertical slice uses Node's built-in SQLite driver to keep the dependency
set small. Phase 2 adds transaction-backed organizer commands for session CRUD,
speaker replacement, complete-list reorder, publication and manual-current state.
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

Reorder accepts every session ID for the event exactly once and writes all positions
inside one immediate transaction. Session create/update and speaker assignment are
also one transaction, so partial organizer writes cannot escape.

The final hosted database provider and region are deliberately deferred. A future
adapter may replace SQLite without changing route/domain contracts. The current
SQLite file is a local vertical-slice foundation, not a Vercel persistence
recommendation.

## Effective current session

`resolveEffectiveCurrentSession` is pure and accepts an explicit `Date`, making tests
deterministic. Its order is exact:

1. a manual session ID that resolves to a session belonging to the same event;
2. a session satisfying `starts_at <= now < ends_at`;
3. `null`.

If planned sessions overlap, one effective current session is selected
deterministically: earliest start, then `sort_order`, then ID. Other simultaneous
sessions stay visible as `concurrent` in the public timeline. Multi-track
current-state semantics beyond that presentation rule remain deferred.

TODAY derives NOW and NEXT from the same aggregate. With a valid manual override,
NEXT follows the saved program order after that session. Without an override, NEXT
is the earliest future session by timestamp. Gaps therefore produce no NOW and the
correct future NEXT.

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

No LIVE Q&A cookie or session is reused. The local placeholder accepts either a
configured Bearer token or an explicit local-demo switch, and only when the request
Host is loopback. A deployed/non-loopback request is always denied regardless of
environment variables. Choosing and integrating production auth requires a separate
decision and real infrastructure.
