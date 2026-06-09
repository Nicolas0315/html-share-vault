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
