const MAX_HTML_BYTES = 24 * 1024 * 1024;
const PASSWORD_COOKIE_MAX_AGE = 60 * 60 * 8;
const PASSWORD_ITERATIONS = 10000;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

export function timingSafeEqualString(a, b) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const maxLength = Math.max(left.length, right.length);

  let diff = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }
  return diff === 0;
}

export function assertValidHtmlUpload({ html, password }) {
  if (typeof html !== "string" || html.trim() === "") {
    return "html is required";
  }
  if (new TextEncoder().encode(html).length > MAX_HTML_BYTES) {
    return "html exceeds the 24 MiB upload limit";
  }
  if (typeof password !== "string" || password.length < 14) {
    return "password must be at least 14 characters";
  }
  return "";
}

export function normalizeFileName(fileName) {
  if (typeof fileName !== "string" || fileName.trim() === "") {
    return "shared.html";
  }
  return fileName.replace(/[^\w.\-()[\] ]+/g, "_").slice(0, 120) || "shared.html";
}

export function createShareId(randomValues = crypto.getRandomValues.bind(crypto)) {
  const bytes = new Uint8Array(16);
  randomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid hex");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function pbkdf2Hex(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(saltHex),
      iterations
    },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function buildShareRecord({ fileName, html, password, now = new Date() }) {
  const id = createShareId();
  const salt = createShareId();
  return {
    id,
    fileName: normalizeFileName(fileName),
    html,
    passwordSalt: salt,
    passwordHash: await pbkdf2Hex(password, salt),
    passwordAlgorithm: "PBKDF2-SHA-256",
    passwordIterations: PASSWORD_ITERATIONS,
    createdAt: now.toISOString()
  };
}

export async function isPasswordValid(record, password) {
  if (!record || typeof password !== "string") return false;
  const hash = await pbkdf2Hex(password, record.passwordSalt, record.passwordIterations || PASSWORD_ITERATIONS);
  return timingSafeEqualString(hash, record.passwordHash);
}

export function buildAccessCookie(id, passwordHash) {
  return [
    `html_share_${id}=${passwordHash}`,
    "Path=/share/",
    `Max-Age=${PASSWORD_COOKIE_MAX_AGE}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

export function hasAccessCookie(request, id, passwordHash) {
  const cookie = request.headers.get("cookie") || "";
  const expected = `html_share_${id}=${passwordHash}`;
  return cookie.split(/;\s*/).some((part) => timingSafeEqualString(part, expected));
}

export function passwordForm(id, error = "") {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password required</title>
    <style>
      :root { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: #1d2430; background: #f5f7fa; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      main { width: min(100%, 420px); background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; padding: 24px; }
      h1 { margin: 0 0 16px; font-size: 22px; letter-spacing: 0; }
      form { display: grid; gap: 12px; }
      input, button { min-height: 42px; border-radius: 6px; font: inherit; }
      input { border: 1px solid #b8c2d1; padding: 9px 11px; }
      button { border: 0; background: #146c5d; color: white; font-weight: 750; cursor: pointer; }
      p { margin: 0 0 12px; color: #b42318; }
    </style>
  </head>
  <body>
    <main>
      <h1>パスワードを入力</h1>
      ${error ? `<p>${error}</p>` : ""}
      <form action="/share/${id}" method="post">
        <input name="password" type="password" autocomplete="current-password" required autofocus />
        <button type="submit">Open</button>
      </form>
    </main>
  </body>
</html>`;
}
