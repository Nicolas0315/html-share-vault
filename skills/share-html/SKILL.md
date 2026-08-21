---
name: share-html
description: Use when the user wants to share a generated HTML file with someone — "このHTMLを共有して", "レポートのURLちょうだい", "パスワード付きで渡して". Uploads a local .html to the HTML Share Vault and returns a password-protected, expiring URL.
---

# share-html

Publishes one local `.html` file to the vault and prints the viewer URL, the generated
password, and the expiry. No browser, no token pasting.

## Prerequisites

- `HTML_SHARE_ADMIN_TOKEN` in the environment (1Password: `op://Katala-Agents/...`). Never echo it.
- `HTML_SHARE_BASE_URL` only when targeting something other than the production project.

## Use

```bash
npm run share -- path/to/report.html            # 7 days, generated password
npm run share -- path/to/report.html --days 1   # 1..90
```

Report back exactly three lines to the user: URL, password, expiry. The password is shown
once and is not recoverable — the vault stores only a PBKDF2 hash.

## Rules

- One HTML file per share. External CDN references stay remote; local `<img src="...">`
  siblings are **not** inlined, so a page that depends on local assets will render broken.
  Ask the user to inline them first, or share a self-contained file.
- Never pass `--password`. The generated 24-char value is stronger than anything typed.
- Uploaded HTML runs in an opaque origin (`sandbox allow-scripts`), so it cannot read the
  admin token, cookies, or other shares. Do not weaken that CSP to make a page work.
- No infinite shares. If someone asks for "no expiry", give 90 days and say why.
