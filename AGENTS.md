# html-share-vault — Agent Context

Repo-specific delta. Global baseline: `~/work/agent-context/AGENTS.MD` (mirrored to `~/CLAUDE.md`, `~/AGENTS.md`, `~/GEMINI.md`).
This file overrides the global baseline only where stated; everything else inherits.

## What this repo is

Password-protected HTML sharing on Cloudflare Pages. Runtime is Pages Functions JavaScript with Workers KV storage. Deploy target is Cloudflare Pages project `html-share-vault`.

## Layout

- `public/`: static upload UI.
- `functions/`: Cloudflare Pages Functions API and share route.
- `functions/_lib/`: shared validation, hashing, and cookie helpers.
- `tests/`: Node built-in test suite for shared behavior.
- `scripts/`: `share.mjs` (CLI upload), `e2e.mjs` (boots wrangler and asserts real headers/auth).
- `skills/share-html/`: agent-facing entry point for the CLI.
- `wrangler.example.toml`: example Cloudflare Pages and KV binding config; copy to ignored `wrangler.toml` for local deploys.

## Build / test / lint

- install: `npm install`
- dev: `npm run dev`
- test: `npm test`
- syntax check: `npm run check`
- e2e (real runtime headers and auth): `npm run e2e`
- full gate: `npm run verify`
- deploy: `npm run deploy`

## Repo-specific hard rules

- Inherits all Hard Rules from `~/work/agent-context/AGENTS.MD`.
- Inherits all Constitutional rules from `~/work/agent-context/CONSTITUTION.md`. If a rule below contradicts the constitution, the constitution wins.
- Never commit Cloudflare tokens, KV IDs beyond namespace identifiers, or admin passwords. Configure `ADMIN_TOKEN` through Cloudflare Pages secrets.
- Uploaded HTML is intentionally rendered inline after password verification; do not add sanitization that rewrites customer HTML unless the product goal changes. The isolation boundary is the `sandbox` CSP in `functions/_lib/share.js`, not sanitization — never add `allow-same-origin` to it.
- Every share carries a TTL. `env.HTML_SHARES.put` on an existing record must go through `putOptions()`, otherwise the rewrite silently turns an expiring share into a permanent one.
- Keep upload size below Workers KV's value limit. The app currently rejects payloads above 24 MiB.
- Keep `wrangler.toml` ignored unless the operator explicitly wants environment-specific namespace IDs committed.

## Verification

- `npm run verify` (check + unit + real-runtime e2e). Unit tests alone never clear a change to
  headers, auth, or KV writes — the e2e is the one that sees them.
- Verification matrix and the optimization loop: `docs/optimization-plan-2026-08-16.md`.

## Drift guard

This repo opts into the shared pre-commit hook:

```bash
git config core.hooksPath ~/work/agent-context/hooks
```

The hook blocks staged `.env`, `*.key`, `*.pem`, `credentials.json`, `token.json`, `*.bak-<ts>*`, and high-confidence secret patterns (`sk-(ant|proj|live)-…`, `AIza…`, `ghp_…`, `gho_…`, `xox[abp]-…`, `AKIA…`, PEM blocks). It also validates JSON syntax for `*.mcp.json`, `*/settings.json`, `package.json`, and Claude plugin manifests.

## Read Order (for agents)

1. This file.
2. `~/work/agent-context/AGENTS.MD` (global baseline).
3. `~/work/agent-context/CONSTITUTION.md` (constitutional subset).
4. Relevant subdir `AGENTS.md` if present.
5. Official docs per the Official Docs Gate.

## NEEDS_REVIEW

When a multi-agent consensus check dissents, append the case to `NEEDS_REVIEW.md` at repo root. Constitutional dissent halts the change until the operator ratifies.
