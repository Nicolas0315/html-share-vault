import {
  assertValidHtmlUpload,
  buildShareRecord,
  getBearerToken,
  json,
  putOptions,
  resolveExpiry,
  timingSafeEqualString
} from "../_lib/share.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_TOKEN) {
    return json({ error: "ADMIN_TOKEN is not configured" }, 500);
  }

  const suppliedToken = getBearerToken(request);
  if (!timingSafeEqualString(suppliedToken, env.ADMIN_TOKEN)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const error = assertValidHtmlUpload(body);
  if (error) {
    return json({ error }, 400);
  }

  const expiry = resolveExpiry(body.expiresInDays);
  if (expiry.error) {
    return json({ error: expiry.error }, 400);
  }

  const record = await buildShareRecord({ ...body, expiresAt: expiry.expiresAt });
  try {
    await env.HTML_SHARES.put(record.id, JSON.stringify(record), putOptions(record));
  } catch {
    return json({ error: "storage error" }, 500);
  }

  return json({
    id: record.id,
    url: `/share/${record.id}`,
    fileName: record.fileName,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  }, 201);
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405);
}
