import {
  buildShareMetadata,
  isAdminRequest,
  json
} from "../../_lib/share.js";

function shareSummaryFromMetadata(metadata, id) {
  return {
    id,
    fileName: metadata?.fileName || "shared.html",
    createdAt: metadata?.createdAt || "",
    updatedAt: metadata?.updatedAt || metadata?.createdAt || "",
    passwordUpdatedAt: metadata?.passwordUpdatedAt || metadata?.createdAt || "",
    bytes: metadata?.bytes || 0,
    url: `/share/${id}`
  };
}

async function readSummary(env, key) {
  if (key.metadata) {
    return shareSummaryFromMetadata(key.metadata, key.name);
  }

  const raw = await env.HTML_SHARES.get(key.name);
  if (!raw) return null;
  return shareSummaryFromMetadata(buildShareMetadata(JSON.parse(raw)), key.name);
}

export async function onRequestGet({ request, env }) {
  if (!isAdminRequest(request, env)) {
    return json({ error: "unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || undefined;
  const listed = await env.HTML_SHARES.list({ limit: 100, cursor });
  const shares = (await Promise.all(listed.keys.map((key) => readSummary(env, key))))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return json({
    shares,
    cursor: listed.cursor || "",
    listComplete: listed.list_complete
  });
}

export function onRequest() {
  return json({ error: "method not allowed" }, 405);
}
