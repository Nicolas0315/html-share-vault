# Star Repo Scraping Artifact Host Boundary

Date: 2026-06-30

## Goal

Record whether `html-share-vault` should be used in the scraping-repo application work. The answer is narrow: it is not a scraper, crawler, browser runner, provider adapter, or data normalizer. It can only be used as a password-protected HTML artifact host for already-generated, sanitized scraping reports.

## Context

The broader scraping research is analyzing starred repositories from `Nicolas0315` and checking how they apply to local/M5Max receiver repositories. The public HTML / product-page lane referenced `cap-creator-ranking`, but that repository is not present locally on this Windows node. `html-share-vault` was inspected only because it is the closest local HTML-related repository.

## Boundary

Allowed use:

- host sanitized HTML summaries of scraping research;
- share generated reports with reviewer passwords;
- store aggregate documentation artifacts that contain no secrets, raw scraped rows, session data, credentials, cookies, browser profiles, or identifiable social data.

Disallowed use:

- no scraping or crawling;
- no provider/API/session/browser runtime;
- no transformation of raw scraped datasets;
- no use as a replacement for `cap-creator-ranking` product-page parser fixtures;
- no Cloudflare deploy, KV mutation, or secret configuration from this research pass.

## Verification

Executed locally on 2026-06-30:

- `npm run check`
  - passed; syntax checked Pages Functions files.
- `npm test`
  - passed; 7 Node tests passed.

## Decision

Keep `html-share-vault` out of the acquisition pipeline. If later reports need a password-protected review URL, use it only after the report has been sanitized and generated elsewhere.

## Remaining Work

- If `cap-creator-ranking` becomes available, inspect that repository directly for public HTML/product parser fixtures.
- Do not substitute `html-share-vault` for product-page extraction.
