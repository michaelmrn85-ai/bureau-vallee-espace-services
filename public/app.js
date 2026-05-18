const codeForm = document.getElementById("code-form");
const pickupCode = document.getElementById("pickup-code");
const message = document.getElementById("message");
const filesContainer = document.getElementById("files");
const uploadUrlLabel = document.getElementById("upload-url");
const timeoutModal = document.getElementById("timeout-modal");
const continueSessionBtn = document.getElementById("continue-session");
const finishSessionBtn = document.getElementById("finish-session");
const printInstructionsModal = document.getElementById("print-instructions-modal");
const confirmPrintInstructionsBtn = document.getElementById("confirm-print-instructions");
const cancelPrintInstructionsBtn = document.getElementById("cancel-print-instructions");
let currentCode = "";
let activeJob = null;
let countdownSeconds = 0;
let countdownInterval = null;
let warningShown = false;
let pendingFileUrl = "";

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function setMessage(text, tone = "") {
  message.textContent = text;
  message.dataset.tone = tone;
}

function stopCountdown() {
  window.clearInterval(countdownInterval);
  countdownInterval = null;
  warningShown = false;
  timeoutModal.classList.add("hidden");
}

async function deleteCurrentJob(finalMessage) {
  if (!activeJob?.code) return;
  const code = activeJob.code;
  stopCountdown();
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

function updateCountdownLabel() {
  const countdownLabel = document.getElementById("countdown");
  if (countdownLabel) {
    countdownLabel.textContent = `${countdownSeconds}s restantes avant suppression`;
  }
}

function startCountdown() {
  stopCountdown();
  countdownSeconds = 60;
  warningShown = false;
  updateCountdownLabel();
  countdownInterval = window.setInterval(() => {
    countdownSeconds -= 1;
    updateCountdownLabel();

    if (countdownSeconds <= 15 && !warningShown) {
      warningShown = true;
      timeoutModal.classList.remove("hidden");
    }

    if (countdownSeconds <= 0) {
      deleteCurrentJob("Temps termine. Les fichiers ont ete effaces. Merci de vos impressions, veuillez vous approcher de la caisse.");
    }
  }, 1000);
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
        <small id="countdown">60s restantes avant suppression</small>
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
          <a href="${file.viewUrl}" target="_blank" rel="noreferrer" data-print-url="${file.viewUrl}">Ouvrir / imprimer</a>
          <a href="${file.downloadUrl}" data-print-url="${file.downloadUrl}">Telecharger</a>
        </div>
      </article>
    `).join("")}
  `;

  document.getElementById("delete-job").addEventListener("click", async () => {
    await deleteCurrentJob("Merci de vos impressions, veuillez vous approcher de la caisse.");
  });

  startCountdown();
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
    const response = await fetch(`/api/jobs/${code}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Code introuvable.");
    renderJob(payload);
  } catch (error) {
    activeJob = null;
    stopCountdown();
    setMessage(error.message, "error");
  }
});

continueSessionBtn.addEventListener("click", () => {
  timeoutModal.classList.add("hidden");
  countdownSeconds = 60;
  warningShown = false;
  updateCountdownLabel();
  setMessage("Session prolongee de 60 secondes.", "success");
});

finishSessionBtn.addEventListener("click", () => {
  deleteCurrentJob("Merci de vos impressions, veuillez vous approcher de la caisse.");
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
