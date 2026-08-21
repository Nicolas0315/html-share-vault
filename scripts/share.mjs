#!/usr/bin/env node
// Upload an HTML file to the vault without a browser, so an agent session can share
// its own output. Config comes from env: HTML_SHARE_BASE_URL, HTML_SHARE_ADMIN_TOKEN.
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

function parseArgs(argv) {
	const args = { days: 7 };
	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];
		if (value === "--days") args.days = Number(argv[++index]);
		else if (value === "--password") args.password = argv[++index];
		else if (!args.file) args.file = value;
		else throw new Error(`unexpected argument: ${value}`);
	}
	if (!args.file)
		throw new Error(
			"usage: share.mjs <file.html> [--days 7] [--password <pw>]",
		);
	return args;
}

// 14 chars is the server minimum; 24 base64url chars keeps it well past brute force.
function generatePassword() {
	return randomBytes(18).toString("base64url");
}

const args = parseArgs(process.argv.slice(2));
const baseUrl =
	process.env.HTML_SHARE_BASE_URL || "https://html-share-vault.pages.dev";
const adminToken = process.env.HTML_SHARE_ADMIN_TOKEN;
if (!adminToken) throw new Error("HTML_SHARE_ADMIN_TOKEN is not set");

const password = args.password || generatePassword();
const response = await fetch(new URL("/api/upload", baseUrl), {
	method: "POST",
	headers: {
		"content-type": "application/json",
		authorization: `Bearer ${adminToken}`,
	},
	body: JSON.stringify({
		fileName: basename(args.file),
		html: await readFile(args.file, "utf8"),
		password,
		expiresInDays: args.days,
	}),
});

const data = await response.json();
if (!response.ok) {
	console.error(
		`upload failed (${response.status}): ${data.error || "unknown error"}`,
	);
	process.exit(1);
}

console.log(`url:      ${new URL(data.url, baseUrl).href}`);
console.log(`password: ${password}`);
console.log(`expires:  ${data.expiresAt}`);
