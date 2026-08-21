const tokenInput = document.querySelector("#admin-token");
const saveTokenButton = document.querySelector("#save-token");
const refreshButton = document.querySelector("#refresh");
const loadMoreButton = document.querySelector("#load-more");
const sharesBody = document.querySelector("#shares");
const empty = document.querySelector("#empty");
const status = document.querySelector("#status");
const shareCount = document.querySelector("#share-count");
const dialog = document.querySelector("#password-dialog");
const dialogFile = document.querySelector("#dialog-file");
const newPasswordInput = document.querySelector("#new-password");
const cancelPasswordButton = document.querySelector("#cancel-password");
const confirmPasswordButton = document.querySelector("#confirm-password");

let adminToken = sessionStorage.getItem("html-share-admin-token") || "";
let cursor = "";
let rows = [];
let selectedShare = null;

tokenInput.value = adminToken;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "status error" : "status";
}

function headers() {
  return {
    authorization: `Bearer ${adminToken}`,
    "content-type": "application/json"
  };
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function shareUrl(share) {
  return new URL(share.url, window.location.origin).href;
}

function render() {
  shareCount.textContent = String(rows.length);
  sharesBody.replaceChildren(...rows.map((share) => {
    const tr = document.createElement("tr");

    const nameCell = document.createElement("td");
    const fileName = document.createElement("strong");
    fileName.textContent = share.fileName;
    const shareId = document.createElement("span");
    shareId.textContent = share.id;
    nameCell.append(fileName, shareId);

    const createdCell = document.createElement("td");
    createdCell.textContent = formatDate(share.createdAt);

    const expiresCell = document.createElement("td");
    expiresCell.textContent = share.expiresAt ? formatDate(share.expiresAt) : "無期限";

    const bytesCell = document.createElement("td");
    bytesCell.textContent = formatBytes(share.bytes);

    const linkCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = shareUrl(share);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "開く";
    linkCell.append(link);

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";
    for (const [label, action, className] of [
      ["コピー", "copy", ""],
      ["再設定", "password", ""],
      ["削除", "delete", "danger"]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = action;
      button.dataset.id = share.id;
      button.textContent = label;
      if (className) button.className = className;
      actionsCell.append(button);
    }

    tr.append(nameCell, createdCell, expiresCell, bytesCell, linkCell, actionsCell);
    return tr;
  }));
  empty.hidden = rows.length > 0;
  if (rows.length > 0) empty.textContent = "";
}

async function loadShares({ append = false } = {}) {
  if (!adminToken) {
    setStatus("Admin token を入力してください。", true);
    return;
  }

  const url = new URL("/api/admin/shares", window.location.origin);
  if (append && cursor) url.searchParams.set("cursor", cursor);

  setStatus("読み込み中...");
  const response = await fetch(url, { headers: headers() });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "読み込みに失敗しました。", true);
    empty.hidden = false;
    empty.textContent = "Admin token を確認してください。";
    return;
  }

  rows = append ? [...rows, ...data.shares] : data.shares;
  cursor = data.cursor || "";
  loadMoreButton.disabled = data.listComplete || !cursor;
  render();
  setStatus(rows.length ? "最新の一覧です。" : "アップロード済み HTML はありません。");
}

async function copyShare(id) {
  const share = rows.find((item) => item.id === id);
  await navigator.clipboard.writeText(shareUrl(share));
  setStatus("共有URLをコピーしました。");
}

async function deleteShare(id) {
  const share = rows.find((item) => item.id === id);
  if (!confirm(`${share.fileName} を削除しますか？`)) return;

  const response = await fetch(`/api/admin/shares/${id}`, {
    method: "DELETE",
    headers: headers()
  });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "削除に失敗しました。", true);
    return;
  }

  rows = rows.filter((item) => item.id !== id);
  render();
  setStatus("削除しました。");
}

function openPasswordDialog(id) {
  selectedShare = rows.find((item) => item.id === id);
  dialogFile.textContent = selectedShare.fileName;
  newPasswordInput.value = "";
  dialog.showModal();
  newPasswordInput.focus();
}

async function updatePassword() {
  const password = newPasswordInput.value;
  const response = await fetch(`/api/admin/shares/${selectedShare.id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "パスワード再設定に失敗しました。", true);
    return;
  }

  rows = rows.map((item) => item.id === selectedShare.id
    ? { ...item, updatedAt: data.updatedAt, passwordUpdatedAt: data.passwordUpdatedAt }
    : item);
  dialog.close();
  render();
  setStatus("viewer password を再設定しました。");
}

saveTokenButton.addEventListener("click", () => {
  adminToken = tokenInput.value.trim();
  sessionStorage.setItem("html-share-admin-token", adminToken);
  rows = [];
  cursor = "";
  loadShares();
});

refreshButton.addEventListener("click", () => {
  cursor = "";
  loadShares();
});

loadMoreButton.addEventListener("click", () => loadShares({ append: true }));
cancelPasswordButton.addEventListener("click", () => dialog.close());
confirmPasswordButton.addEventListener("click", updatePassword);

sharesBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "copy") copyShare(id);
  if (action === "password") openPasswordDialog(id);
  if (action === "delete") deleteShare(id);
});

if (adminToken) {
  loadShares();
}
