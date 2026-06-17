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
- `wrangler.example.toml`: example Cloudflare Pages and KV binding config; copy to ignored `wrangler.toml` for local deploys.

## Build / test / lint

- install: `npm install`
- dev: `npm run dev`
- test: `npm test`
- syntax check: `npm run check`
- deploy: `npm run deploy`

## Repo-specific hard rules

- Inherits all Hard Rules from `~/work/agent-context/AGENTS.MD`.
- Inherits all Constitutional rules from `~/work/agent-context/CONSTITUTION.md`. If a rule below contradicts the constitution, the constitution wins.
- Never commit Cloudflare tokens, KV IDs beyond namespace identifiers, or admin passwords. Configure `ADMIN_TOKEN` through Cloudflare Pages secrets.
- Uploaded HTML is intentionally rendered inline after password verification; do not add sanitization that rewrites customer HTML unless the product goal changes.
- Keep upload size below Workers KV's value limit. The app currently rejects payloads above 24 MiB.
- Keep `wrangler.toml` ignored unless the operator explicitly wants environment-specific namespace IDs committed.

## Verification

- `npm run check`
- `npm test`

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
