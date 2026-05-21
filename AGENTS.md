<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:origin-repo-targets -->
# Origin repo targets — push policy

This working tree (`/Users/xyx/Projects/Origin/V1`) is the **Origin monorepo**. There are two GitHub remotes that ship code, and which one(s) you push to depends entirely on **what part of the tree changed**.

## Remotes

- **Origin main monorepo** — `https://github.com/diprajorigin/ORIGIN-V1.0` (git remote: `origin`)
  - Holds everything: `new-frontend/`, `analytics-service/`, `grader-service/`, `origin-ai/`, infra, docs.
  - Default base branch: `main`.
- **Vercel deployment repo** — `https://github.com/2003origin-spec/origin_frnt` (git remote: `vercel`)
  - Holds **only the Next.js app** (the contents of `new-frontend/`), unprefixed at the repo root (so Vercel can build it directly from `/`).
  - Default base branch: `main`.

When the user says "the main origin repo" they mean `diprajorigin/ORIGIN-V1.0`. When they say "the Vercel deployment repo" they mean `2003origin-spec/origin_frnt`. Do not ask which repo to push to unless the change set is mixed in a way the rules below cannot resolve.

## Push policy by change set

Inspect `git diff` paths against `origin/main` and decide:

| Files changed | Push to monorepo? | Push to Vercel repo? |
|---|---|---|
| Anything under `new-frontend/` only | ✅ yes | ✅ yes — with `new-frontend/` prefix stripped |
| Anything under `analytics-service/`, `grader-service/`, `origin-ai/`, or any other top-level microservice | ✅ yes | ❌ **no** |
| Both `new-frontend/` **and** a microservice in the same commit | ✅ yes | ✅ yes — **but only the `new-frontend/` slice** (cherry-pick or split before syncing) |
| Top-level docs/infra (`README.md`, `.github/`, `ARCHITECTURE.md`, etc.) not under `new-frontend/` | ✅ yes | ❌ no |

The rule of thumb: **the Vercel repo only ever sees Next.js code**. Microservice changes never go to Vercel — they're independent services with their own deploy pipelines.

## Path translation

Monorepo path → Vercel repo path:

- `new-frontend/src/foo` → `src/foo`
- `new-frontend/package.json` → `package.json`
- `new-frontend/src/db/migrations/X.sql` → `src/db/migrations/X.sql`
- etc.

To generate a path-stripped patch from a monorepo commit:

```bash
git format-patch -1 <sha> --stdout \
  | sed -E 's| a/new-frontend/| a/|g; s| b/new-frontend/| b/|g; s|^(--- a/)new-frontend/|\1|; s|^(\+\+\+ b/)new-frontend/|\1|; s|^(rename from )new-frontend/|\1|; s|^(rename to )new-frontend/|\1|' \
  > /tmp/sync.patch
```

Apply against a clean clone of the Vercel repo with `git apply /tmp/sync.patch`. A pre-existing checkout of the Vercel repo lives at `/tmp/origin-frnt-work/origin_frnt` — use it directly when it's on a clean `main`.

## Workflow for a frontend/backend change

1. Branch off `origin/main` in this working tree.
2. Make the changes inside `new-frontend/`.
3. Verify locally: `cd new-frontend && npm run typecheck && npm run test:unit && npm run lint`.
4. Commit, push to `origin` (monorepo), open PR against `diprajorigin/ORIGIN-V1.0:main`.
5. Generate the path-stripped patch (see snippet above).
6. In the Vercel-repo clone at `/tmp/origin-frnt-work/origin_frnt`, fetch `main`, create the **same-named branch**, apply the patch, run `npm run typecheck && npm run test:unit` to confirm, commit with the same message, push, open PR against `2003origin-spec/origin_frnt:main`.
7. If the change is hotfix-grade and the user wants it live immediately, `vercel promote <preview-url>` from the Vercel-repo clone (see Vercel CLI section). Otherwise wait for merge.

## Workflow for a microservice change

1. Branch off `origin/main`, make the changes inside the service directory (e.g. `grader-service/`).
2. Run the service's own test/lint suite (varies per service — check its README).
3. Commit, push to `origin`, open PR against `diprajorigin/ORIGIN-V1.0:main`.
4. **Do not touch the Vercel repo.** The microservice has its own deploy pipeline.

## Deployment guardrails

When syncing to the Vercel repo, the next Vercel build must succeed and the new feature must work end-to-end. This means changes must keep working with:

- **Neon Postgres** — schemas referenced by `USER_DATABASE_URL` and `OGCODE_DATABASE_URL` (which in this deployment point at the same physical DB so that cross-schema FKs from `rooms.rooms` to `app.teacher_workspaces` / `assessment.tests` validate).
- **Upstash Redis** — session/cache key shape is shared across services.
- **Cloudflare R2** — bucket and object-key conventions used by `content.assets` and the import pipeline.
- **Microservices** — `analytics-service`, `grader-service`, `origin-ai` are consumed by HTTP, so request/response contracts must remain compatible.

If a frontend change requires a microservice change to function (or vice versa), ship the microservice PR first, wait for its deploy, then ship the frontend PR. Do not merge a frontend change that breaks a current-deployment microservice contract.
<!-- END:origin-repo-targets -->

<!-- BEGIN:vercel-cli-access -->
# Vercel CLI access — driving the deploy directly

Claude (and other agents) have **full Vercel CLI access** for the `origin-frnt` project on the `origin-s-projects` team. Use it rather than asking the user to fiddle with the dashboard.

## How auth is wired

- A long-lived token is exported as `VERCEL_TOKEN` in `~/.zshrc`. Pass `--token "$VERCEL_TOKEN"` to every CLI call so it works in non-interactive shells.
- The token is owner-scoped on team `origin-s-projects` (id: `team_eXTnOmRf20W25agj9sdoxqIa`).
- Project: `origin-frnt` (id: `prj_XOSyIo6k6J3EE4Ol6WYZk51IIoVL`). Production aliases: `www.o3origin.com`, `o3origin.com`, `origin-frnt.vercel.app`.
- Two working trees are linked (have `.vercel/project.json`): `/Users/xyx/Projects/Origin/V1/new-frontend` (monorepo) and `/tmp/origin-frnt-work/origin_frnt` (deploy-repo clone). Run CLI commands from inside one of these.
- `.claude/settings.json` allowlists `Bash(npx vercel:*)` and `Bash(vercel:*)` so the harness doesn't prompt per call.

## Common commands

```bash
# Verify token works (should print account 2003origin-7709)
npx vercel@latest whoami --token "$VERCEL_TOKEN"

# List recent deployments
npx vercel@latest ls --token "$VERCEL_TOKEN" --scope origin-s-projects

# Inspect env vars
npx vercel@latest env ls production --token "$VERCEL_TOKEN"
npx vercel@latest env ls preview    --token "$VERCEL_TOKEN"

# Promote a preview to production (interactive prompt — pipe "y")
echo y | npx vercel@latest promote https://origin-frnt-<id>-origin-s-projects.vercel.app \
  --scope origin-s-projects --token "$VERCEL_TOKEN"

# Trigger a fresh deployment from the current dir (rare — usually GitHub push handles this)
npx vercel@latest deploy --prod --token "$VERCEL_TOKEN"

# Pull current production env into a local .env.production.local
npx vercel@latest env pull .env.production.local --environment=production \
  --yes --token "$VERCEL_TOKEN"
```

## Polling deployment state without burning cache

Don't `vercel ls` in a loop. Use the API directly with the deployment URL:

```bash
curl -s "https://api.vercel.com/v13/deployments/<host>?teamId=team_eXTnOmRf20W25agj9sdoxqIa" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('readyState'))"
```

Wrap in a bounded `until`-loop and sleep 20s between polls. Builds typically finish in 1–3 minutes.

## Env-var quirks worth knowing

- **Sensitive vars are write-only.** Every existing var on this project is `"type": "sensitive"` — `vercel env pull` and the API return empty strings for them. You cannot read the real value back via the CLI, only the user/dashboard can. If you need to *propagate* sensitive vars to a new environment, **don't try to copy values** — `PATCH /v10/projects/{id}/env/{envId}` with an updated `target` array (e.g. add `"preview"` to the existing `["production"]`). Same encrypted value, more environments.
- **Adding a new env var:** `vercel env add NAME preview --value <value> --yes --token …`. Without `--value` you'll hit a "missing_value" rejection in non-interactive mode.
- **Vercel auto-injects** its own system vars (`VERCEL_*`, `TURBO_*`, `NX_*`) on every build — never set those yourself.
- **Build-time vars** (anything beginning with `NEXT_PUBLIC_`) bake into the bundle at build time. Changing them requires a redeploy, not a re-read.

## Feature flags currently set

All seven Phase 1–6 flags are enabled on **production** *and* **preview**:

```
TEACHER_LAUNCH_WORKSPACES=1
TEACHER_LAUNCH_ORG_CODES=1
TEACHER_LAUNCH_ENROLLMENT=1
TEACHER_LAUNCH_BATCHES=1
TEACHER_LAUNCH_QUESTION_BAG=1
TEACHER_LAUNCH_TEACHER_TESTS=1
TEACHER_LAUNCH_TEACHER_ROOMS=1
```

Phase 7+ flags (`STUDY_MATERIALS`, `TEACHER_ANALYTICS`, `OGCODE_PUBLISHING`, `DOCUMENT_IMPORT`, `ADMIN_CONTROL`, `PAID_ENROLLMENT`) are **not** set, so they fall back to `defaultProd: false`. Add them when those phases ship.

## When to use this access

- **Diagnosing prod-only bugs** → `vercel ls` + `vercel inspect --logs <url>` to read function logs.
- **Env var was set but the deploy doesn't see it** → confirm the var's `target` list includes the environment you're testing, then trigger a redeploy (env changes don't auto-rebuild).
- **Hotfix needs to go live before the PR merges** → after the user approves the change, `vercel promote <preview-url>` from the Vercel-repo clone.
- **Preview URL keeps 404'ing or showing auth wall** → the `_vercel_sso_nonce` cookie is normal (SSO Protection); confirm with `curl -sI <url>` showing `HTTP/2 401` + that cookie before suggesting the user "log into Vercel first".

## When NOT to use this access

- **Don't promote to production without explicit user approval.** Promotion is destructive (it serves user-facing traffic). Confirm first unless the user just said "ship it" in the same turn.
- **Don't pull `.env.production.local` and commit it.** `.gitignore` already covers `.env*` but double-check.
- **Don't print the token value.** The token is in `$VERCEL_TOKEN` — reference it, don't echo it.
<!-- END:vercel-cli-access -->
