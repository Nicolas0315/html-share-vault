import {
  buildAccessCookie,
  hasAccessCookie,
  isPasswordValid,
  loadShareRecord,
  passwordForm
} from "../_lib/share.js";

function formResponse(id, error = "", status = 200) {
  return new Response(passwordForm(id, error), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function htmlResponse(record, extraHeaders = {}) {
  return new Response(record.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="${record.fileName.replaceAll('"', "")}"`,
      ...extraHeaders
    }
  });
}

export async function onRequestGet({ request, env, params }) {
  const record = await loadShareRecord(env, params.id);
  if (!record) {
    return new Response("Not found", { status: 404 });
  }

  if (await hasAccessCookie(request, record.id, record.passwordHash, env.ADMIN_TOKEN)) {
    return htmlResponse(record);
  }

  return formResponse(record.id);
}

export async function onRequestPost({ request, env, params }) {
  const record = await loadShareRecord(env, params.id);
  if (!record) {
    return new Response("Not found", { status: 404 });
  }

  const form = await request.formData();
  const password = form.get("password");
  if (!(await isPasswordValid(record, password))) {
    return formResponse(record.id, "パスワードが違います。", 401);
  }

  return htmlResponse(record, {
    "set-cookie": await buildAccessCookie(record.id, record.passwordHash, env.ADMIN_TOKEN)
  });
}

export function onRequest() {
  return new Response("Method not allowed", { status: 405 });
}
