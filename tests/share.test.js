import assert from "node:assert/strict";
import test from "node:test";
import {
  assertValidHtmlUpload,
  buildAccessCookie,
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

test("checks access cookie with a server-side eight-hour expiry", async () => {
  const id = "a".repeat(32), hash = "b".repeat(64), secret = "synthetic-session-signing-key";
  const now = 1_800_000_000_000;
  const cookie = (await buildAccessCookie(id, hash, secret, now)).split(";")[0];
  const request = new Request("https://example.com/share/id", { headers: { cookie } });
  assert.equal(await hasAccessCookie(request, id, hash, secret, now), true);
  assert.equal(await hasAccessCookie(request, id, hash, secret, now + 8 * 3600_000 - 1), true);
  assert.equal(await hasAccessCookie(request, id, hash, secret, now + 8 * 3600_000), false);
  assert.equal(await hasAccessCookie(request, id, hash, secret, now - 1), true);
  assert.equal(cookie.includes(hash), false);
  assert.equal(timingSafeEqualString("same", "same"), true);
  assert.equal(timingSafeEqualString("same", "nope"), false);
});

test("rejects tampering, legacy cookies, missing keys and rotated credentials", async () => {
  const id = "a".repeat(32), hash = "b".repeat(64), secret = "synthetic-session-signing-key";
  const now = 1_800_000_000_000;
  const cookie = (await buildAccessCookie(id, hash, secret, now)).split(";")[0];
  const req = (value) => new Request("https://example.com/share/id", { headers: { cookie: value } });
  assert.equal(await hasAccessCookie(req(cookie), id, "c".repeat(64), secret, now), false);
  assert.equal(await hasAccessCookie(req(cookie), id, hash, "rotated-synthetic-key", now), false);
  assert.equal(await hasAccessCookie(req(cookie), id, hash, "", now), false);
  assert.equal(await hasAccessCookie(req(cookie), "d".repeat(32), hash, secret, now), false);
  assert.equal(await hasAccessCookie(req(`html_share_${id}=${hash}`), id, hash, secret, now), false);
  const [name, value] = cookie.split("=");
  const [expiry, signature] = value.split(".");
  assert.equal(await hasAccessCookie(req(`${name}=${Number(expiry) + 3600}.${signature}`), id, hash, secret, now), false);
  assert.equal(await hasAccessCookie(req(`${name}=malformed`), id, hash, secret, now), false);
  await assert.rejects(buildAccessCookie(id, hash, "", now));
});

test("share route requires a valid session and rejects it after password rotation", async () => {
  const { onRequestGet, onRequestPost } = await import("../functions/share/[id].js");
  let record = await buildShareRecord({ fileName: "demo.html", html: "<h1>private</h1>", password: "long-password-123" });
  const env = { ADMIN_TOKEN: "synthetic-session-signing-key", HTML_SHARES: { get: async () => JSON.stringify(record) } };
  const params = { id: record.id };
  const url = `https://example.com/share/${record.id}`;
  const get = (cookie = "") => onRequestGet({ request: new Request(url, { headers: { cookie } }), env, params });
  assert.match(await (await get()).text(), /Password required/);
  const denied = await onRequestPost({ request: new Request(url, { method: "POST", body: new URLSearchParams({ password: "wrong" }) }), env, params });
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.has("set-cookie"), false);
  const response = await onRequestPost({ request: new Request(url, { method: "POST", body: new URLSearchParams({ password: "long-password-123" }) }), env, params });
  assert.equal(await response.text(), record.html);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax/);
  const cookie = setCookie.split(";")[0];
  assert.equal(await (await get(cookie)).text(), record.html);
  const expired = (await buildAccessCookie(record.id, record.passwordHash, env.ADMIN_TOKEN, Date.now() - 8 * 3600_000)).split(";")[0];
  assert.match(await (await get(expired)).text(), /Password required/);
  record = (await updateRecordPassword(record, "replacement-password-123")).record;
  assert.match(await (await get(cookie)).text(), /Password required/);
});
