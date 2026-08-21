#!/usr/bin/env node
// Boots wrangler pages dev and asserts the security headers and auth boundaries that
// unit tests cannot see: real response headers, real KV, real 401s.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const PORT = 8789;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "e2e-admin-token";
const MARKER = "e2e-marker-9f3a";

const argv = [
	"wrangler",
	"pages",
	"dev",
	"public",
	"--compatibility-date=2026-06-09",
	"--kv=HTML_SHARES",
	`--binding=ADMIN_TOKEN=${TOKEN}`,
	`--port=${PORT}`,
];
const stdio = ["ignore", "pipe", "pipe"];
// Node refuses to spawn npx.cmd directly on Windows; the shell also owns the tree kill.
const server =
	process.platform === "win32"
		? spawn(`npx ${argv.join(" ")}`, { stdio, shell: true })
		: spawn("npx", argv, { stdio });

function stop() {
	if (process.platform === "win32")
		spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
			stdio: "ignore",
		});
	else server.kill("SIGTERM");
}

async function waitForReady(timeoutMs = 60000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
			if (response.ok) return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	throw new Error("wrangler pages dev did not become ready");
}

async function run() {
	await waitForReady();

	const root = await fetch(BASE);
	assert.equal(root.status, 200, "root serves");
	assert.match(
		root.headers.get("content-security-policy") || "",
		/default-src 'none'/,
		"V4 static CSP",
	);
	assert.equal(root.headers.get("x-frame-options"), "DENY", "V4 framing");
	assert.match(
		root.headers.get("strict-transport-security") || "",
		/max-age=31536000/,
		"V4 HSTS",
	);

	const admin = await fetch(`${BASE}/admin/`);
	assert.match(
		admin.headers.get("content-security-policy") || "",
		/default-src 'none'/,
		"V4 admin CSP",
	);

	const anonUpload = await fetch(`${BASE}/api/upload`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			fileName: "a.html",
			html: "<h1>a</h1>",
			password: "long-password-123",
		}),
	});
	assert.equal(anonUpload.status, 401, "V7 upload rejects anonymous");

	const anonList = await fetch(`${BASE}/api/admin/shares`);
	assert.equal(anonList.status, 401, "V7 admin list rejects anonymous");

	const authed = (body) =>
		fetch(`${BASE}/api/upload`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${TOKEN}`,
			},
			body: JSON.stringify(body),
		});

	const tooLong = await authed({
		fileName: "a.html",
		html: "<h1>a</h1>",
		password: "long-password-123",
		expiresInDays: 91,
	});
	assert.equal(tooLong.status, 400, "V11 rejects expiry above the cap");

	const password = "e2e-long-password-123";
	const created = await authed({
		fileName: "a.html",
		html: `<h1>${MARKER}</h1>`,
		password,
		expiresInDays: 1,
	});
	assert.equal(created.status, 201, "V16 upload accepted");
	const share = await created.json();
	assert.ok(
		Date.parse(share.expiresAt) > Date.now(),
		"V10 expiry in the future",
	);

	const locked = await fetch(`${BASE}${share.url}`);
	const lockedBody = await locked.text();
	assert.equal(locked.status, 200, "locked share serves the form");
	assert.equal(
		lockedBody.includes(MARKER),
		false,
		"V5 locked share leaks no content",
	);
	assert.match(
		locked.headers.get("content-security-policy") || "",
		/default-src 'none'/,
		"V3 form CSP",
	);

	const wrong = await fetch(`${BASE}${share.url}`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ password: "wrong-password-1234" }),
	});
	assert.equal(wrong.status, 401, "V5 wrong password rejected");
	assert.equal(
		(await wrong.text()).includes(MARKER),
		false,
		"V5 wrong password leaks no content",
	);

	const opened = await fetch(`${BASE}${share.url}`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ password }),
	});
	assert.equal(opened.status, 200, "correct password opens the share");
	assert.ok(
		(await opened.text()).includes(MARKER),
		"share renders the uploaded html",
	);

	const csp = opened.headers.get("content-security-policy") || "";
	assert.match(csp, /sandbox allow-scripts/, "V1 sandboxed");
	assert.equal(
		csp.includes("allow-same-origin"),
		false,
		"V1 opaque origin preserved",
	);
	assert.match(
		opened.headers.get("x-robots-tag") || "",
		/noindex/,
		"V3 noindex",
	);
	assert.equal(
		opened.headers.get("x-content-type-options"),
		"nosniff",
		"V3 nosniff",
	);
	assert.match(
		opened.headers.get("set-cookie") || "",
		/HttpOnly/,
		"access cookie stays HttpOnly",
	);

	const listed = await (
		await fetch(`${BASE}/api/admin/shares`, {
			headers: { authorization: `Bearer ${TOKEN}` },
		})
	).json();
	const row = listed.shares.find((item) => item.id === share.id);
	assert.ok(row, "V16 share appears in the admin list");
	assert.equal(
		row.expiresAt,
		share.expiresAt,
		"V12 expiry visible to the admin",
	);

	await fetch(`${BASE}/api/admin/shares/${share.id}`, {
		method: "DELETE",
		headers: { authorization: `Bearer ${TOKEN}` },
	});
}

try {
	await Promise.race([
		run(),
		once(server, "exit").then(() => {
			throw new Error("wrangler exited early");
		}),
	]);
	console.log("e2e: all checks passed");
} catch (error) {
	console.error(`e2e: FAILED — ${error.message}`);
	process.exitCode = 1;
} finally {
	stop();
}
