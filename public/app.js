const codeForm = document.getElementById("code-form");
const pickupCode = document.getElementById("pickup-code");
const message = document.getElementById("message");
const filesContainer = document.getElementById("files");
const uploadUrlLabel = document.getElementById("upload-url");
const uploadQr = document.getElementById("upload-qr");
const printInstructionsModal = document.getElementById("print-instructions-modal");
const confirmPrintInstructionsBtn = document.getElementById("confirm-print-instructions");
const cancelPrintInstructionsBtn = document.getElementById("cancel-print-instructions");
const stationTitle = document.getElementById("station-title");
let currentCode = "";
let activeJob = null;
let pendingFileUrl = "";

function currentStation() {
  return window.location.pathname.includes("poste-2") ? "poste-2" : "poste-1";
}

function stationLabel() {
  return currentStation() === "poste-2" ? "Poste 2" : "Poste 1";
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function setMessage(text, tone = "") {
  message.textContent = text;
  message.dataset.tone = tone;
}

async function deleteCurrentJob(finalMessage) {
  if (!activeJob?.code) return;
  const code = activeJob.code;
  try {
    await fetch(`/api/jobs/${code}`, { method: "DELETE" });
  } catch (error) {
    // The visual flow still resets even if the file was already removed.
  }
  activeJob = null;
  currentCode = "";
  filesContainer.innerHTML = "";
  pickupCode.value = "";
  setMessage(finalMessage, "success");
}

async function loadConfig() {
  stationTitle.textContent = stationLabel();
  try {
    const response = await fetch(`/api/config?station=${currentStation()}`);
    const config = await response.json();
    uploadUrlLabel.textContent = config.uploadUrl;
    uploadQr.src = config.qrUrl;
  } catch (error) {
    uploadUrlLabel.textContent = `https://bureau-vallee-espace-services.onrender.com/upload?station=${currentStation()}`;
    uploadQr.src = `/qr.svg?station=${currentStation()}`;
  }
}

function renderJob(job) {
  activeJob = job;
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
        <small>Vos fichiers restent disponibles pendant cette session.</small>
      </div>
    </div>
    ${job.files.map((file) => `
      <article class="file-card">
        <div>
          <strong>${file.originalName}</strong>
          <small>${file.extension.toUpperCase()} - ${formatSize(file.size)}</small>
        </div>
        <div class="file-actions">
          ${file.downloadUrl
            ? `<a href="${file.downloadUrl}">Telecharger</a>`
            : `<a href="${file.viewUrl}" target="_blank" rel="noreferrer" data-print-url="${file.viewUrl}">Ouvrir / imprimer</a>`}
        </div>
      </article>
    `).join("")}
    <button class="danger delete-session-button" id="delete-job">Suppression de vos fichiers ?</button>
  `;

  document.getElementById("delete-job").addEventListener("click", async () => {
    await deleteCurrentJob("Merci de vos impressions, veuillez vous approcher de la caisse.");
  });
}

filesContainer.addEventListener("click", (event) => {
  const link = event.target.closest("[data-print-url]");
  if (!link) return;
  event.preventDefault();
  pendingFileUrl = link.href;
  printInstructionsModal.classList.remove("hidden");
});

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
    const response = await fetch(`/api/jobs/${code}?station=${currentStation()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Code introuvable.");
    renderJob(payload);
  } catch (error) {
    activeJob = null;
    setMessage(error.message, "error");
  }
});

confirmPrintInstructionsBtn.addEventListener("click", () => {
  if (pendingFileUrl) {
    window.open(pendingFileUrl, "_blank", "noopener,noreferrer");
  }
  pendingFileUrl = "";
  printInstructionsModal.classList.add("hidden");
});

cancelPrintInstructionsBtn.addEventListener("click", () => {
  pendingFileUrl = "";
  printInstructionsModal.classList.add("hidden");
});

window.addEventListener("beforeunload", (event) => {
  if (!activeJob?.code) return;
  event.preventDefault();
  event.returnValue = "Une impression est en cours. Les fichiers risquent d'etre perdus.";
});

loadConfig();
