const station = window.location.pathname.includes("poste-2") ? "poste-2" : "poste-1";
const stationLabel = document.getElementById("station-label");
const homeScreen = document.getElementById("home-screen");
const printScreen = document.getElementById("print-screen");
const usbButton = document.getElementById("usb-button");
const qrButton = document.getElementById("qr-button");
const usbFiles = document.getElementById("usb-files");
const statusMessage = document.getElementById("status-message");
const jobCode = document.getElementById("job-code");
const documentCount = document.getElementById("document-count");
const documentList = document.getElementById("document-list");
const previewBox = document.getElementById("preview-box");
const previewPages = document.getElementById("preview-pages");
const printButton = document.getElementById("print-button");
const printStatus = document.getElementById("print-status");
const printModal = document.getElementById("print-modal");
const printSteps = document.getElementById("print-steps");
const loadingModal = document.getElementById("loading-modal");
const loadingTitle = document.getElementById("loading-title");
const loadingText = document.getElementById("loading-text");
const infoModal = document.getElementById("info-modal");
const infoTitle = document.getElementById("info-title");
const infoText = document.getElementById("info-text");
const closeInfo = document.getElementById("close-info");
const infoOk = document.getElementById("info-ok");
const backHome = document.getElementById("back-home");
const addMoreFiles = document.getElementById("add-more-files");
const endSessionButton = document.getElementById("end-session");
const copiesInput = document.getElementById("copies");
const pageRangeInput = document.getElementById("page-range");
const qrModal = document.getElementById("qr-modal");
const qrImage = document.getElementById("qr-image");
const uploadUrl = document.getElementById("upload-url");
const qrCodeInput = document.getElementById("qr-code-input");
const loadCode = document.getElementById("load-code");
const closeQr = document.getElementById("close-qr");
const copyUrl = document.getElementById("copy-url");

let currentJob = null;
let selectedFileId = "";
let inactivityTimer = null;
let sessionCloseTimer = null;
let inactivityVisible = false;

function stationName() {
  return station === "poste-2" ? "Poste 2" : "Poste 1";
}

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function setPrintStatus(message, tone = "") {
  printStatus.textContent = message;
  printStatus.dataset.tone = tone;
}

function showPrintModal(active) {
  printModal.classList.toggle("hidden", !active);
}

function setPrintStep(step) {
  if (!printSteps) return;
  const order = ["prepare", "server", "queue", "printer"];
  const activeIndex = order.indexOf(step);
  printSteps.querySelectorAll("li").forEach((item) => {
    const itemIndex = order.indexOf(item.dataset.step);
    item.classList.toggle("done", activeIndex > itemIndex);
    item.classList.toggle("active", activeIndex === itemIndex);
  });
}

function showLoading(active, title = "Recherche en cours", text = "Le serveur prepare votre demande.") {
  loadingTitle.textContent = title;
  loadingText.textContent = text;
  loadingModal.classList.toggle("hidden", !active);
}

function showInfo(title, text) {
  infoTitle.textContent = title;
  infoText.textContent = text;
  infoModal.classList.remove("hidden");
}

function hideInfo() {
  infoModal.classList.add("hidden");
}

function resetInactivityTimer() {
  window.clearTimeout(inactivityTimer);
  window.clearTimeout(sessionCloseTimer);
  if (printScreen.classList.contains("hidden")) return;
  inactivityTimer = window.setTimeout(() => {
    if (printScreen.classList.contains("hidden") || inactivityVisible) return;
    inactivityVisible = true;
    showInfo("Session inactive", "Touchez l'ecran ou bougez la souris pour continuer. Sans action, la session sera fermee automatiquement.");
  }, 30000);
  sessionCloseTimer = window.setTimeout(() => {
    if (printScreen.classList.contains("hidden")) return;
    endSession(true);
  }, 180000);
}

function wakeSession() {
  if (inactivityVisible) {
    inactivityVisible = false;
    hideInfo();
  }
  resetInactivityTimer();
}

function showPrintScreen() {
  homeScreen.classList.add("hidden");
  printScreen.classList.remove("hidden");
  resetInactivityTimer();
}

function showHomeScreen() {
  printScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  window.clearTimeout(inactivityTimer);
  window.clearTimeout(sessionCloseTimer);
}

function extension(file) {
  const value = String(file?.extension || "").toLowerCase();
  return value.startsWith(".") ? value : `.${value}`;
}

function fileLabel(file) {
  return extension(file).replace(".", "").toUpperCase() || "DOC";
}

function renderPreview(file) {
  if (!file) {
    previewPages.textContent = "1 / 1";
    previewBox.innerHTML = "<p>Selectionnez un document.</p>";
    return;
  }

  previewPages.textContent = `1 / ${file.pages || 1}`;
  const ext = extension(file);
  if (ext === ".pdf") {
    previewBox.innerHTML = `<iframe src="${file.viewUrl}" title="${file.originalName}"></iframe>`;
  } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    previewBox.innerHTML = `<img src="${file.viewUrl}" alt="${file.originalName}">`;
  } else {
    previewBox.innerHTML = `
      <div class="preview-fallback">
        <strong>${file.originalName}</strong>
        <p>Ce format ne peut pas etre previsualise ici. Il reste dans la liste pour traitement.</p>
      </div>
    `;
  }
}

function renderJob(job) {
  currentJob = job;
  selectedFileId = job.files.some((file) => file.id === selectedFileId) ? selectedFileId : job.files[0]?.id || "";
  jobCode.textContent = `Code dossier ${job.code}`;
  documentCount.textContent = String(job.files.length);
  documentList.innerHTML = job.files.length ? job.files.map((file) => `
    <article class="document-item ${file.id === selectedFileId ? "active" : ""}" data-file-id="${file.id}">
      <span>${fileLabel(file)}</span>
      <strong>${file.originalName}</strong>
      <small>${(file.size / 1024 / 1024).toFixed(1)} Mo - ${file.pages || 1} page(s)</small>
      <button class="delete-file" type="button" data-delete-file="${file.id}" aria-label="Supprimer ${file.originalName}">x</button>
    </article>
  `).join("") : `<p class="empty-documents">Aucun document dans cette session.</p>`;
  renderPreview(job.files.find((file) => file.id === selectedFileId) || job.files[0]);
  showPrintScreen();
}

function printSettings() {
  return {
    colorMode: document.querySelector("input[name='colorMode']:checked")?.value || "noir-blanc",
    duplex: document.querySelector("input[name='duplex']:checked")?.value || "recto",
    paperSize: "A4",
    scaling: "ajuster",
    orientation: "auto",
    pageRange: pageRangeInput.value.trim(),
    pagesPerSheet: 1,
    copies: Math.max(1, Number.parseInt(copiesInput.value, 10) || 1),
  };
}

function qrParams() {
  return new URLSearchParams({ station, source: "qr" }).toString();
}

function openQrModal() {
  const params = qrParams();
  const url = `${window.location.origin}/upload?${params}`;
  qrImage.src = `/qr.svg?${params}&t=${Date.now()}`;
  uploadUrl.value = url;
  qrCodeInput.value = "";
  qrModal.classList.remove("hidden");
  setStatus("Scannez le QR code pour envoyer vos documents.", "success");
}

async function loadJobFromCode() {
  const code = String(qrCodeInput.value || "").replace(/\D/g, "").slice(0, 4);
  if (code.length !== 4) {
    showInfo("Code invalide", "Entrez le code a 4 chiffres affiche sur le telephone.");
    return;
  }

  showLoading(true, "Recherche du dossier", "Le serveur recherche les fichiers envoyes.");
  try {
    const response = await fetch(`/api/jobs/${code}?station=${station}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Code introuvable.");
    selectedFileId = payload.files[0]?.id || "";
    qrModal.classList.add("hidden");
    renderJob(payload);
    showInfo("Dossier ouvert", "Vos fichiers sont disponibles sur le poste.");
  } catch (error) {
    showInfo("Code introuvable", error.message);
  } finally {
    showLoading(false);
  }
}

async function uploadUsbFiles(files) {
  if (!files.length) return;
  const formData = new FormData();
  formData.set("station", station);
  formData.set("customerName", `Client ${stationName()}`);
  formData.set("source", "usb");
  formData.set("printMode", "noir-blanc");
  files.forEach((file) => formData.append("files", file));

  setStatus("Chargement des fichiers de la cle USB...");
  showLoading(true, "Chargement en cours", "Le serveur recupere vos fichiers.");
  usbButton.disabled = true;
  qrButton.disabled = true;

  try {
    const response = await fetch("/api/jobs", { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    setStatus(`Fichiers recus. Code dossier : ${payload.code}`, "success");
    selectedFileId = payload.files[0]?.id || "";
    renderJob(payload);
    showInfo("Fichiers recus", "Vos documents sont prets. Verifiez l'apercu et les options avant d'imprimer.");
  } catch (error) {
    setStatus(error.message, "error");
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
    usbButton.disabled = false;
    qrButton.disabled = false;
    usbFiles.value = "";
  }
}

async function addFilesToCurrentJob(files) {
  if (!currentJob?.code) {
    await uploadUsbFiles(files);
    return;
  }
  if (!files.length) return;

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  setPrintStatus("Ajout des fichiers...");
  showLoading(true, "Ajout en cours", "Le serveur ajoute vos documents a la session.");

  try {
    const response = await fetch(`/api/jobs/${currentJob.code}/files`, { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Ajout impossible.");
    selectedFileId = payload.files[payload.files.length - 1]?.id || selectedFileId;
    setPrintStatus("Fichiers ajoutes.", "success");
    renderJob(payload);
    showInfo("Fichiers ajoutes", "Les nouveaux documents sont disponibles dans la liste.");
  } catch (error) {
    setPrintStatus(error.message, "error");
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
  }
}

async function deleteFile(fileId) {
  if (!currentJob?.code || !fileId) return;
  showLoading(true, "Suppression en cours", "Le serveur supprime le fichier de la session.");
  try {
    const response = await fetch(`/api/jobs/${currentJob.code}/files/${fileId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
    if (selectedFileId === fileId) selectedFileId = payload.files[0]?.id || "";
    renderJob(payload);
    showInfo("Fichier supprime", "Le document a ete retire de la session.");
  } catch (error) {
    showInfo("Erreur", error.message);
  } finally {
    showLoading(false);
  }
}

async function printSelectedFile() {
  if (!currentJob?.code || !selectedFileId) {
    setPrintStatus("Selectionnez un document.", "error");
    showInfo("Aucun document", "Selectionnez un document avant d'imprimer.");
    return;
  }
  setPrintStatus("Envoi au copieur...");
  showPrintModal(true);
  setPrintStep("prepare");
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    setPrintStep("server");
    const response = await fetch(`/api/jobs/${currentJob.code}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: selectedFileId, settings: printSettings() }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Impression impossible.");
    setPrintStep("queue");
    currentJob = payload.job;
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setPrintStep("printer");
    setPrintStatus("Impression envoyee au copieur.", "success");
    showInfo("Impression envoyee", "Vos documents ont ete transmis au copieur.");
  } catch (error) {
    setPrintStatus(error.message || "Impression impossible.", "error");
    showInfo("Erreur", error.message || "Impression impossible.");
  } finally {
    window.setTimeout(() => showPrintModal(false), 1800);
  }
}

async function endSession(isAutomatic = false) {
  window.clearTimeout(inactivityTimer);
  window.clearTimeout(sessionCloseTimer);
  showLoading(true, "Fin de session", isAutomatic ? "La session inactive est fermee automatiquement." : "Nettoyage du dossier en cours.");
  try {
    if (currentJob?.code) await fetch(`/api/jobs/${currentJob.code}`, { method: "DELETE" });
    currentJob = null;
    selectedFileId = "";
    renderPreview(null);
    documentList.innerHTML = "";
    documentCount.textContent = "0";
    showHomeScreen();
    showInfo("Session terminee", isAutomatic ? "La session a ete fermee apres inactivite." : "Merci. Vous pouvez retirer vos documents et votre cle USB si vous en avez utilise une.");
  } catch (error) {
    showInfo("Erreur", "Impossible de terminer la session pour le moment.");
  } finally {
    showLoading(false);
  }
}

stationLabel.textContent = stationName();

usbButton.addEventListener("click", () => usbFiles.click());
qrButton.addEventListener("click", openQrModal);

usbFiles.addEventListener("change", () => {
  if (currentJob?.code && !printScreen.classList.contains("hidden")) addFilesToCurrentJob([...usbFiles.files]);
  else uploadUsbFiles([...usbFiles.files]);
});

documentList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-file]");
  if (deleteButton) {
    deleteFile(deleteButton.dataset.deleteFile);
    return;
  }
  const item = event.target.closest("[data-file-id]");
  if (!item || !currentJob) return;
  selectedFileId = item.dataset.fileId;
  renderJob(currentJob);
});

printButton.addEventListener("click", printSelectedFile);
backHome.addEventListener("click", showHomeScreen);
addMoreFiles.addEventListener("click", () => usbFiles.click());
closeQr.addEventListener("click", () => qrModal.classList.add("hidden"));
loadCode.addEventListener("click", loadJobFromCode);
qrCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadJobFromCode();
});

copyUrl.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(uploadUrl.value);
  showInfo("Lien copie", "Le lien d'envoi a ete copie.");
});

closeInfo.addEventListener("click", () => {
  inactivityVisible = false;
  hideInfo();
  resetInactivityTimer();
});

infoOk.addEventListener("click", () => {
  inactivityVisible = false;
  hideInfo();
  resetInactivityTimer();
});

endSessionButton.addEventListener("click", endSession);

["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
  window.addEventListener(eventName, wakeSession, { passive: true });
});
