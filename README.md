# HTML Share Vault

Password-protected HTML sharing for internal review, built for Cloudflare Pages, Pages Functions, and Workers KV.

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

For local development:

```powershell
npm install
npm run dev
```

Then open `http://localhost:8788`.

## Security notes

- This is for trusted internal HTML review. Uploaded HTML is rendered as HTML, so only upload files you trust.
- The viewer password is never stored directly; the app stores a salted PBKDF2-SHA-256 hash.
- Access is remembered for 8 hours with an HttpOnly cookie.
- KV values are limited to 25 MiB, so this app rejects uploads above 24 MiB.
