# Cloudflare Pages + KV Evidence

Retrieval date: 2026-06-09
Local version: `wrangler@4.98.0` from `npm ls wrangler --depth=0`

## Sources

- Cloudflare Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare KV write API and limits: https://developers.cloudflare.com/kv/api/write-key-value-pairs/

## Decisions

- Use Cloudflare Pages Functions because the app needs static upload UI plus server-side password verification.
- Use Workers KV through a Pages Function binding named `HTML_SHARES`.
- Store one uploaded HTML record per random share ID.
- Reject uploads above 24 MiB because Workers KV values are limited to 25 MiB.
- Use `wrangler pages deploy public --project-name=html-share-vault` because `wrangler pages publish` is deprecated and current docs point to deploy commands.

## Verification

- `npm run check`: passed.
- `npm test`: passed, 4 tests.
- `npx wrangler pages functions build --outdir .wrangler-build`: compiled Worker successfully.
- Local Pages dev with `--kv=HTML_SHARES --binding ADMIN_TOKEN=...`: upload returned a share ID, unauthenticated GET returned the password form, correct password POST returned the uploaded HTML, wrong password POST returned 401.
- `npx wrangler whoami`: not authenticated, so deployment was not attempted.

## Risk And Rollback

- Risk: missing `ADMIN_TOKEN` secret or `HTML_SHARES` binding causes runtime failure.
- Rollback: Cloudflare Pages can roll back to a previous deployment in the dashboard, or redeploy a previous Git commit.
- Next refresh date: 2026-07-09.
