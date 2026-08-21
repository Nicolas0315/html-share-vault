import {
  isAdminRequest,
  isValidShareId,
  json,
  putOptions,
  updateRecordPassword
} from "../../../_lib/share.js";

async function loadRecord(env, id) {
  const raw = await env.HTML_SHARES.get(id);
  return raw ? JSON.parse(raw) : null;
}

export async function onRequestDelete({ request, env, params }) {
  if (!isAdminRequest(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!isValidShareId(params.id)) {
    return json({ error: "invalid share id" }, 400);
  }

  await env.HTML_SHARES.delete(params.id);
  return json({ deleted: true, id: params.id });
}

export async function onRequestPatch({ request, env, params }) {
  if (!isAdminRequest(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!isValidShareId(params.id)) {
    return json({ error: "invalid share id" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const record = await loadRecord(env, params.id);
  if (!record) {
    return json({ error: "not found" }, 404);
  }

  const result = await updateRecordPassword(record, body.password);
  if (result.error) {
    return json({ error: result.error }, 400);
  }

  await env.HTML_SHARES.put(params.id, JSON.stringify(result.record), putOptions(result.record));

  return json({
    id: params.id,
    passwordUpdatedAt: result.record.passwordUpdatedAt,
    updatedAt: result.record.updatedAt,
    expiresAt: result.record.expiresAt || ""
  });
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405);
}
