# App Run Guide

This runbook is for teammates running the ORIGIN V1 stack locally from the `V1` repo. The local database is Dockerized with `pgvector`, and this branch includes a committed vector seed so teammates can load Origin AI concepts without regenerating embeddings.

## Stack

- Docker PostgreSQL with `pgvector`
- `grader-service`
- `origin-ai`
- `analytics-service`
- `new-frontend`

## Requirements

- Docker Desktop
- Node.js + npm
- Python 3.13 for the Python services

Do not use Python 3.14 for these service virtualenvs. The pinned dependency set still expects Python 3.13-compatible wheels.

## Paths

Set the repo root once per terminal, replacing the path if your checkout lives elsewhere:

```bash
export ORIGIN_ROOT=/Users/xyx/Projects/Origin/V1
```

## One-Time Setup

### Frontend

```bash
cd "$ORIGIN_ROOT/new-frontend"
npm install
cp -n .env.example .env.local
```

### Docker Postgres + OGCode + Origin AI Vectors

Start the shared local Postgres container, import the OGCode bank, then import the prebuilt pgvector seed:

```bash
cd "$ORIGIN_ROOT/new-frontend"
docker compose -f docker-compose.postgres.yml up -d postgres
npm run ogcode:import:replace
npm run origin-ai:vectors:import:replace -- --file data/origin-ai-vector-seed.json.gz
```

The vector import loads:

- `origin_ai.concept_embeddings`
- `origin_ai.ogcode_embeddings`

Teammates do not need a Gemini embeddings quota for this import. They only need a valid Gemini key for live text, voice, and future seed generation.

### Analytics Service

```bash
cd "$ORIGIN_ROOT/analytics-service"
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp -n .env.example .env
```

### Origin Diagnostic Graph (ODG) Seed

After setting up the Analytics Service, seed the ODG concept graph (this creates the `odg.*` schema and loads the curriculum concepts):

```bash
cd "$ORIGIN_ROOT/analytics-service"
.venv/bin/python -m scripts.seed_odg
```

### Grader Service

```bash
cd "$ORIGIN_ROOT/grader-service"
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp -n .env.example .env
```

### Origin AI Service

```bash
cd "$ORIGIN_ROOT/origin-ai"
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp -n .env.example .env
```

## Environment Notes

### `new-frontend/.env.local`

Keep the database URLs pointed at the Docker Postgres container:

```env
USER_DATABASE_URL=postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode
OGCODE_DATABASE_URL=postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode
ORIGIN_AI_DATABASE_URL=postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode
GRADER_SERVICE_URL=http://127.0.0.1:8010
GRADER_SERVICE_TOKEN=dev-internal-token
ANALYTICS_SERVICE_URL=http://127.0.0.1:8030
ANALYTICS_SERVICE_TOKEN=dev-analytics-token
ORIGIN_AI_SERVICE_URL=http://127.0.0.1:8020
ORIGIN_AI_SERVICE_TOKEN=dev-origin-ai-token
NEXT_PUBLIC_ORIGIN_AI_URL=http://127.0.0.1:8020
AUTH_JWT_SECRET_CURRENT=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY
ROOM_CODE_SECRET=local-room-code-secret-123456789012
OPTION_SHUFFLE_SECRET=local-option-shuffle-secret-123456789012
INTERNAL_CRON_TOKEN=local-internal-cron-token-123456789012
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Do not set `GEMINI_API_KEY` in `new-frontend/.env.local`. The normal flow calls the Python `origin-ai` service, and only that service owns provider API keys.

Do not set Upstash Redis values for local development. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are production-only rate-limit/room-presence settings; local development falls back without them.

Do not set Cloudflare R2 keys for normal local development. `R2_*` variables are production media-storage settings and should stay server-only when configured.

Authentication uses short-lived JWT access cookies plus DB-backed rotating refresh sessions. `AUTH_JWT_SECRET_CURRENT` must be a base64url-encoded 32+ byte secret; the sample value above decodes to a local-only 32-byte development secret. Set `AUTH_JWT_SECRET_PREVIOUS` only during JWT key rotation, then remove it after old 10-minute access tokens expire. `ROOM_CODE_SECRET` signs study-room invite tokens, and `OPTION_SHUFFLE_SECRET` signs option-presentation tokens for answer shuffling.

### `origin-ai/.env`

Use the asyncpg URL for the Python service:

```env
ORIGIN_AI_DATABASE_URL=postgresql+asyncpg://origin:origin123@127.0.0.1:54329/origin_v1_ogcode
ORIGIN_AI_SERVICE_TOKEN=dev-origin-ai-token
GEMINI_API_KEY=your_key_here
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001
GOOGLE_EMBEDDING_DIMENSIONS=1536
```

Do not add `DJANGO_*` variables here. Origin AI now accepts only the trusted Next.js service-proxy path (`ORIGIN_AI_SERVICE_TOKEN` plus forwarded user headers).

### `grader-service/.env`

```env
GRADER_DATABASE_URL=postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode
GRADER_SERVICE_TOKEN=dev-internal-token
GRADER_TRACE_WRITES_ENABLED=true
GRADER_STORE_DERIVED_SPECS=true
GRADER_LOG_LEVEL=INFO
```

### `analytics-service/.env`

```env
ANALYTICS_DATABASE_URL=postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode
ANALYTICS_SERVICE_TOKEN=dev-analytics-token
ANALYTICS_LOG_LEVEL=INFO
# Origin Diagnostic Graph (ODG) feature flags (optional, off by default)
ODG_ENABLED=true
ODG_ERROR_CLASSIFY=false
ODG_TEACHER_COEFF=false
ODG_DECAY=false
# GEMINI_API_KEY=your_key_here # Required if ODG_ERROR_CLASSIFY is true
# ORIGIN_AI_DATABASE_URL=postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode # Optional, for Phase 4 decay sync
```

Do not commit real `.env` or `.env.local` files.

## Run The App

Use 5 terminals.

### Terminal 1: PostgreSQL

```bash
cd "$ORIGIN_ROOT/new-frontend"
docker compose -f docker-compose.postgres.yml up -d postgres
```

### Terminal 2: Grader Service

```bash
cd "$ORIGIN_ROOT/grader-service"
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload
```

### Terminal 3: Origin AI Service

```bash
cd "$ORIGIN_ROOT/origin-ai"
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8020 --reload
```

### Terminal 4: Analytics Service

```bash
cd "$ORIGIN_ROOT/analytics-service"
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8030 --reload
```

### Terminal 5: Next.js App

```bash
cd "$ORIGIN_ROOT/new-frontend"
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

## Maintainer Vector Refresh

Only run this when intentionally regenerating the shared vector seed with a valid Gemini key that has `gemini-embedding-001` access:

```bash
cd "$ORIGIN_ROOT/new-frontend"
npm run origin-ai:seed-embeddings:replace
npm run origin-ai:vectors:export -- --out data/origin-ai-vector-seed.json.gz
```

After exporting, verify the counts printed by the command before committing the seed file.

## Health Checks

```bash
curl -sS http://127.0.0.1:8020/health
curl -sS "http://127.0.0.1:8020/api/v1/chapters?subject=phy"
```

The chapter response should show non-zero `conceptCount` values after the vector seed import.

## Login

```text
student@origin.test / password123
teacher@origin.test / password123
```

For duplicate-email accounts, choose role first at:

```text
http://127.0.0.1:3000/role-selection
```

Then use:

```text
tohin1400@gmail.com / 123456
ayushzz0306@gmail.com / Ap@1234
```

## Smoke Test Checklist

1. Log in.
2. Open AI Explainer and confirm chapters show non-zero concept counts.
3. Open OGCode and confirm the question bank loads.
4. Open Tests and create a custom test.
5. Submit the test and confirm analytics/DPP data appears (including ODG traced prerequisites if ODG is enabled).
6. Open Doubt Solver and confirm Origin AI responds.
7. Open voice mode and confirm TTS still returns audio.

## CI/CD

Deployment automation lives in `CI_CD_PIPELINE.md`.

Before opening deployment PRs, run the local release checks in that file. GitHub Actions runs the same core gates on PRs and triggers deployment from `main` only after CI succeeds.

For deployment work, also confirm the Docker/compose contracts:

```bash
cd "$ORIGIN_ROOT"
scripts/ci/secret-scan.sh
scripts/ci/validate-deployment-assets.sh
docker compose -f docker-compose.ci.yml config
docker compose -f docker-compose.ci.yml build frontend origin-ai grader-service analytics-service
```

If Docker Desktop reports a local BuildKit/containerd filesystem or socket error, restart Docker Desktop and rerun the Docker build. The CI workflow performs the same Docker image validation on GitHub-hosted runners.

## Cloud Deployment Readiness

The production target is:

- Vercel for `new-frontend` frontend and Next.js API routes
- GCP Cloud Run for `origin-ai`, `grader-service`, and `analytics-service`
- Neon Postgres with `pgvector`
- Cloudflare R2 for uploaded/public media
- Upstash Redis REST for production rate limiting and room/presence state

Before shipping to cloud providers, complete these manual platform items:

1. Create the Neon databases and enable `vector` on the `origin_ai` database.
2. Import OGCode questions and the committed Origin AI vector seed into Neon.
3. Apply the ODG migrations (`new-frontend/src/db/migrations/20260708_odg_*.sql`) to the analytics database and run `python -m scripts.seed_odg` to ingest the concept graph.
4. Create Cloud Run services once with all runtime env vars set, including service tokens and provider keys.
5. Set `CORS_ALLOWED_ORIGINS=https://<production-domain>` on `origin-ai` if any direct browser-to-origin-ai calls are enabled.
6. Keep `grader-service` and `analytics-service` server-to-server only; they do not need browser CORS when called through Next.js API routes.
7. Configure Vercel env vars, including service URLs, matching service tokens, JWT secrets, Upstash, and R2.
8. Configure the R2 public hostname in Vercel as `NEXT_PUBLIC_R2_PUBLIC_HOSTNAME`.
9. Add GitHub Actions deployment secrets listed in `CI_CD_PIPELINE.md` (and ODG variables if enabling).
10. Run a production smoke test covering login, OGCode grading, test analytics/DPP generation, AI chat, image solving, and voice.

Cloud Run services are public HTTPS endpoints in this setup because Vercel calls them over the internet. Application-level bearer tokens still gate all non-health service routes. Do not expose service tokens to the browser or prefix them with `NEXT_PUBLIC_`.

## Common Issues

### AI Explainer Shows `0 concepts`

The Origin AI tables are empty or the service is pointed at a different database. Run:

```bash
cd "$ORIGIN_ROOT/new-frontend"
docker compose -f docker-compose.postgres.yml up -d postgres
npm run origin-ai:vectors:import:replace -- --file data/origin-ai-vector-seed.json.gz
```

Then restart `origin-ai`.

### `python-dotenv could not parse statement`

One of the `.env` files has invalid syntax. Common causes are unquoted values containing spaces or angle brackets, such as email sender strings. Quote them:

```env
EMAIL_FROM="ORIGIN AI <no-reply@example.com>"
```

### Gemini `429 RESOURCE_EXHAUSTED`

The Gemini key is valid but quota is exhausted. This blocks live text/voice generation and maintainer seed regeneration, but it does not block importing the committed vector seed.

### `httpx.ConnectError: nodename nor servname provided`

Check `.env` for malformed proxy, API endpoint, or host values. This is a networking/config issue, not a pgvector issue.

### Custom Tests Still Use Fallback Generation

- Check `new-frontend/.env.local` for `ANALYTICS_SERVICE_URL`.
- Confirm `analytics-service` is running on port `8030`.
- Confirm `ANALYTICS_SERVICE_TOKEN` matches in both services.

### No Speech Output In Voice Mode

- Check `GEMINI_API_KEY` in `origin-ai/.env`.
- Check the Origin AI service terminal for `/api/v1/voice/respond` and `/api/v1/voice/speak`.
- Browser speech fallback should still cover failed TTS.
