# Cloudflare Pages + KV Evidence

Retrieval date: 2026-06-09
Local version: `wrangler@4.98.0` from `npm ls wrangler --depth=0`

## Sources

- Cloudflare Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages direct upload with CI: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
- Cloudflare KV write API and limits: https://developers.cloudflare.com/kv/api/write-key-value-pairs/
- Cloudflare Wrangler GitHub Action: https://github.com/cloudflare/wrangler-action
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/

## Decisions

- Use Cloudflare Pages Functions because the app needs static upload UI plus server-side password verification.
- Use Workers KV through a Pages Function binding named `HTML_SHARES`.
- Store one uploaded HTML record per random share ID.
- Reject uploads above 24 MiB because Workers KV values are limited to 25 MiB.
- Use `wrangler pages deploy public --project-name=html-share-vault` because `wrangler pages publish` is deprecated and current docs point to deploy commands.
- Add a GitHub Actions workflow using Cloudflare's official `cloudflare/wrangler-action` so deploy can run after repository secrets and variables are configured.
- Use PBKDF2-SHA-256 with 10,000 iterations so password hashing fits Cloudflare Workers free-tier CPU constraints during upload and password verification. This is below OWASP-style high-sensitivity password-storage guidance and is an intentional tradeoff for low-to-medium sensitivity internal HTML review, paired with a 14-character minimum viewer password. For highly confidential material, move to a paid Workers CPU budget or a stronger authentication/storage design.

## Verification

- `npm run check`: passed.
- `npm test`: passed, 4 tests.
- `npx wrangler pages functions build --outdir .wrangler-build`: compiled Worker successfully.
- Local Pages dev with `--kv=HTML_SHARES --binding ADMIN_TOKEN=...`: upload returned a share ID, unauthenticated GET returned the password form, correct password POST returned the uploaded HTML, wrong password POST returned 401.
- Cloudflare login completed with Wrangler OAuth for account `Katala`.
- Created Cloudflare Pages project `html-share-vault`.
- Created Workers KV namespaces for production and preview and bound production to `HTML_SHARES`.
- Set `ADMIN_TOKEN` as a Cloudflare Pages secret from a generated value stored in the local 1Password Private vault.
- Deployed production Pages site at `https://html-share-vault.pages.dev/`.
- Production smoke test passed: upload returned share ID `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, unauthenticated GET returned the password form, correct password POST returned uploaded HTML, wrong password POST returned 401.

## Risk And Rollback

- Risk: missing `ADMIN_TOKEN` secret or `HTML_SHARES` binding causes runtime failure.
- Rollback: Cloudflare Pages can roll back to a previous deployment in the dashboard, or redeploy a previous Git commit.
- Next refresh date: 2026-07-09.
