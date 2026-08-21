const form = document.querySelector("#upload-form");
const result = document.querySelector("#result");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = false;
  result.className = "result";
  result.textContent = "Uploading...";

  const file = document.querySelector("#html-file").files[0];
  const adminToken = document.querySelector("#admin-token").value;
  const viewerPassword = document.querySelector("#viewer-password").value;

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        fileName: file.name,
        html: await file.text(),
        password: viewerPassword,
        expiresInDays: Number(document.querySelector("#expires-in-days").value)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    const url = new URL(data.url, window.location.origin).href;
    result.replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: "Ready to share" }),
      Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noreferrer", textContent: url }),
      Object.assign(document.createElement("span"), {
        textContent: `Expires ${new Date(data.expiresAt).toLocaleString("ja-JP")}`
      })
    );
  } catch (error) {
    result.className = "result error";
    result.textContent = error.message;
  }
});
