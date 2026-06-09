# HTML Share Vault

Password-protected HTML sharing for internal review, built for Cloudflare Pages, Pages Functions, and Workers KV.

Production: https://html-share-vault.pages.dev/

## What it does

- Admin uploads a `.html` file from `/`.
- The app stores the HTML and password hash in a Cloudflare KV namespace.
- The admin shares `/share/<id>` and the viewer password.
- Viewers enter the password and then see the uploaded HTML rendered inline.

## Cloudflare setup

1. Create a KV namespace for production and preview.
2. Copy `wrangler.example.toml` to `wrangler.toml` and put the namespace IDs into the copy. `wrangler.toml` is ignored so local IDs do not become repo defaults.
3. Set an admin upload secret:

   ```powershell
   npx wrangler pages secret put ADMIN_TOKEN --project-name html-share-vault
   ```

4. Deploy:

   ```powershell
   npm run deploy
   ```

## GitHub Actions deploy

The repo includes `.github/workflows/deploy-cloudflare-pages.yml`. To enable it, set these GitHub repository secrets and variables:

- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `CLOUDFLARE_ACCOUNT_ID`
- Variable: `CLOUDFLARE_PAGES_PROJECT_NAME`

The workflow runs `npm run check`, `npm test`, builds Pages Functions, then deploys `public/` with Wrangler. Keep the `HTML_SHARES` KV binding and `ADMIN_TOKEN` Pages secret configured in Cloudflare.

For local development:

```powershell
npm install
npx wrangler pages dev public --compatibility-date=2026-06-09 --kv=HTML_SHARES --binding ADMIN_TOKEN=<local-admin-token>
```

Then open `http://localhost:8788`.

Use the same admin token value in the upload form.

## Security notes

- This is for trusted internal HTML review. Uploaded HTML is rendered as HTML, so only upload files you trust.
- The viewer password is never stored directly; the app stores a salted PBKDF2-SHA-256 hash.
- Viewer passwords must be at least 14 characters.
- PBKDF2 uses 10,000 iterations to fit Cloudflare Workers free-tier CPU limits. Treat this as a low-to-medium sensitivity internal sharing tool; use a paid Workers plan or a stronger storage/auth design for highly confidential material.
- Access is remembered for 8 hours with an HttpOnly cookie.
- KV values are limited to 25 MiB, so this app rejects uploads above 24 MiB.
