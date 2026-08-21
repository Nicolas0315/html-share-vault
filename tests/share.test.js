import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidHtmlUpload,
  buildShareMetadata,
  buildShareRecord,
  hasAccessCookie,
  isValidShareId,
  isPasswordValid,
  normalizeFileName,
  putOptions,
  remainingTtlSeconds,
  resolveExpiry,
  SHARE_CSP,
  shareHtmlHeaders,
  timingSafeEqualString,
  updateRecordPassword
} from "../functions/_lib/share.js";

test("validates required upload fields", () => {
  assert.equal(assertValidHtmlUpload({ html: "", password: "long-password-123" }), "html is required");
  assert.equal(assertValidHtmlUpload({ html: "<h1>x</h1>", password: "short" }), "password must be at least 14 characters");
  assert.equal(assertValidHtmlUpload({ html: "<h1>x</h1>", password: "long-password-123" }), "");
});

test("normalizes unsafe filenames", () => {
  assert.equal(normalizeFileName("../sales<plan>.html"), ".._sales_plan_.html");
});

test("hashes and verifies share passwords", async () => {
  const record = await buildShareRecord({
    fileName: "demo.html",
    html: "<h1>demo</h1>",
    password: "long-password-123"
  });

  assert.equal(await isPasswordValid(record, "long-password-123"), true);
  assert.equal(await isPasswordValid(record, "wrong-password"), false);
});

test("builds list metadata without exposing password material", async () => {
  const record = await buildShareRecord({
    fileName: "demo.html",
    html: "<h1>demo</h1>",
    password: "long-password-123"
  });
  const metadata = buildShareMetadata(record);

  assert.equal(metadata.id, record.id);
  assert.equal(metadata.fileName, "demo.html");
  assert.equal(metadata.bytes, 13);
  assert.equal("passwordHash" in metadata, false);
  assert.equal("passwordSalt" in metadata, false);
});

test("updates viewer password without changing share id or html", async () => {
  const record = await buildShareRecord({
    fileName: "demo.html",
    html: "<h1>demo</h1>",
    password: "long-password-123"
  });
  const result = await updateRecordPassword(record, "new-long-password-456");

  assert.equal(result.record.id, record.id);
  assert.equal(result.record.html, record.html);
  assert.equal(await isPasswordValid(result.record, "new-long-password-456"), true);
  assert.equal(await isPasswordValid(result.record, "long-password-123"), false);
});

test("validates share ids for admin mutations", () => {
  assert.equal(isValidShareId("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), true);
  assert.equal(isValidShareId("../aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), false);
  assert.equal(isValidShareId("not-a-share-id"), false);
});

test("checks access cookie with constant-time string comparison helper", async () => {
  const record = await buildShareRecord({
    fileName: "demo.html",
    html: "<h1>demo</h1>",
    password: "long-password-123"
  });
  const request = new Request("https://example.com/share/id", {
    headers: { cookie: `other=1; html_share_${record.id}=${record.passwordHash}` }
  });

  assert.equal(timingSafeEqualString("same", "same"), true);
  assert.equal(timingSafeEqualString("same", "nope"), false);
  assert.equal(hasAccessCookie(request, record.id, record.passwordHash), true);
});

test("isolates uploaded html into an opaque origin", async () => {
  const record = await buildShareRecord({
    fileName: 'demo".html',
    html: "<h1>demo</h1>",
    password: "long-password-123"
  });
  const headers = shareHtmlHeaders(record);

  assert.match(SHARE_CSP, /sandbox allow-scripts/);
  assert.equal(SHARE_CSP.includes("allow-same-origin"), false);
  assert.equal(headers["content-security-policy"], SHARE_CSP);
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["content-disposition"], 'inline; filename="demo_.html"');
});

test("rejects expiry outside the allowed window", () => {
  assert.match(resolveExpiry(0).error, /between 1 and 90/);
  assert.match(resolveExpiry(91).error, /between 1 and 90/);
  assert.match(resolveExpiry(1.5).error, /between 1 and 90/);
  assert.match(resolveExpiry("nope").error, /between 1 and 90/);
});

test("defaults uploads to a 7 day expiry", () => {
  const now = new Date("2026-08-16T00:00:00.000Z");
  assert.equal(resolveExpiry(undefined, now).expiresAt, "2026-08-23T00:00:00.000Z");
  assert.equal(resolveExpiry(undefined, now).ttlSeconds, 604800);
  assert.equal(resolveExpiry(1, now).expiresAt, "2026-08-17T00:00:00.000Z");
});

test("keeps the original expiry when a record is rewritten", async () => {
  const now = new Date("2026-08-16T00:00:00.000Z");
  const record = await buildShareRecord({
    fileName: "demo.html",
    html: "<h1>demo</h1>",
    password: "long-password-123",
    expiresAt: resolveExpiry(30, now).expiresAt,
    now
  });
  const rewritten = (await updateRecordPassword(record, "new-long-password-456")).record;

  assert.equal(rewritten.expiresAt, record.expiresAt);
  assert.ok(putOptions(rewritten).expirationTtl > 0);
  assert.equal(putOptions(rewritten).metadata.expiresAt, record.expiresAt);
  // KV rejects a TTL under 60s, so a nearly-expired record must not round down to zero.
  assert.equal(remainingTtlSeconds("2026-08-16T00:00:01.000Z", now), 60);
  assert.equal(remainingTtlSeconds(""), undefined);
});
