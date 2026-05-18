const codeForm = document.getElementById("code-form");
const pickupCode = document.getElementById("pickup-code");
const message = document.getElementById("message");
const filesContainer = document.getElementById("files");
const uploadUrlLabel = document.getElementById("upload-url");
let currentCode = "";

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function setMessage(text, tone = "") {
  message.textContent = text;
  message.dataset.tone = tone;
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    uploadUrlLabel.textContent = config.uploadUrl;
  } catch (error) {
    uploadUrlLabel.textContent = "https://bureau-vallee-espace-services.onrender.com/upload";
  }
}

function renderJob(job) {
  if (!job.files.length) {
    filesContainer.innerHTML = "";
    setMessage("Aucun fichier dans ce depot.", "error");
    return;
  }

  setMessage(`${job.files.length} fichier(s) disponible(s) pour le code ${job.code}.`, "success");
  filesContainer.innerHTML = `
    <div class="job-head">
      <div>
        <span>Code ${job.code}</span>
        <strong>${job.customerName || "Client"}</strong>
      </div>
      <button class="danger" id="delete-job">Supprimer apres impression</button>
    </div>
    ${job.files.map((file) => `
      <article class="file-card">
        <div>
          <strong>${file.originalName}</strong>
          <small>${file.extension.toUpperCase()} - ${formatSize(file.size)}</small>
        </div>
        <div class="file-actions">
          <a href="${file.viewUrl}" target="_blank" rel="noreferrer">Ouvrir / imprimer</a>
          <a href="${file.downloadUrl}">Telecharger</a>
        </div>
      </article>
    `).join("")}
  `;

  document.getElementById("delete-job").addEventListener("click", async () => {
    await fetch(`/api/jobs/${job.code}`, { method: "DELETE" });
    filesContainer.innerHTML = "";
    pickupCode.value = "";
    setMessage("Depot supprime. Les fichiers ne sont plus accessibles.", "success");
  });
}

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = pickupCode.value.trim();
  if (!/^\d{4}$/.test(code)) {
    setMessage("Entrez le code a 4 chiffres du client.", "error");
    return;
  }

  currentCode = code;
  setMessage("Recherche des fichiers...");
  filesContainer.innerHTML = "";

  try {
    const response = await fetch(`/api/jobs/${code}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Code introuvable.");
    renderJob(payload);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

loadConfig();
