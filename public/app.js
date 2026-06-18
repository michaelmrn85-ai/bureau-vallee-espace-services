const codeForm = document.getElementById("code-form");
const pickupCode = document.getElementById("pickup-code");
const message = document.getElementById("message");
const homeMessage = document.getElementById("home-message");
const filesContainer = document.getElementById("files");
const uploadUrlLabel = document.getElementById("upload-url");
const uploadQr = document.getElementById("upload-qr");
const stationTitle = document.getElementById("station-title");
const stationPrinterLabel = document.getElementById("station-printer-label");
const homeClock = document.getElementById("home-clock");
const identityScreen = document.getElementById("identity-screen");
const identityForm = document.getElementById("identity-form");
const customerCivilityInput = document.getElementById("customer-civility");
const customerLastNameInput = document.getElementById("customer-last-name");
const customerFirstNameInput = document.getElementById("customer-first-name");
const customerPrintCardInput = document.getElementById("customer-print-card");
const customerGreeting = document.getElementById("customer-greeting");
const expirationModal = document.getElementById("expiration-modal");
const expirationCountdown = document.getElementById("expiration-countdown");
const closeExpirationModalBtn = document.getElementById("close-expiration-modal");
const printStatusModal = document.getElementById("print-status-modal");
const printStatusTitle = document.getElementById("print-status-title");
const printStatusDetail = document.getElementById("print-status-detail");
const sessionCloseModal = document.getElementById("session-close-modal");
const sessionCloseCountdown = document.getElementById("session-close-countdown");
const usbEjectModal = document.getElementById("usb-eject-modal");
const closeUsbEjectModalBtn = document.getElementById("close-usb-eject-modal");
const choiceGrid = document.querySelector(".choice-grid");
const formatPanel = document.querySelector(".format-panel");
const usbPanel = document.getElementById("usb-panel");
const mobilePanel = document.getElementById("mobile-panel");
const webmailPanel = document.getElementById("webmail-panel");
const usbForm = document.getElementById("usb-form");
const usbFileInput = document.getElementById("usb-file-input");
const usbMessage = document.getElementById("usb-message");
const webmailMessage = document.getElementById("webmail-message");
const clientSessionToolbar = document.getElementById("client-session-toolbar");
const clientSessionLabel = document.getElementById("client-session-label");
const disconnectSessionBtn = document.getElementById("disconnect-session");
const helpButton = document.getElementById("help-button");
let currentCode = "";
let activeJob = null;
let currentFlow = "";
let currentCustomer = { civility: "", firstName: "", lastName: "", printCard: false };
let deletionSeconds = 0;
let deletionInterval = null;
let expirationWarningShown = false;
let printStatusInterval = null;
let usbReminderTimer = null;
let activePreviewFileId = "";
let selectedPrintFileIds = new Set();
let knownPrintableFileIds = new Set();
let printSelectionReady = false;
let printStatusHideTimer = null;
let usbEjectHideTimer = null;
let clockInterval = null;
let sessionCloseInterval = null;
const SESSION_SECONDS = 300;
const SESSION_CLOSE_SECONDS = 10;
const WEBMAILS = {
  gmail: "https://mail.google.com/",
  outlook: "https://outlook.live.com/mail/",
  orange: "https://mail.orange.fr/",
  yahoo: "https://mail.yahoo.com/",
  laposte: "https://www.laposte.net/accueil",
  free: "https://zimbra.free.fr/",
};

function cleanNamePart(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function customerFullName() {
  return [currentCustomer.firstName, currentCustomer.lastName].filter(Boolean).join(" ").trim();
}

function customerCivilityLabel() {
  if (currentCustomer.civility === "madame") return "Madame";
  if (currentCustomer.civility === "monsieur") return "Monsieur";
  return "";
}

function customerDisplayName() {
  const civility = customerCivilityLabel();
  const lastName = currentCustomer.lastName ? currentCustomer.lastName.toUpperCase() : "";
  return [civility, currentCustomer.firstName, lastName].filter(Boolean).join(" ").trim() || "client";
}

function updateCustomerGreeting() {
  if (!customerGreeting) return;
  const name = customerDisplayName();
  customerGreeting.textContent = `Bonjour ${name}`;
  customerGreeting.classList.toggle("hidden", !customerFullName());
}

function customerQueryParams() {
  const params = new URLSearchParams({
    station: currentStation(),
    customerName: customerFullName(),
    civility: currentCustomer.civility,
    printCard: currentCustomer.printCard ? "1" : "0",
  });
  return params.toString();
}

function showIdentityScreen() {
  identityScreen.classList.remove("hidden");
  document.body.classList.add("needs-identity");
  window.setTimeout(() => customerLastNameInput.focus(), 50);
}

function hideIdentityScreen() {
  identityScreen.classList.add("hidden");
  document.body.classList.remove("needs-identity");
}

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

function setWebmailMessage(text, tone = "") {
  webmailMessage.textContent = text;
  webmailMessage.dataset.tone = tone;
}

function updateHomeClock() {
  const now = new Date();
  const value = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  homeClock.textContent = value;
  homeClock.dateTime = now.toISOString();
}

function startHomeClock() {
  updateHomeClock();
  window.clearInterval(clockInterval);
  clockInterval = window.setInterval(updateHomeClock, 1000);
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
  clientSessionLabel.textContent = `${customerDisplayName()} - ${label}`;
  clientSessionToolbar.classList.remove("hidden");
  document.body.classList.add("client-session-active");
}

function showHome(resetCustomer = true) {
  stopDeletionTimer();
  stopPrintStatusPolling();
  stopUsbReminder();
  hidePrintStatusModal();
  hideSessionCloseModal();
  activeJob = null;
  activePreviewFileId = "";
  selectedPrintFileIds = new Set();
  knownPrintableFileIds = new Set();
  printSelectionReady = false;
  currentCode = "";
  currentFlow = "";
  pickupCode.value = "";
  filesContainer.innerHTML = "";
  filesContainer.classList.add("hidden");
  usbPanel.classList.add("hidden");
  mobilePanel.classList.add("hidden");
  webmailPanel.classList.add("hidden");
  clientSessionToolbar.classList.add("hidden");
  document.body.classList.remove("client-session-active");
  choiceGrid.classList.remove("hidden");
  formatPanel.classList.remove("hidden");
  setMessage("");
  setHomeMessage("");
  setUsbMessage("");
  setWebmailMessage("");
  if (resetCustomer) {
    currentCustomer = { civility: "", firstName: "", lastName: "", printCard: false };
    identityForm.reset();
    updateCustomerGreeting();
    showIdentityScreen();
  }
}

function hideSessionCloseModal() {
  window.clearInterval(sessionCloseInterval);
  sessionCloseInterval = null;
  sessionCloseModal.classList.add("hidden");
}

async function queueStationCommand(type, payload = {}) {
  const response = await fetch(`/api/stations/${currentStation()}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Commande impossible.");
  return data;
}

async function cleanupWebmailSession() {
  try {
    await queueStationCommand("cleanup-browser");
  } catch (error) {
    // Cleaning is best-effort; the interface must still return to the welcome screen.
  }
}

async function waitForStationCommand(commandId, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const response = await fetch(`/api/stations/${currentStation()}/commands/${commandId}`);
    const payload = await response.json();
    if (!response.ok) return { status: "missing" };
    if (payload.command?.status === "done" || payload.command?.status === "failed") return payload.command;
  }
  return { status: "timeout" };
}

function showFlow(flow) {
  if (!customerFullName()) {
    showIdentityScreen();
    return;
  }
  currentFlow = flow;
  const labels = {
    usb: "Impression via cle USB",
    mobile: "Impression via mobile",
    webmail: "Impression via mail",
  };
  startClientSession(labels[flow] || "Impression");
  if (flow === "usb") startUsbReminder();
  else stopUsbReminder();
  choiceGrid.classList.add("hidden");
  formatPanel.classList.add("hidden");
  filesContainer.classList.add("hidden");
  filesContainer.innerHTML = "";
  webmailPanel.classList.add("hidden");
  if (flow === "usb") {
    usbPanel.classList.remove("hidden");
    mobilePanel.classList.add("hidden");
    usbFileInput.value = "";
    setUsbMessage("");
    return;
  }
  if (flow === "webmail") {
    webmailPanel.classList.remove("hidden");
    usbPanel.classList.add("hidden");
    mobilePanel.classList.add("hidden");
    setWebmailMessage("Choisissez votre boite mail. Les donnees seront nettoyees en fin de session.", "success");
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
          <p class="eyebrow">Options d'impression</p>
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
      <div class="print-settings-actions">
        <button class="settings-save-button" type="submit">Appliquer les reglages</button>
        <button class="settings-save-button main-print-button" type="button" data-print-selected>Imprimer la selection</button>
      </div>
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

function latestPrintRequest(job = activeJob) {
  return [...(job?.printRequests || [])].reverse()[0] || null;
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
  updatePrintStatusModal(job);
}

function hidePrintStatusModal() {
  window.clearTimeout(printStatusHideTimer);
  printStatusHideTimer = null;
  printStatusModal.classList.add("hidden");
}

function updatePrintStatusModal(job = activeJob) {
  const request = latestPrintRequest(job);
  if (!request) {
    hidePrintStatusModal();
    return;
  }

  window.clearTimeout(printStatusHideTimer);
  printStatusHideTimer = null;
  printStatusModal.dataset.status = request.status;

  if (request.status === "queued") {
    printStatusTitle.textContent = "En attente";
    printStatusDetail.textContent = `${customerDisplayName()}, vos impressions sont envoyees au copieur.${currentFlow === "usb" || job?.source === "usb" ? " N'oubliez pas votre cle USB." : ""}`;
    printStatusModal.classList.remove("hidden");
    return;
  }

  if (request.status === "printing") {
    printStatusTitle.textContent = "Impression en cours";
    printStatusDetail.textContent = `${customerDisplayName()}, merci de patienter.${currentFlow === "usb" || job?.source === "usb" ? " N'oubliez pas votre cle USB." : ""}`;
    printStatusModal.classList.remove("hidden");
    return;
  }

  if (request.status === "done") {
    printStatusTitle.textContent = "Imprime";
    printStatusDetail.textContent = "Merci de recuperer vos impressions et de vous rapprocher de la caisse.";
    printStatusModal.classList.remove("hidden");
    printStatusHideTimer = window.setTimeout(hidePrintStatusModal, 3500);
    return;
  }

  if (request.status === "failed") {
    printStatusTitle.textContent = "Erreur d'impression";
    printStatusDetail.textContent = "Merci de demander de l'aide a un vendeur.";
    printStatusModal.classList.remove("hidden");
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
        <div class="image-preview-frame">
          <img src="${file.viewUrl}" alt="Apercu du fichier ${file.originalName}">
        </div>
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
    notify("Votre cle USB peut etre ejectee. Vous pouvez la retirer.", "success");
    window.clearTimeout(usbEjectHideTimer);
    usbEjectModal.classList.remove("hidden");
    usbEjectHideTimer = window.setTimeout(() => {
      usbEjectModal.classList.add("hidden");
    }, 10000);
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
        updatePrintStatusModal(activeJob);
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
        updatePrintStatusModal(activeJob);
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
  const unsupportedFile = files.find((file) => !/\.(pdf|png|jpe?g|heic|heif|webp)$/i.test(file.name));
  if (unsupportedFile) {
    setUsbMessage("Formats acceptes : PDF, PNG, JPG, JPEG, HEIC et WebP.", "error");
    return;
  }

  const formData = new FormData();
  formData.set("station", currentStation());
  formData.set("printMode", "noir-blanc");
  formData.set("customerName", customerFullName() || "Client cle USB");
  formData.set("civility", currentCustomer.civility);
  formData.set("printCard", currentCustomer.printCard ? "1" : "0");
  formData.set("source", "usb");
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
  hidePrintStatusModal();
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

async function deleteFileFromJob(fileId) {
  if (!activeJob?.code || !fileId) return;
  setMessage("Suppression du fichier...");
  try {
    const response = await fetch(`/api/jobs/${activeJob.code}/files/${fileId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
    selectedPrintFileIds.delete(fileId);
    knownPrintableFileIds.delete(fileId);
    if (activePreviewFileId === fileId) activePreviewFileId = "";
    if (payload.files?.length) {
      renderJob(payload, false);
      setMessage("Fichier supprime.", "success");
      return;
    }
    showHome();
    setHomeMessage("Tous les fichiers ont ete supprimes.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function disconnectSession() {
  stopUsbReminder();
  await cleanupWebmailSession();
  const hadFiles = Boolean(activeJob?.code);
  if (hadFiles) {
    await deleteCurrentJob("Session terminee. Vos fichiers ont ete supprimes.");
  }
  if (!hadFiles) {
    showHome();
    return;
  }
  let remaining = SESSION_CLOSE_SECONDS;
  const updateCloseCountdown = () => {
    const progress = Math.max(0, Math.min(1, remaining / SESSION_CLOSE_SECONDS));
    sessionCloseCountdown.textContent = String(remaining);
    sessionCloseCountdown.style.setProperty("--timer-progress", `${progress * 360}deg`);
  };

  hideSessionCloseModal();
  sessionCloseModal.classList.remove("hidden");
  updateCloseCountdown();

  sessionCloseInterval = window.setInterval(() => {
    remaining -= 1;
    updateCloseCountdown();
    if (remaining <= 0) {
      hideSessionCloseModal();
      showHome();
    }
  }, 1000);
}

async function openWebmail(provider) {
  const url = WEBMAILS[provider];
  if (!url) return;
  setWebmailMessage("Ouverture du navigateur securise...");
  try {
    const payload = await queueStationCommand("open-webmail", { url });
    const command = await waitForStationCommand(payload.command?.id);
    if (command.status === "done") {
      setWebmailMessage("Boite mail ouverte. Envoyez vos documents a l'adresse indiquee, puis demandez de l'aide si les fichiers ne sont pas encore visibles automatiquement.", "success");
      return;
    }
    if (command.status === "failed") throw new Error(command.error || "Ouverture impossible.");
    throw new Error("Le logiciel du poste ne repond pas. Appelez un vendeur.");
  } catch (error) {
    setWebmailMessage(error.message, "error");
  }
}

function updateDeletionCountdown() {
  const countdownLabel = document.getElementById("deletion-countdown");
  if (countdownLabel) {
    const minutes = Math.floor(Math.max(0, deletionSeconds) / 60);
    const seconds = String(Math.max(0, deletionSeconds) % 60).padStart(2, "0");
    const progress = Math.max(0, Math.min(1, deletionSeconds / SESSION_SECONDS));
    countdownLabel.textContent = `${minutes}:${seconds}`;
    countdownLabel.style.setProperty("--timer-progress", `${progress * 360}deg`);
    countdownLabel.classList.toggle("is-urgent", deletionSeconds <= 30);
  }
  if (expirationCountdown) {
    expirationCountdown.textContent = String(Math.max(0, deletionSeconds));
  }
}

function startDeletionTimer() {
  stopDeletionTimer();
  deletionSeconds = SESSION_SECONDS;
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
  if (stationPrinterLabel) stationPrinterLabel.textContent = currentStation() === "poste-2" ? "Copieur 2" : "Copieur 1";
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

function refreshQrIdentity() {
  const query = customerQueryParams();
  const publicBase = "https://bureau-vallee-espace-services.onrender.com";
  uploadUrlLabel.textContent = `${publicBase}/upload?${query}`;
  uploadQr.src = `/qr.gif?${query}`;
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
  const isUsbSession = currentFlow === "usb" || job.source === "usb";
  syncSelectedPrintFiles(job);
  activePreviewFileId = previewFile?.id || "";
  filesContainer.innerHTML = `
    <div class="job-head">
      <div class="session-timer">
        <span>Fin session</span>
        <strong id="deletion-countdown" style="--timer-progress: 360deg">5:00</strong>
      </div>
      <div>
        <span>Code ${job.code}</span>
        <strong>${job.customerName || "Client"}</strong>
      </div>
      <div class="panel-actions">
        ${isUsbSession ? `
          <button class="text-link" type="button" data-show-usb-picker>Ajouter depuis la cle USB</button>
          <button class="text-link eject-usb-button" type="button" data-eject-usb>Ejecter la cle USB</button>
        ` : ""}
        <button class="text-link end-session-button" type="button" data-end-session>Fin de session</button>
      </div>
    </div>
    <div class="job-workspace">
      <aside class="file-list-panel">
        <div class="file-list-heading">
          <span>Fichiers a imprimer</span>
          <strong>${job.files.length}</strong>
        </div>
        <div class="file-strip">
          ${job.files.map((file) => `
            <article class="file-card">
              ${isPrintable(file) ? `<label class="print-select"><input type="checkbox" data-print-select value="${file.id}"${selectedPrintFileIds.has(file.id) ? " checked" : ""}><span>Selection</span></label>` : ""}
              <div class="file-main">
                <strong>${file.originalName}</strong>
                <small>${file.extension.toUpperCase()} - ${formatSize(file.size)} - ${file.pages || 1} page(s)</small>
              </div>
              <div class="file-actions">
                <button class="file-remove-button" type="button" data-delete-file="${file.id}" title="Supprimer ce fichier">X</button>
                ${(isPdf(file) || isImage(file)) ? `<button class="preview-button" type="button" data-preview-file="${file.id}">${activePreviewFileId === file.id ? "Affiche" : "Voir"}</button>` : ""}
                ${!isPrintable(file) ? `<span class="counter-pill">Au comptoir</span>` : ""}
                <span class="counter-pill${latestPrintStatus(file.id) ? "" : " hidden"}" data-print-status="${file.id}">${latestPrintStatus(file.id)}</span>
              </div>
            </article>
          `).join("")}
        </div>
        <div class="file-list-footer">
          <label><input type="checkbox" data-select-all${selectedPrintFileIds.size === printableFiles.length && printableFiles.length ? " checked" : ""}> Tout selectionner (${printableFiles.length})</label>
          <button class="text-link end-session-button" type="button" data-end-session>Annuler</button>
        </div>
      </aside>
      <aside class="job-controls">
        ${hasPrintable ? renderPrintSettings(job.printSettings) : `
          <div class="counter-notice">
            <strong>Impression au comptoir</strong>
            <span>Les fichiers Word doivent etre presentes a l'equipe Bureau Vallee.</span>
          </div>
        `}
        ${printableFiles.length > 1 ? `
          <div class="counter-notice">
            <strong>Apercu</strong>
            <span>Cochez un ou plusieurs fichiers. Le bouton Imprimer lance tous les fichiers selectionnes.</span>
          </div>
        ` : ""}
      </aside>
      <main class="document-stage">
        ${renderFilePreview(previewFile)}
        <div class="preview-summary">
          <div><span>Documents selectionnes</span><strong>${selectedPrintFileIds.size} fichier(s)</strong></div>
          <div><span>Pages deposees</span><strong>${job.depositPages || 0} page(s)</strong></div>
          <div><span>Copies</span><strong>${job.printSettings?.copies || 1}</strong></div>
        </div>
      </main>
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
    const response = await fetch(`/api/jobs/${code}?${customerQueryParams()}`);
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

closeUsbEjectModalBtn.addEventListener("click", () => {
  window.clearTimeout(usbEjectHideTimer);
  usbEjectModal.classList.add("hidden");
});

document.querySelectorAll("[data-flow]").forEach((button) => {
  button.addEventListener("click", () => showFlow(button.dataset.flow));
});

identityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentCustomer = {
    civility: customerCivilityInput.value,
    lastName: cleanNamePart(customerLastNameInput.value),
    firstName: cleanNamePart(customerFirstNameInput.value),
    printCard: Boolean(customerPrintCardInput.checked),
  };
  if (!currentCustomer.civility || !currentCustomer.lastName || !currentCustomer.firstName) {
    showIdentityScreen();
    return;
  }
  hideIdentityScreen();
  updateCustomerGreeting();
  refreshQrIdentity();
  setHomeMessage(`Bonjour ${customerDisplayName()}, choisissez votre mode d'impression.`, "success");
});

document.querySelectorAll("[data-back-home]").forEach((button) => {
  button.addEventListener("click", disconnectSession);
});

if (disconnectSessionBtn) disconnectSessionBtn.addEventListener("click", disconnectSession);
if (helpButton) helpButton.addEventListener("click", requestHelp);

usbForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  uploadUsbFile();
});

usbFileInput.addEventListener("change", uploadUsbFile);

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-file]");
  if (deleteButton) {
    deleteFileFromJob(deleteButton.dataset.deleteFile);
    return;
  }
  if (event.target.closest("[data-end-session]")) {
    disconnectSession();
    return;
  }
  if (event.target.closest("[data-eject-usb]")) requestUsbEject();
  const webmailButton = event.target.closest("[data-webmail]");
  if (webmailButton) {
    openWebmail(webmailButton.dataset.webmail);
    return;
  }
  if (event.target.closest("[data-show-usb-picker]")) showUsbPickerForCurrentJob();
  const previewButton = event.target.closest("[data-preview-file]");
  if (previewButton && activeJob) {
    activePreviewFileId = previewButton.dataset.previewFile;
    renderJob(activeJob, false);
  }
});

document.addEventListener("change", (event) => {
  const selectAll = event.target.closest("[data-select-all]");
  if (selectAll && activeJob) {
    const printableIds = activeJob.files.filter(isPrintable).map((file) => file.id);
    selectedPrintFileIds = selectAll.checked ? new Set(printableIds) : new Set();
    renderJob(activeJob, false);
    return;
  }
  const checkbox = event.target.closest("[data-print-select]");
  if (!checkbox) return;
  if (checkbox.checked) selectedPrintFileIds.add(checkbox.value);
  else selectedPrintFileIds.delete(checkbox.value);
});

loadConfig();
startHomeClock();
showIdentityScreen();
