import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidHtmlUpload,
  buildShareRecord,
  hasAccessCookie,
  isPasswordValid,
  normalizeFileName,
  timingSafeEqualString
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
