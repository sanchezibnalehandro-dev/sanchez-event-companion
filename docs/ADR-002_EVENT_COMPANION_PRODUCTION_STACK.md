# ADR-002 — Event Companion Production Stack and PostgreSQL Trust Boundary

Date: 2026-10-03  
Status: Accepted

## Context

SANCHEZ Event Companion moved from a local SQLite/demo implementation into a real production foundation.

The product needs:

- server-side Next.js execution;
- a durable PostgreSQL backend;
- production organizer authentication;
- deployment in Russia for the current product direction;
- verified TLS between the application and PostgreSQL;
- a clean operational boundary from the existing `sanchez-live-qna` production system.

During production setup, direct use of the database's raw public IPv4 proved intermittently unreliable even when TCP reachability checks succeeded.

The Timeweb PostgreSQL domain with the Timeweb root CA and full certificate verification produced a verified working Node `pg` connection and a successful production organizer login flow.

## Decision

### 1. Production hosting provider

For the current Companion production foundation, use:

- **Timeweb Cloud App Platform** for the Next.js application;
- **Timeweb Cloud PostgreSQL** for production persistence;
- Moscow region for both services.

This is the current accepted production stack, not a claim that the provider can never change.

Changing provider/region later requires an explicit infrastructure decision and migration plan.

### 2. Companion remains operationally separate from LIVE Q&A

Keep:

- `sanchez-event-companion` as its own repository/deployable/database;
- `sanchez-live-qna` as the stable production LIVE Q&A product.

Do not share direct table ownership between the products.

Do not make Companion deployment depend on modifying Q&A production state.

### 3. Next.js runs as an SSR backend

Production Companion is not a static export.

Use:

- Node.js runtime;
- `npm run build`;
- `npm start`;
- Next.js SSR/backend mode.

The production application requires server-side access to PostgreSQL for organizer auth and repository operations.

### 4. PostgreSQL is the production persistence backend

Production requires:

`EVENT_COMPANION_DATABASE_DRIVER=postgres`

SQLite remains valid for local/demo compatibility only.

Do not use local SQLite as production persistence on App Platform.

### 5. Production DB connection uses the provider domain

The canonical `DATABASE_URL` uses the Timeweb PostgreSQL domain.

Do not hard-code the observed public IPv4 as the production database endpoint.

App and database should remain attached to the same provider private network when supported by the deployment configuration, but the application connection contract is expressed through the database domain rather than a stored private/public IP literal.

### 6. TLS certificate verification is mandatory

Production PostgreSQL verification must remain enabled.

Required environment input:

`DATABASE_CA_CERT=<complete Timeweb root CA PEM>`

The value is the PEM content itself, not a local file path.

The shared PostgreSQL connection helper configures verified TLS with:

- provider CA;
- `rejectUnauthorized=true`.

Do not use:

- `rejectUnauthorized=false`;
- `sslmode=disable`;
- committed certificate files;
- unverified TLS as a temporary production workaround.

### 7. One shared PostgreSQL connection policy

The same PostgreSQL connection helper must be used by:

- Companion production repository access;
- organizer authentication store.

This prevents data access and auth from drifting into different SSL/trust behavior.

### 8. Production secrets stay outside source control

Do not commit:

- production `DATABASE_URL`;
- database passwords;
- organizer passwords;
- `DATABASE_CA_CERT` values;
- provider secret material.

Project docs may record variable names and trust semantics, but not secret values.

### 9. Runtime truth is checked in connected services

GitHub `main` is the source-code truth.

Timeweb PostgreSQL is the production DB/runtime truth.

Timeweb App Platform is the deployed application truth.

Stored documentation is a checkpoint and architecture reference only.

Do not assume a stored deployment URL, IP address, environment value or database state remains current without verification.

## Consequences

### Positive

- Production persistence is no longer tied to local SQLite.
- Organizer sessions survive application process restarts.
- Database traffic uses explicit certificate trust.
- App and auth share one PostgreSQL connection policy.
- Companion can be deployed independently from Q&A.
- The production boundary is simple enough to reproduce and audit.

### Negative

- Production now has two Timeweb resources to operate: App Platform and PostgreSQL.
- CA/environment configuration becomes a required deployment step.
- Provider-specific operational knowledge is now part of release work.
- Local development and production intentionally use different persistence backends unless PostgreSQL is selected locally.

## Verified implementation checkpoint

Verified on 2026-10-03:

- production PostgreSQL migrations applied;
- production schema tables present;
- Node `pg` connection succeeded with provider CA verification;
- production Next.js application deployed successfully;
- organizer login created a PostgreSQL-backed session and opened protected `/organizer`.

These observations establish the decision, but they are not substitutes for future live health checks.

## Deferred decisions

Still not decided here:

- custom production domain;
- backups/retention policy beyond provider defaults;
- production monitoring/alerting policy;
- high availability / replica requirements;
- People/Meetings data model;
- participant authentication;
- richer Q&A status API;
- long-term provider portability strategy.
