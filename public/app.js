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
        password: viewerPassword
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    const url = new URL(data.url, window.location.origin).href;
    result.innerHTML = `
      <strong>Ready to share</strong>
      <a href="${url}" target="_blank" rel="noreferrer">${url}</a>
    `;
  } catch (error) {
    result.className = "result error";
    result.textContent = error.message;
  }
});
