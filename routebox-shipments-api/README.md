# routebox-shipments-api

Customer-facing REST API for Routebox shipment lifecycle. The main service.

Node.js (Express). Talks to the shared Postgres for persistence, posts to an internal SQS queue that `route-optimizer` consumes for route calculation, and exposes a few internal endpoints used by other services and the data team.

> Read [`routebox-platform-docs`](https://github.com/312school/routebox-platform-docs) first if you haven't. This README assumes you know what Routebox is and how the platform is laid out.

## What this service does

- Public REST API for shipment create / read / update (`/v1/shipments/*`)
- Webhook receiver for customer integration callbacks (`/v1/webhooks/*`)
- Health and readiness endpoints (`/healthz`, `/readyz`)
- An internal endpoint, `/internal/legacy-export`, that the data team uses for warehouse syncing — see notes below

## Repo layout

```
.
├── src/
│   ├── routes/
│   ├── services/
│   ├── db/
│   ├── middleware/
│   └── index.js
├── test/
├── Dockerfile
├── docker-compose.yml      # local dev — brings up the service + Postgres
├── Jenkinsfile             # CI/CD via routebox-jenkins shared library
├── package.json
└── README.md
```

## Running locally

```
docker compose up
```

This brings up Postgres (with the schema from [`routebox-db-migrations`](https://github.com/312school/routebox-db-migrations) applied) and the service on `localhost:3000`. The compose file is up to date for this service. Some of the other services' compose files have rotted; this one hasn't.

## Deploys

CI/CD via Jenkins. The `Jenkinsfile` imports the shared library from [`routebox-jenkins`](https://github.com/312school/routebox-jenkins) and calls `buildAndPushImage` and `deployToEcs`. Push to `main` deploys to dev. Tagged releases (`v*`) progress through staging and prod with manual approval gates.

The image gets tagged with the git SHA and pushed to ECR. Tags are mutable in this org, which has bitten us at least once. Don't overwrite a `v1.x` tag with a hotfix.

## Database

Connects to the shared Postgres. This service writes to:

- `shipments`
- `shipment_events`
- `shipment_status_history`

It reads from various tables owned by `ops-console` (users, accounts, tenants). There's no enforcement of these boundaries — see [`routebox-db-migrations/docs/schema-ownership.md`](https://github.com/312school/routebox-db-migrations) for the social contract.

## `/internal/legacy-export`

This endpoint is undocumented in the public API docs because it isn't really supported. It dumps a flattened shipment view that the data team uses for nightly warehouse syncs. It's a CSV-streaming endpoint and it bypasses the normal request validation path.

**Don't remove it without talking to `#data-platform`.** Last time we tried to clean it up the warehouse sync broke for two days.

The endpoint is only reachable from inside the VPC (security group rule on the ALB). It is, however, unauthenticated within the VPC. This is an open finding in our security review. We've talked about putting it behind an internal-only auth path. We haven't.

## Configuration

Environment variables, mostly. The full list is in `src/config.js`. The interesting ones:

- `DATABASE_URL` — connection string, pulled from Secrets Manager at boot
- `SQS_QUEUE_URL` — for posting route-calc requests
- `LOG_LEVEL` — default `info`
- `LEGACY_EXPORT_ENABLED` — toggle for the `/internal/legacy-export` endpoint, default `true` in all envs

## Known issues

- Tests are slow (~4 minutes for the suite). Most of that is integration tests that spin up real Postgres. Speeding them up has been a TODO for a long time.
- The webhook receiver doesn't dedupe — if a customer's system retries, we'll process twice. We've shipped at-least-once semantics to customers and call it intentional. It mostly is.
- Some routes use `async/await`, others use callback style. The codebase predates the consistency push. Fix it on touch.

For broader context, read [`routebox-platform-docs/notes/handover.md`](https://github.com/312school/routebox-platform-docs/blob/main/notes/handover.md).
