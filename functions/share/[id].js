import {
  buildAccessCookie,
  hasAccessCookie,
  isPasswordValid,
  passwordForm,
  shareHtmlHeaders
} from "../_lib/share.js";

const FORM_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

async function loadRecord(env, id) {
  const raw = await env.HTML_SHARES.get(id);
  return raw ? JSON.parse(raw) : null;
}

function formResponse(id, error = "", status = 200) {
  return new Response(passwordForm(id, error), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": FORM_CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow, noarchive"
    }
  });
}

function htmlResponse(record, extra = {}) {
  return new Response(record.html, { headers: shareHtmlHeaders(record, extra) });
}

export async function onRequestGet({ request, env, params }) {
  const record = await loadRecord(env, params.id);
  if (!record) {
    return new Response("Not found", { status: 404 });
  }

  if (hasAccessCookie(request, record.id, record.passwordHash)) {
    return htmlResponse(record);
  }

  return formResponse(record.id);
}

export async function onRequestPost({ request, env, params }) {
  const record = await loadRecord(env, params.id);
  if (!record) {
    return new Response("Not found", { status: 404 });
  }

  const form = await request.formData();
  const password = form.get("password");
  if (!(await isPasswordValid(record, password))) {
    return formResponse(record.id, "パスワードが違います。", 401);
  }

  return htmlResponse(record, { "set-cookie": buildAccessCookie(record.id, record.passwordHash) });
}

export function onRequest() {
  return new Response("Method not allowed", { status: 405 });
}
