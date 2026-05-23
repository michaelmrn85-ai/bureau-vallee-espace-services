const codeForm = document.getElementById("code-form");
const pickupCode = document.getElementById("pickup-code");
const message = document.getElementById("message");
const filesContainer = document.getElementById("files");
const uploadUrlLabel = document.getElementById("upload-url");
const uploadQr = document.getElementById("upload-qr");
const stationTitle = document.getElementById("station-title");
const expirationModal = document.getElementById("expiration-modal");
const expirationCountdown = document.getElementById("expiration-countdown");
const closeExpirationModalBtn = document.getElementById("close-expiration-modal");
let currentCode = "";
let activeJob = null;
let deletionSeconds = 0;
let deletionInterval = null;
let expirationWarningShown = false;

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

function isPdf(file) {
  return file.extension.toLowerCase() === "pdf";
}

function renderOption(value, label, selectedValue) {
  return `<option value="${value}"${value === selectedValue ? " selected" : ""}>${label}</option>`;
}

function renderPrintSettings(settings = {}) {
  const colorMode = settings.colorMode || "noir-blanc";
  const duplex = settings.duplex || "recto";
  const paperSize = settings.paperSize || "A4";
  const scaling = settings.scaling || "ajuster";
  const orientation = settings.orientation || "auto";
  const pageRange = settings.pageRange || "";
  const copies = settings.copies || 1;
  return `
    <form class="print-settings" id="print-settings-form">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Reglages PDF</p>
          <h2>Choisissez vos options avant d'imprimer</h2>
        </div>
      </div>
      <div class="print-settings-grid">
        <label>
          Couleur
          <select name="colorMode">
            ${renderOption("noir-blanc", "Noir et blanc", colorMode)}
            ${renderOption("couleur", "Couleur", colorMode)}
          </select>
        </label>
        <label>
          Recto / verso
          <select name="duplex">
            ${renderOption("recto", "Recto", duplex)}
            ${renderOption("recto-verso-long", "Recto-verso bord long", duplex)}
            ${renderOption("recto-verso-court", "Recto-verso bord court", duplex)}
          </select>
        </label>
        <label>
          Format papier
          <select name="paperSize">
            ${renderOption("A5", "A5", paperSize)}
            ${renderOption("A4", "A4", paperSize)}
            ${renderOption("A3", "A3", paperSize)}
          </select>
        </label>
        <label>
          Taille
          <select name="scaling">
            ${renderOption("ajuster", "Ajuster", scaling)}
            ${renderOption("taille-reelle", "Taille reelle", scaling)}
          </select>
        </label>
        <label>
          Orientation
          <select name="orientation">
            ${renderOption("auto", "Auto", orientation)}
            ${renderOption("portrait", "Portrait", orientation)}
            ${renderOption("paysage", "Paysage", orientation)}
          </select>
        </label>
        <label>
          Plage de pages
          <input name="pageRange" type="text" inputmode="numeric" placeholder="Ex : 1-3, 5" value="${pageRange}">
        </label>
        <label>
          Exemplaires
          <input name="copies" type="number" min="1" max="99" value="${copies}">
        </label>
      </div>
      <button type="submit">Enregistrer les reglages</button>
      <p class="message" id="print-settings-message"></p>
    </form>
  `;
}

function attachPrintSettingsForm() {
  const form = document.getElementById("print-settings-form");
  const settingsMessage = document.getElementById("print-settings-message");
  if (!form || !activeJob?.code) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    settingsMessage.textContent = "Enregistrement...";
    settingsMessage.dataset.tone = "";
    try {
      const response = await fetch(`/api/jobs/${activeJob.code}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Reglages impossibles a enregistrer.");
      activeJob = payload;
      settingsMessage.textContent = "Reglages enregistres pour le suivi caisse.";
      settingsMessage.dataset.tone = "success";
    } catch (error) {
      settingsMessage.textContent = error.message;
      settingsMessage.dataset.tone = "error";
    }
  });
}

async function savePrintSettings() {
  const form = document.getElementById("print-settings-form");
  if (!form || !activeJob?.code) return activeJob?.printSettings || {};
  const response = await fetch(`/api/jobs/${activeJob.code}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(new FormData(form))),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Reglages impossibles a enregistrer.");
  activeJob = payload;
  return payload.printSettings;
}

function printStatusLabel(status) {
  const labels = {
    queued: "En attente",
    printing: "En impression",
    done: "Imprime",
    failed: "Erreur",
  };
  return labels[status] || status;
}

function latestPrintStatus(fileId) {
  const request = [...(activeJob?.printRequests || [])].reverse().find((item) => item.fileId === fileId);
  return request ? printStatusLabel(request.status) : "";
}

function firstPdfFile(job) {
  return job.files.find(isPdf);
}

function renderPdfPreview(file) {
  if (!file) return "";
  return `
    <aside class="pdf-preview-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Apercu PDF</p>
          <h2>${file.originalName}</h2>
        </div>
      </div>
      <iframe src="${file.viewUrl}#toolbar=0&navpanes=0" title="Apercu du fichier PDF ${file.originalName}"></iframe>
    </aside>
  `;
}

function attachPrintButtons() {
  document.querySelectorAll("[data-print-file]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!activeJob?.code) return;
      const fileId = button.dataset.printFile;
      const settingsMessage = document.getElementById("print-settings-message");
      button.disabled = true;
      button.textContent = "Envoi...";
      try {
        const settings = await savePrintSettings();
        const response = await fetch(`/api/jobs/${activeJob.code}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, settings }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Impression impossible.");
        activeJob = payload.job;
        if (settingsMessage) {
          settingsMessage.textContent = "Demande envoyee au copieur de ce poste.";
          settingsMessage.dataset.tone = "success";
        }
        renderJob(activeJob);
      } catch (error) {
        button.disabled = false;
        button.textContent = "Imprimer ce PDF";
        if (settingsMessage) {
          settingsMessage.textContent = error.message;
          settingsMessage.dataset.tone = "error";
        } else {
          setMessage(error.message, "error");
        }
      }
    });
  });
}

function stopDeletionTimer() {
  window.clearInterval(deletionInterval);
  deletionInterval = null;
  deletionSeconds = 0;
  expirationWarningShown = false;
  expirationModal.classList.add("hidden");
}

async function deleteCurrentJob(finalMessage) {
  if (!activeJob?.code) return;
  const code = activeJob.code;
  stopDeletionTimer();
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

function updateDeletionCountdown() {
  const countdownLabel = document.getElementById("deletion-countdown");
  if (countdownLabel) {
    countdownLabel.textContent = deletionSeconds <= 30
      ? `Suppression automatique dans ${deletionSeconds}s`
      : "Suppression automatique dans 3 minutes";
  }
  if (expirationCountdown) {
    expirationCountdown.textContent = String(Math.max(0, deletionSeconds));
  }
}

function startDeletionTimer() {
  stopDeletionTimer();
  deletionSeconds = 180;
  updateDeletionCountdown();

  deletionInterval = window.setInterval(() => {
    deletionSeconds -= 1;
    updateDeletionCountdown();

    if (deletionSeconds <= 30 && !expirationWarningShown) {
      expirationWarningShown = true;
      expirationModal.classList.remove("hidden");
    }

    if (deletionSeconds <= 0) {
      deleteCurrentJob("Temps termine. Les fichiers ont ete supprimes automatiquement. Merci de vos impressions, veuillez vous approcher de la caisse.");
    }
  }, 1000);
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
  const hasPdf = job.files.some(isPdf);
  const previewFile = firstPdfFile(job);
  filesContainer.innerHTML = `
    <div class="job-head">
      <div>
        <span>Code ${job.code}</span>
        <strong>${job.customerName || "Client"}</strong>
        <small id="deletion-countdown">Suppression automatique dans 3 minutes</small>
      </div>
      ${job.downloadAllUrl ? `<a class="download-all-button" href="${job.downloadAllUrl}" download>Telecharger tout</a>` : ""}
    </div>
    <div class="job-workspace">
      <div class="job-controls">
        ${hasPdf ? renderPrintSettings(job.printSettings) : `
          <div class="counter-notice">
            <strong>Impression au comptoir</strong>
            <span>Les fichiers non PDF doivent etre presentes a l'equipe Bureau Vallee.</span>
          </div>
        `}
        ${job.files.map((file) => `
          <article class="file-card">
            <div>
              <strong>${file.originalName}</strong>
              <small>${file.extension.toUpperCase()} - ${formatSize(file.size)}</small>
            </div>
            <div class="file-actions">
              ${isPdf(file) ? `<button type="button" data-print-file="${file.id}">Imprimer ce PDF</button>` : `<span class="counter-pill">Au comptoir</span>`}
              <a href="${file.downloadUrl}" download>Telecharger</a>
              ${latestPrintStatus(file.id) ? `<span class="counter-pill">${latestPrintStatus(file.id)}</span>` : ""}
            </div>
          </article>
        `).join("")}
        ${hasPdf && job.files.filter(isPdf).length > 1 ? `
          <div class="counter-notice">
            <strong>Apercu</strong>
            <span>L'apercu affiche le premier PDF. Lancez l'impression sur le PDF souhaite dans la liste.</span>
          </div>
        ` : ""}
      </div>
      ${renderPdfPreview(previewFile)}
    </div>
    <button class="danger delete-session-button" id="delete-job">Suppression de vos fichiers ?</button>
  `;

  document.getElementById("delete-job").addEventListener("click", async () => {
    await deleteCurrentJob("Merci de vos impressions, veuillez vous approcher de la caisse.");
  });
  attachPrintSettingsForm();
  attachPrintButtons();

  startDeletionTimer();
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
    const response = await fetch(`/api/jobs/${code}?station=${currentStation()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Code introuvable.");
    renderJob(payload);
  } catch (error) {
    activeJob = null;
    stopDeletionTimer();
    setMessage(error.message, "error");
  }
});

closeExpirationModalBtn.addEventListener("click", () => {
  expirationModal.classList.add("hidden");
});

loadConfig();
