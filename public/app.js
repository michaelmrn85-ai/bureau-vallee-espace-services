const codeForm = document.getElementById("code-form");
const pickupCode = document.getElementById("pickup-code");
const message = document.getElementById("message");
const homeMessage = document.getElementById("home-message");
const filesContainer = document.getElementById("files");
const uploadUrlLabel = document.getElementById("upload-url");
const uploadQr = document.getElementById("upload-qr");
const stationTitle = document.getElementById("station-title");
const expirationModal = document.getElementById("expiration-modal");
const expirationCountdown = document.getElementById("expiration-countdown");
const closeExpirationModalBtn = document.getElementById("close-expiration-modal");
const choiceGrid = document.querySelector(".choice-grid");
const formatPanel = document.querySelector(".format-panel");
const usbPanel = document.getElementById("usb-panel");
const mobilePanel = document.getElementById("mobile-panel");
const usbForm = document.getElementById("usb-form");
const usbFileInput = document.getElementById("usb-file-input");
const usbMessage = document.getElementById("usb-message");
const clientSessionToolbar = document.getElementById("client-session-toolbar");
const clientSessionLabel = document.getElementById("client-session-label");
const disconnectSessionBtn = document.getElementById("disconnect-session");
const helpButton = document.getElementById("help-button");
let currentCode = "";
let activeJob = null;
let deletionSeconds = 0;
let deletionInterval = null;
let expirationWarningShown = false;
let printStatusInterval = null;
let usbReminderTimer = null;
let activePreviewFileId = "";
let selectedPrintFileIds = new Set();
let knownPrintableFileIds = new Set();
let printSelectionReady = false;

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

function setHomeMessage(text, tone = "") {
  homeMessage.textContent = text;
  homeMessage.dataset.tone = tone;
}

function setUsbMessage(text, tone = "") {
  usbMessage.textContent = text;
  usbMessage.dataset.tone = tone;
}

function stopUsbReminder() {
  window.clearTimeout(usbReminderTimer);
  usbReminderTimer = null;
}

function startUsbReminder() {
  stopUsbReminder();
  usbReminderTimer = window.setTimeout(() => {
    setUsbMessage("N'oubliez pas votre cle USB.", "error");
  }, 90 * 1000);
}

function startClientSession(label) {
  clientSessionLabel.textContent = label;
  clientSessionToolbar.classList.remove("hidden");
  document.body.classList.add("client-session-active");
}

function showHome() {
  stopDeletionTimer();
  stopPrintStatusPolling();
  stopUsbReminder();
  activeJob = null;
  activePreviewFileId = "";
  selectedPrintFileIds = new Set();
  knownPrintableFileIds = new Set();
  printSelectionReady = false;
  currentCode = "";
  pickupCode.value = "";
  filesContainer.innerHTML = "";
  filesContainer.classList.add("hidden");
  usbPanel.classList.add("hidden");
  mobilePanel.classList.add("hidden");
  clientSessionToolbar.classList.add("hidden");
  document.body.classList.remove("client-session-active");
  choiceGrid.classList.remove("hidden");
  formatPanel.classList.remove("hidden");
  setMessage("");
  setHomeMessage("");
  setUsbMessage("");
}

function showFlow(flow) {
  startClientSession(flow === "usb" ? "Impression via cle USB" : "Impression via mobile");
  if (flow === "usb") startUsbReminder();
  else stopUsbReminder();
  choiceGrid.classList.add("hidden");
  formatPanel.classList.add("hidden");
  filesContainer.classList.add("hidden");
  filesContainer.innerHTML = "";
  if (flow === "usb") {
    usbPanel.classList.remove("hidden");
    mobilePanel.classList.add("hidden");
    usbFileInput.value = "";
    setUsbMessage("");
    return;
  }
  mobilePanel.classList.remove("hidden");
  usbPanel.classList.add("hidden");
  pickupCode.focus();
}

function isPdf(file) {
  return file.extension.toLowerCase() === "pdf";
}

function isImage(file) {
  return ["png", "jpg", "jpeg"].includes(file.extension.toLowerCase());
}

function isPrintable(file) {
  return Boolean(file.printable) || isPdf(file) || isImage(file);
}

function renderOption(value, label, selectedValue) {
  return `<option value="${value}"${value === selectedValue ? " selected" : ""}>${label}</option>`;
}

function renderPrintSettings(settings = {}) {
  const colorMode = settings.colorMode || "noir-blanc";
  const duplex = settings.duplex || "recto";
  const paperSize = "A4";
  const scaling = settings.scaling || "ajuster";
  const orientation = settings.orientation || "auto";
  const pageRange = settings.pageRange || "";
  const pagesPerSheet = String(settings.pagesPerSheet || 1);
  const copies = settings.copies || 1;
  return `
    <form class="print-settings" id="print-settings-form">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Reglages PDF</p>
          <h2>Options d'impression</h2>
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
            ${renderOption("A4", "A4", paperSize)}
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
          Pages par feuille
          <select name="pagesPerSheet">
            ${renderOption("1", "Normal", pagesPerSheet)}
            ${renderOption("2", "2 fois sur une feuille", pagesPerSheet)}
            ${renderOption("4", "4 fois sur une feuille", pagesPerSheet)}
          </select>
        </label>
        <label>
          Exemplaires
          <input name="copies" type="number" min="1" max="99" value="${copies}">
        </label>
      </div>
      <button class="settings-save-button" type="submit">Appliquer les reglages</button>
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

function hasPendingPrintRequest(job = activeJob) {
  return (job?.printRequests || []).some((request) => ["queued", "printing"].includes(request.status));
}

function syncSelectedPrintFiles(job) {
  const printableIds = job.files.filter(isPrintable).map((file) => file.id);
  const printableSet = new Set(printableIds);
  if (!printSelectionReady) {
    selectedPrintFileIds = new Set(printableIds);
    knownPrintableFileIds = printableSet;
    printSelectionReady = true;
    return;
  }
  selectedPrintFileIds = new Set(printableIds.filter((id) => selectedPrintFileIds.has(id)));
  for (const id of printableIds) {
    if (!knownPrintableFileIds.has(id)) {
      selectedPrintFileIds.add(id);
    }
  }
  knownPrintableFileIds = printableSet;
}

function refreshPrintStatuses(job = activeJob) {
  for (const file of job?.files || []) {
    const label = latestPrintStatus(file.id);
    const status = document.querySelector(`[data-print-status="${file.id}"]`);
    if (status) {
      status.textContent = label;
      status.classList.toggle("hidden", !label);
    }
  }
}

function stopPrintStatusPolling() {
  window.clearInterval(printStatusInterval);
  printStatusInterval = null;
}

function startPrintStatusPolling() {
  stopPrintStatusPolling();
  if (!activeJob?.code || !hasPendingPrintRequest(activeJob)) return;
  printStatusInterval = window.setInterval(async () => {
    try {
      const response = await fetch(`/api/jobs/${activeJob.code}?station=${currentStation()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Suivi indisponible.");
      activeJob = payload;
      refreshPrintStatuses(payload);
      if (!hasPendingPrintRequest(payload)) stopPrintStatusPolling();
    } catch (error) {
      stopPrintStatusPolling();
      setMessage(error.message, "error");
    }
  }, 2200);
}

function firstPreviewFile(job) {
  return job.files.find((file) => file.id === activePreviewFileId && (isPdf(file) || isImage(file)))
    || job.files.find((file) => isPdf(file) || isImage(file));
}

function renderFilePreview(file) {
  if (!file) {
    return `
      <section class="pdf-preview-panel empty-preview">
        <div>
          <p class="eyebrow">Apercu</p>
          <h2>Aucun apercu direct</h2>
          <p>Les fichiers Word doivent etre traites au comptoir.</p>
        </div>
      </section>
    `;
  }
  if (isImage(file)) {
    return `
      <section class="pdf-preview-panel image-preview-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Apercu image</p>
            <h2>${file.originalName}</h2>
          </div>
        </div>
        <img src="${file.viewUrl}" alt="Apercu du fichier ${file.originalName}">
      </section>
    `;
  }
  return `
    <section class="pdf-preview-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Apercu PDF</p>
          <h2>${file.originalName}</h2>
        </div>
      </div>
      <iframe src="${file.viewUrl}#toolbar=0&navpanes=0" title="Apercu du fichier PDF ${file.originalName}"></iframe>
    </section>
  `;
}

async function sendPrintRequest(fileId, settings) {
  const response = await fetch(`/api/jobs/${activeJob.code}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, settings }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Impression impossible.");
  activeJob = payload.job;
  return payload;
}

async function requestUsbEject() {
  const notify = usbPanel.classList.contains("hidden") ? setMessage : setUsbMessage;
  notify("Ejection de la cle USB...");
  try {
    const response = await fetch(`/api/stations/${currentStation()}/eject`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Ejection impossible.");
    notify("Demande d'ejection envoyee. Vous pouvez retirer la cle quand Windows l'autorise.", "success");
  } catch (error) {
    notify(error.message, "error");
  }
}

async function requestHelp() {
  if (!helpButton) return;
  helpButton.disabled = true;
  helpButton.textContent = "Aide demandee";
  setHomeMessage("Un vendeur va venir vous aider.", "success");
  try {
    const response = await fetch("/api/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station: currentStation() }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Demande d'aide impossible.");
  } catch (error) {
    helpButton.disabled = false;
    helpButton.textContent = "Aide";
    setHomeMessage(error.message, "error");
  }
}

function showUsbPickerForCurrentJob() {
  if (!activeJob?.code) return;
  stopPrintStatusPolling();
  filesContainer.classList.add("hidden");
  usbPanel.classList.remove("hidden");
  mobilePanel.classList.add("hidden");
  usbFileInput.value = "";
  setUsbMessage("Selectionnez un ou plusieurs fichiers a ajouter a cette session.", "success");
  startUsbReminder();
}

function attachPrintButtons() {
  document.querySelectorAll("[data-print-file]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!activeJob?.code) return;
      const fileId = button.dataset.printFile;
      const settingsMessage = document.getElementById("print-settings-message");
      button.disabled = true;
      button.classList.add("is-busy");
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>Impression en cours</span>`;
      try {
        const settings = await savePrintSettings();
        await sendPrintRequest(fileId, settings);
        if (settingsMessage) {
          settingsMessage.textContent = "Impression en cours. Merci de patienter.";
          settingsMessage.dataset.tone = "success";
        }
        button.disabled = false;
        button.classList.remove("is-busy");
        button.textContent = "Imprimer";
        refreshPrintStatuses(activeJob);
        startPrintStatusPolling();
      } catch (error) {
        button.disabled = false;
        button.classList.remove("is-busy");
        button.textContent = "Imprimer";
        if (settingsMessage) {
          settingsMessage.textContent = error.message;
          settingsMessage.dataset.tone = "error";
        } else {
          setMessage(error.message, "error");
        }
      }
    });
  });

  const selectedButton = document.querySelector("[data-print-selected]");
  if (selectedButton) {
    selectedButton.addEventListener("click", async () => {
      if (!activeJob?.code) return;
      const selectedFileIds = [...document.querySelectorAll("[data-print-select]:checked")].map((input) => input.value);
      const settingsMessage = document.getElementById("print-settings-message");
      if (!selectedFileIds.length) {
        if (settingsMessage) {
          settingsMessage.textContent = "Selectionnez au moins un fichier.";
          settingsMessage.dataset.tone = "error";
        }
        return;
      }
      selectedButton.disabled = true;
      selectedButton.classList.add("is-busy");
      selectedButton.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>Impression en cours</span>`;
      try {
        const settings = await savePrintSettings();
        for (const fileId of selectedFileIds) {
          await sendPrintRequest(fileId, settings);
        }
        if (settingsMessage) {
          settingsMessage.textContent = `${selectedFileIds.length} fichier(s) en cours d'impression. Merci de patienter.`;
          settingsMessage.dataset.tone = "success";
        }
        selectedButton.disabled = false;
        selectedButton.classList.remove("is-busy");
        selectedButton.textContent = "Imprimer la selection";
        refreshPrintStatuses(activeJob);
        startPrintStatusPolling();
      } catch (error) {
        selectedButton.disabled = false;
        selectedButton.classList.remove("is-busy");
        selectedButton.textContent = "Imprimer la selection";
        if (settingsMessage) {
          settingsMessage.textContent = error.message;
          settingsMessage.dataset.tone = "error";
        } else {
          setMessage(error.message, "error");
        }
      }
    });
  }
}

async function uploadUsbFile() {
  const files = [...usbFileInput.files];
  if (!files.length) {
    setUsbMessage("Choisissez au moins un fichier.", "error");
    return;
  }
  const unsupportedFile = files.find((file) => !/\.(pdf|png|jpe?g|heic|heif)$/i.test(file.name));
  if (unsupportedFile) {
    setUsbMessage("Formats acceptes : PDF, PNG, JPG, JPEG et HEIC.", "error");
    return;
  }

  const formData = new FormData();
  formData.set("station", currentStation());
  formData.set("printMode", "noir-blanc");
  formData.set("customerName", "Cle USB");
  for (const file of files) {
    formData.append("files", file);
  }
  setUsbMessage("Chargement du fichier...");

  try {
    const endpoint = activeJob?.code ? `/api/jobs/${activeJob.code}/files` : "/api/jobs";
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    setUsbMessage(activeJob?.code ? "Fichier ajoute a la session." : "Fichier charge.", "success");
    renderJob(payload);
  } catch (error) {
    setUsbMessage(error.message, "error");
  }
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
  stopPrintStatusPolling();
  try {
    await fetch(`/api/jobs/${code}`, { method: "DELETE" });
  } catch (error) {
    // The visual flow still resets even if the file was already removed.
  }
  activeJob = null;
  selectedPrintFileIds = new Set();
  knownPrintableFileIds = new Set();
  printSelectionReady = false;
  activePreviewFileId = "";
  currentCode = "";
  filesContainer.innerHTML = "";
  filesContainer.classList.add("hidden");
  pickupCode.value = "";
  setMessage(finalMessage, "success");
}

async function disconnectSession() {
  stopUsbReminder();
  if (activeJob?.code) {
    await deleteCurrentJob("Session terminee. Vos fichiers ont ete supprimes.");
  }
  showHome();
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
      disconnectSession();
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
    uploadQr.src = `/qr.gif?station=${currentStation()}`;
  }
}

function renderJob(job, resetTimer = true) {
  activeJob = job;
  if (!job.files.length) {
    filesContainer.innerHTML = "";
    filesContainer.classList.add("hidden");
    setMessage("Aucun fichier dans ce depot.", "error");
    return;
  }

  usbPanel.classList.add("hidden");
  mobilePanel.classList.add("hidden");
  filesContainer.classList.remove("hidden");
  setMessage(`${job.files.length} fichier(s) disponible(s) pour le code ${job.code}.`, "success");
  const printableFiles = job.files.filter(isPrintable);
  const hasPrintable = printableFiles.length > 0;
  const previewFile = firstPreviewFile(job);
  syncSelectedPrintFiles(job);
  activePreviewFileId = previewFile?.id || "";
  filesContainer.innerHTML = `
    <div class="job-head">
      <div>
        <span>Code ${job.code}</span>
        <strong>${job.customerName || "Client"}</strong>
        <small id="deletion-countdown">Suppression automatique dans 3 minutes</small>
      </div>
      ${job.customerName === "Cle USB" ? `
        <div class="panel-actions">
          <button class="text-link" type="button" data-show-usb-picker>Ajouter depuis la cle USB</button>
          <button class="text-link eject-usb-button" type="button" data-eject-usb>Ejecter la cle USB</button>
        </div>
      ` : ""}
    </div>
    <div class="job-workspace">
      <main class="document-stage">
        ${renderFilePreview(previewFile)}
        <div class="file-strip">
          ${job.files.map((file) => `
            <article class="file-card">
              ${isPrintable(file) ? `<label class="print-select"><input type="checkbox" data-print-select value="${file.id}"${selectedPrintFileIds.has(file.id) ? " checked" : ""}><span>Selection</span></label>` : ""}
              <div class="file-main">
                <strong>${file.originalName}</strong>
                <small>${file.extension.toUpperCase()} - ${formatSize(file.size)} - ${file.pages || 1} page(s)</small>
              </div>
              <div class="file-actions">
                ${(isPdf(file) || isImage(file)) ? `<button class="preview-button" type="button" data-preview-file="${file.id}">${activePreviewFileId === file.id ? "Affiche" : "Voir"}</button>` : ""}
                ${isPrintable(file) ? `<button class="primary-print-button" type="button" data-print-file="${file.id}">Imprimer</button>` : `<span class="counter-pill">Au comptoir</span>`}
                <span class="counter-pill${latestPrintStatus(file.id) ? "" : " hidden"}" data-print-status="${file.id}">${latestPrintStatus(file.id)}</span>
              </div>
            </article>
          `).join("")}
        </div>
      </main>
      <aside class="job-controls">
        ${hasPrintable ? renderPrintSettings(job.printSettings) : `
          <div class="counter-notice">
            <strong>Impression au comptoir</strong>
            <span>Les fichiers Word doivent etre presentes a l'equipe Bureau Vallee.</span>
          </div>
        `}
        ${printableFiles.length > 1 ? `
          <div class="multi-print-panel">
            <strong>Impression multiple</strong>
            <span>Cochez les fichiers a imprimer puis lancez la selection. Ils partiront un par un au copieur.</span>
            <button class="settings-save-button" type="button" data-print-selected>Imprimer la selection</button>
          </div>
        ` : ""}
        ${printableFiles.length > 1 ? `
          <div class="counter-notice">
            <strong>Apercu</strong>
            <span>L'apercu affiche le premier fichier compatible. Utilisez la liste pour imprimer chaque document.</span>
          </div>
        ` : ""}
      </aside>
    </div>
  `;
  attachPrintSettingsForm();
  attachPrintButtons();

  if (resetTimer) startDeletionTimer();
  else updateDeletionCountdown();
  startPrintStatusPolling();
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
    stopPrintStatusPolling();
    setMessage(error.message, "error");
  }
});

closeExpirationModalBtn.addEventListener("click", () => {
  expirationModal.classList.add("hidden");
});

document.querySelectorAll("[data-flow]").forEach((button) => {
  button.addEventListener("click", () => showFlow(button.dataset.flow));
});

document.querySelectorAll("[data-back-home]").forEach((button) => {
  button.addEventListener("click", disconnectSession);
});

disconnectSessionBtn.addEventListener("click", disconnectSession);
if (helpButton) helpButton.addEventListener("click", requestHelp);

usbForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadUsbFile();
});

usbFileInput.addEventListener("change", uploadUsbFile);

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-eject-usb]")) requestUsbEject();
  if (event.target.closest("[data-show-usb-picker]")) showUsbPickerForCurrentJob();
  const previewButton = event.target.closest("[data-preview-file]");
  if (previewButton && activeJob) {
    activePreviewFileId = previewButton.dataset.previewFile;
    renderJob(activeJob, false);
  }
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-print-select]");
  if (!checkbox) return;
  if (checkbox.checked) selectedPrintFileIds.add(checkbox.value);
  else selectedPrintFileIds.delete(checkbox.value);
});

loadConfig();
