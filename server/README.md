# Huanhuan API (mainland-first, provider-neutral)

This repository contains the Fastify/PostgreSQL server foundation and a frontend that can opt into it. The frontend uses the API only when an authenticated session supplies an access token **and** `VITE_API_BASE_URL` is configured; otherwise it remains in isolated local-demo mode. No production API, identity provider, PostgreSQL instance, image service, or credentials are configured here.

## Implemented API surface

- `GET /health/live`, `GET /health/ready` — process liveness and repository readiness.
- `GET|PATCH /api/v1/me`; `GET /api/v1/me/listings`; `PATCH|DELETE /api/v1/me/listings/:listingId`; `POST /api/v1/me/listings/:listingId/restore` — authenticated profile and listing lifecycle.
- `GET /api/v1/listings`, `POST /api/v1/listings` — approved public feed and listing submission (new/edited listings enter moderation).
- `GET /api/v1/me/favorites`; `POST|DELETE /api/v1/listings/:listingId/favorite` — favorite management.
- `GET /api/v1/offers`, `POST /api/v1/offers`, `POST /api/v1/offers/:offerId/respond`, `POST /api/v1/offers/:offerId/confirm` — validated offers, row locking, reservation and two-party handoff confirmation. Offer reads include item snapshots for the exchange UI.
- `GET|POST /api/v1/conversations`, `GET|POST /api/v1/conversations/:conversationId/messages` — participant-scoped conversations and messages; blocked users cannot continue a thread.
- `POST /api/v1/offers/:offerId/reviews`, `GET /api/v1/me/reviews`, `GET /api/v1/profiles/:userId/reviews` — user-authored and public received reviews; one review per participant after completion.
- `POST /api/v1/reports`, `GET /api/v1/me/reports`, `POST /api/v1/blocks`, `GET /api/v1/me/blocks` — reporting and blocking.
- `GET /api/v1/admin/listings/pending`, `POST /api/v1/admin/listings/:listingId/moderate`, `GET /api/v1/admin/reports`, `POST /api/v1/admin/reports/:reportId/resolve` — queues restricted to server-assigned moderator/admin roles; actions are recorded.

Private endpoints require a validated bearer JWT. No endpoint returns phone numbers or email addresses.

## Frontend connection

See [API 接入说明](../docs/API接入说明.md). For local development, set `VITE_API_BASE_URL=/api` and `API_PROXY_TARGET=http://127.0.0.1:8080` in an untracked `.env.local`; Vite proxies `/api/*` to the backend. The API listens on `0.0.0.0:8080` by default. A direct cross-origin API origin can be used if the server has a precise CORS allowlist and HTTPS.

The listing form clearly warns that object storage is not wired: a selected image is only a local preview and the current API flow submits a prototype placeholder image key. Do not treat this as real upload functionality.

## Local setup (requires PostgreSQL and a trusted JWT issuer)

```sh
cp server/config.example.env server/.env
# Edit server/.env securely; do not commit it.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/001_initial.sql
node --env-file=server/.env server/index.mjs
```

Put the API behind an HTTPS reverse proxy; do not expose PostgreSQL publicly. `DATABASE_URL`, signing keys, and provider secrets must remain server-side. The browser may receive only public API URLs and provider-approved publishable keys.

After a trusted operator account has signed in and its profile row exists, grant moderation access through a privileged database operation, for example:

```sql
UPDATE profiles SET account_role = 'admin' WHERE auth_subject = '<verified-provider-subject>';
```

There is intentionally no self-service role-promotion endpoint.

## Authentication integration boundary

The API verifies bearer JWTs through `AUTH_JWKS_URL`, `AUTH_ISSUER`, and `AUTH_AUDIENCE`. Phone/email registration, SMS delivery, email verification, password reset, CAPTCHA, and final Mainland identity-provider configuration are not selected or configured. Do not point this service at a production identity provider until issuer, audience, JWKS rotation, and account lifecycle have been integration-tested.

## Verification status and remaining work

- `npm test` covers the API client/repository mappings, Fastify routes, the in-memory repository, and PostgreSQL SQL paths using PGlite.
- PGlite checks SQL compatibility but is not a substitute for a real PostgreSQL deployment, concurrency/load tests, backups, or recovery drills. No real database is configured here.
- The local demo mode remains available and stores data only in the current browser. API mode is an opt-in client integration, not a hosted multi-user service.
- Object-storage uploads, SMS/email and identity-provider setup, user deletion/export, retention controls, production abuse limits, observability, operations/runbooks, and moderation/appeals UI remain unfinished.
- This code does not itself satisfy ICP/app filing or establish that an individual operator may publicly run this service.
