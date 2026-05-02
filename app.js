const ADMIN_PASSWORD = "BV558";
const STORAGE_KEY = "bv-espace-services-admin";
const STATS_KEY = "bv-espace-services-stats";
const SESSION_KEY = "bv-espace-services-current-session";
const COMMAND_KEY = "bv-espace-services-admin-command";
const IDLE_TIMEOUT_MS = 60 * 1000;
const IDLE_WARNING_MS = 15 * 1000;
const stationConfig = window.BV_APP_CONFIG || {};
const stationName = stationConfig.stationName || "POSTE DEMO";
const stationStorageId = stationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "poste-demo";
const stationSessionKey = `${SESSION_KEY}:${stationStorageId}`;
const stationCommandKey = `${COMMAND_KEY}:${stationStorageId}`;
const apiBaseUrl = stationConfig.apiBaseUrl || "";

const acceptedExtensions = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];
const conversionLabels = {
  pdf: "PDF pret",
  doc: "Conversion Word",
  docx: "Conversion Word",
  png: "Conversion image",
  jpg: "Conversion image",
  jpeg: "Conversion image",
};

const defaultAdminSettings = {
  printer1: stationConfig.printer1 || "COPIEUR 1",
  printer2: stationConfig.printer2 || "COPIEUR 2",
  uploadUrl: stationConfig.uploadUrl || "/upload.html",
  cleanupDelay: 3,
  deleteAfterPrint: true,
  remoteCleanup: true,
};

const state = {
  source: null,
  pickupCode: null,
  files: [],
  settings: {
    printer: stationConfig.defaultPrinter || "COPIEUR 1",
    color: "noir-blanc",
    sides: "recto",
    duplexBinding: "bord-long",
    orientation: "auto",
    paperSize: "A4",
    pageRange: "",
    copies: 1,
  },
  admin: loadAdminSettings(),
  adminUnlocked: false,
  stats: loadStats(),
  sessionSale: createEmptySessionSale(),
  printTimers: [],
  sessionActive: false,
  idleWarningTimer: null,
  idleCloseTimer: null,
  idleCountdownTimer: null,
  idleSecondsLeft: IDLE_WARNING_MS / 1000,
  lastAdminCommandId: null,
};

const screens = {
  sessionOpen: document.getElementById("screen-session-open"),
  sessionClosed: document.getElementById("screen-session-closed"),
  home: document.getElementById("screen-home"),
  source: document.getElementById("screen-source"),
  options: document.getElementById("screen-options"),
  printing: document.getElementById("screen-printing"),
};

const sourceButtons = [...document.querySelectorAll("[data-source]")];
const startSessionBtn = document.getElementById("start-session");
const restartSessionBtn = document.getElementById("restart-session");
const sourceTitle = document.getElementById("source-title");
const selectedSourceLabel = document.getElementById("selected-source-label");
const codeZone = document.getElementById("code-zone");
const usbZone = document.getElementById("usb-zone");
const pickupCodeInput = document.getElementById("pickup-code");
const loadCodeBtn = document.getElementById("load-code");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const fileCounter = document.getElementById("file-counter");
const clearFilesBtn = document.getElementById("clear-files");
const goToOptionsBtn = document.getElementById("go-to-options");
const backToHomeBtn = document.getElementById("back-to-home");
const backToSourceBtn = document.getElementById("back-to-source");
const startPrintBtn = document.getElementById("start-print");
const statusPill = document.getElementById("status-pill");
const uploadLinkLabel = document.getElementById("upload-link-label");
const qrCodeImage = document.getElementById("qr-code-image");
const copiesInput = document.getElementById("copies");
const pageRangeInput = document.getElementById("page-range");
const paperSizeSelect = document.getElementById("paper-size");
const liveSummary = document.getElementById("live-summary");
const summaryMetrics = document.getElementById("summary-metrics");
const jobFilesPreview = document.getElementById("job-files-preview");
const progressBar = document.getElementById("progress-bar");
const printTitle = document.getElementById("print-title");
const printDetail = document.getElementById("print-detail");
const printMetrics = document.getElementById("print-metrics");

const adminModal = document.getElementById("admin-modal");
const adminOpenBtn = document.getElementById("admin-open");
const adminCloseBtn = document.getElementById("admin-close");
const adminPasswordInput = document.getElementById("admin-password");
const adminLoginBtn = document.getElementById("admin-login");
const adminError = document.getElementById("admin-error");
const adminLoginBlock = document.getElementById("admin-login-block");
const adminPanel = document.getElementById("admin-panel");
const adminPrinter1 = document.getElementById("admin-printer-1");
const adminPrinter2 = document.getElementById("admin-printer-2");
const adminUploadUrl = document.getElementById("admin-upload-url");
const adminCleanupDelay = document.getElementById("admin-cleanup-delay");
const adminDeletePrint = document.getElementById("admin-delete-print");
const adminRemoteCleanup = document.getElementById("admin-remote-cleanup");
const adminSaveBtn = document.getElementById("admin-save");
const adminLogoutBtn = document.getElementById("admin-logout");
const adminBwPages = document.getElementById("admin-bw-pages");
const adminColorPages = document.getElementById("admin-color-pages");
const adminSessionCount = document.getElementById("admin-session-count");
const adminFileCount = document.getElementById("admin-file-count");
const adminCurrentSession = document.getElementById("admin-current-session");
const adminCurrentDetail = document.getElementById("admin-current-detail");
const adminCloseSessionBtn = document.getElementById("admin-close-session");
const adminResetStatsBtn = document.getElementById("admin-reset-stats");
const adminHistoryList = document.getElementById("admin-history-list");
const idleWarningModal = document.getElementById("idle-warning-modal");
const idleCountdown = document.getElementById("idle-countdown");
const idleContinueBtn = document.getElementById("idle-continue");
const idleCloseNowBtn = document.getElementById("idle-close-now");

function loadAdminSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAdminSettings };
    return { ...defaultAdminSettings, ...JSON.parse(raw) };
  } catch (error) {
    return { ...defaultAdminSettings };
  }
}

function saveAdminSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.admin));
}

function createEmptyStats() {
  return {
    bwPages: 0,
    colorPages: 0,
    sessions: 0,
    files: 0,
    sheets: 0,
    history: [],
  };
}

function createEmptySessionSale() {
  return {
    openedAt: null,
    closedAt: null,
    bwPages: 0,
    colorPages: 0,
    files: 0,
    sheets: 0,
    jobs: 0,
    totalDueHint: "",
    details: [],
  };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return createEmptyStats();
    return { ...createEmptyStats(), ...JSON.parse(raw) };
  } catch (error) {
    return createEmptyStats();
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
}

function saveCurrentSessionSnapshot() {
  const totals = computeTotals();
  const snapshot = {
    stationId: stationStorageId,
    stationName,
    active: state.sessionActive,
    lockedPrinter: stationConfig.lockPrinter ? state.admin.printer1 : null,
    defaultPrinter: state.admin.printer1,
    openedAt: state.sessionSale.openedAt,
    closedAt: state.sessionSale.closedAt,
    source: state.source,
    pickupCode: state.pickupCode,
    currentFiles: totals.files,
    currentPages: totals.totalImpressions,
    currentSheets: totals.totalSheets,
    files: state.sessionSale.files,
    bwPages: state.sessionSale.bwPages,
    colorPages: state.sessionSale.colorPages,
    pages: state.sessionSale.bwPages + state.sessionSale.colorPages,
    sheets: state.sessionSale.sheets,
    jobs: state.sessionSale.jobs,
    details: state.sessionSale.details,
    color: state.settings.color,
    printer: state.settings.printer,
    paperSize: state.settings.paperSize,
    sides: state.settings.sides,
    duplexBinding: state.settings.duplexBinding,
    pageRange: totals.rangeLabel,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(stationSessionKey, JSON.stringify(snapshot));
  localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  reportStationSnapshot(snapshot);
}

async function reportStationSnapshot(snapshot) {
  if (!apiBaseUrl) return;
  try {
    await fetch(`${apiBaseUrl}/api/stations/${stationStorageId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
  } catch (error) {
    console.warn("Etat poste non transmis", error);
  }
}

function getExtension(name) {
  const lowerName = name.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");
  return dotIndex >= 0 ? lowerName.slice(dotIndex + 1) : "";
}

function isAcceptedFile(name) {
  const lowerName = name.toLowerCase();
  return acceptedExtensions.some((extension) => lowerName.endsWith(extension));
}

function formatBytes(bytes) {
  if (!bytes) return "0 Ko";
  const units = ["o", "Ko", "Mo", "Go"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parsePageRange(rangeText, maxPages) {
  const range = rangeText.trim();
  if (!range) {
    return {
      valid: true,
      count: maxPages,
      label: "Toutes les pages",
    };
  }

  if (!/^\d+(\s*-\s*\d+)?(\s*,\s*\d+(\s*-\s*\d+)?)*$/.test(range)) {
    return {
      valid: false,
      count: 0,
      label: "Plage invalide",
    };
  }

  const pages = new Set();
  for (const part of range.split(",")) {
    const [startRaw, endRaw] = part.split("-").map((value) => Number(value.trim()));
    const start = startRaw;
    const end = endRaw || startRaw;

    if (!start || start < 1 || end < start) {
      return {
        valid: false,
        count: 0,
        label: "Plage invalide",
      };
    }

    for (let page = start; page <= Math.min(end, maxPages); page += 1) {
      pages.add(page);
    }
  }

  return {
    valid: pages.size > 0,
    count: pages.size,
    label: range,
  };
}

function getPageCountForFile(file) {
  return parsePageRange(state.settings.pageRange, file.pages);
}

async function estimatePages(file) {
  const extension = getExtension(file.name);
  if (extension !== "pdf") return 1;
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 1;
  } catch (error) {
    return 1;
  }
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("screen-active"));
  screens[name].classList.add("screen-active");
}

function hideIdleWarning() {
  idleWarningModal.classList.add("modal-hidden");
  if (state.idleCountdownTimer) clearInterval(state.idleCountdownTimer);
  state.idleCountdownTimer = null;
}

function clearIdleTimers() {
  if (state.idleWarningTimer) clearTimeout(state.idleWarningTimer);
  if (state.idleCloseTimer) clearTimeout(state.idleCloseTimer);
  if (state.idleCountdownTimer) clearInterval(state.idleCountdownTimer);
  state.idleWarningTimer = null;
  state.idleCloseTimer = null;
  state.idleCountdownTimer = null;
}

function isAdminModalOpen() {
  return Boolean(adminModal && !adminModal.classList.contains("modal-hidden"));
}

function showIdleWarning() {
  if (!state.sessionActive || isAdminModalOpen() || screens.printing.classList.contains("screen-active")) return;
  state.idleSecondsLeft = IDLE_WARNING_MS / 1000;
  idleCountdown.textContent = String(state.idleSecondsLeft);
  idleWarningModal.classList.remove("modal-hidden");

  state.idleCountdownTimer = setInterval(() => {
    state.idleSecondsLeft -= 1;
    idleCountdown.textContent = String(Math.max(0, state.idleSecondsLeft));
  }, 1000);
}

function resetIdleTimer() {
  if (!state.sessionActive || isAdminModalOpen() || screens.printing.classList.contains("screen-active")) return;
  clearIdleTimers();
  hideIdleWarning();
  state.idleWarningTimer = setTimeout(showIdleWarning, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
  state.idleCloseTimer = setTimeout(() => {
    closeCurrentSession("Session fermee automatiquement", true);
  }, IDLE_TIMEOUT_MS);
}

function hasActiveSession() {
  return Boolean(state.sessionActive);
}

function updateStatus(text, tone = "neutral") {
  statusPill.textContent = text;
  statusPill.dataset.tone = tone;
}

function resolveUploadUrl() {
  try {
    return new URL(state.admin.uploadUrl, window.location.href).href;
  } catch (error) {
    return state.admin.uploadUrl || "/upload.html";
  }
}

function applyAdminSettings() {
  const printerButtons = [...document.querySelectorAll('.seg-btn[data-setting="printer"]')];
  const uploadUrl = resolveUploadUrl();
  uploadLinkLabel.textContent = uploadUrl;
  qrCodeImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=210x210&margin=12&data=${encodeURIComponent(uploadUrl)}`;

  printerButtons[0].dataset.value = state.admin.printer1;
  printerButtons[0].textContent = state.admin.printer1;
  printerButtons[1].dataset.value = state.admin.printer2;
  printerButtons[1].textContent = state.admin.printer2;

  if (stationConfig.lockPrinter) {
    state.settings.printer = state.admin.printer1;
  } else if (![state.admin.printer1, state.admin.printer2].includes(state.settings.printer)) {
    state.settings.printer = state.admin.printer1;
  }

  printerButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === state.settings.printer);
    button.disabled = Boolean(stationConfig.lockPrinter);
    button.classList.toggle("hidden", Boolean(stationConfig.lockPrinter) && button.dataset.value !== state.settings.printer);
  });
}

function renderSourcePane() {
  const isCode = state.source === "code";
  selectedSourceLabel.textContent = isCode ? "Source : code de retrait" : "Source : cle USB";
  sourceTitle.textContent = isCode ? "Recuperer les fichiers envoyes" : "Selection depuis une cle USB";
  codeZone.classList.toggle("source-pane-hidden", !isCode);
  usbZone.classList.toggle("source-pane-hidden", isCode);
}

function emptyFileListMarkup() {
  return `
    <div class="empty-state">
      <strong>La liste des fichiers apparaitra ici.</strong>
      <p>Les formats courants sont acceptes et prepares en PDF avant impression.</p>
    </div>
  `;
}

function renderFileList() {
  if (!state.files.length) {
    fileList.innerHTML = emptyFileListMarkup();
    fileCounter.textContent = "Aucun fichier selectionne";
    clearFilesBtn.disabled = true;
    goToOptionsBtn.disabled = true;
    return;
  }

  fileCounter.textContent = `${state.files.length} fichier(s) selectionne(s)`;
  clearFilesBtn.disabled = false;
  goToOptionsBtn.disabled = false;

  fileList.innerHTML = state.files
    .map((item) => `
      <div class="file-row">
        <div class="file-meta">
          <strong>${item.name}</strong>
          <small>${formatBytes(item.size)} - ${item.originLabel}</small>
        </div>
        <div>
          <small>Pages</small>
          <input class="pages-input" type="number" min="1" value="${item.pages}" data-pages-id="${item.id}">
        </div>
        <div>
          <small>Preparation</small>
          <strong>${conversionLabels[item.extension] || "Pret"}</strong>
        </div>
        <button class="danger-btn" data-remove-id="${item.id}">Retirer</button>
      </div>
    `)
    .join("");
}

function computeTotals() {
  const copies = Math.max(1, Number(state.settings.copies) || 1);
  const rangeResults = state.files.map(getPageCountForFile);
  const rangeValid = rangeResults.every((result) => result.valid);
  const totalPagesSource = rangeValid
    ? rangeResults.reduce((sum, item) => sum + item.count, 0)
    : 0;
  const totalImpressions = totalPagesSource * copies;
  const totalSheets = rangeValid
    ? rangeResults.reduce((sum, item) => {
        const perCopy = state.settings.sides === "recto-verso" ? Math.ceil(item.count / 2) : item.count;
        return sum + perCopy * copies;
      }, 0)
    : 0;

  return {
    files: state.files.length,
    rangeValid,
    rangeLabel: state.settings.pageRange.trim() || "Toutes les pages",
    totalPagesSource,
    totalImpressions,
    totalSheets,
  };
}

function renderOptions() {
  const totals = computeTotals();
  const stationLabel = stationConfig.stationName ? `${stationConfig.stationName} - ` : "";
  liveSummary.innerHTML = `
    <p>
      ${totals.files} fichier(s), ${totals.totalPagesSource} page(s),
      ${totals.totalImpressions} impression(s), ${totals.totalSheets} feuille(s),
      destination <strong>${stationLabel}${state.settings.printer}</strong>.
      Plage : <strong>${totals.rangeValid ? totals.rangeLabel : "invalide"}</strong>.
    </p>
  `;

  summaryMetrics.innerHTML = `
    <div class="metric"><span>Fichiers</span><strong>${totals.files}</strong></div>
    <div class="metric"><span>Pages</span><strong>${totals.totalPagesSource}</strong></div>
    <div class="metric"><span>Impressions</span><strong>${totals.totalImpressions}</strong></div>
    <div class="metric"><span>Feuilles</span><strong>${totals.totalSheets}</strong></div>
  `;

  jobFilesPreview.innerHTML = state.files
    .map((item) => `
      <div class="summary-file-row">
        <div>
          <strong>${item.name}</strong>
          <small>${getPageCountForFile(item).count || 0}/${item.pages} page(s) - ${conversionLabels[item.extension] || "Pret"}</small>
        </div>
        <strong>${item.extension.toUpperCase()}</strong>
      </div>
    `)
    .join("");
}

function renderAdminStats() {
  saveCurrentSessionSnapshot();
  if (!adminBwPages) return;

  adminBwPages.textContent = String(state.stats.bwPages);
  adminColorPages.textContent = String(state.stats.colorPages);
  adminSessionCount.textContent = String(state.stats.sessions);
  adminFileCount.textContent = String(state.stats.files);

  if (hasActiveSession()) {
    const totals = computeTotals();
    const colorLabel = state.settings.color === "couleur" ? "couleur" : "N&B";
    adminCurrentSession.textContent = `${totals.files} fichier(s), ${totals.totalImpressions} page(s) ${colorLabel}`;
    adminCurrentDetail.textContent = `${state.settings.printer} - ${state.settings.paperSize} - ${state.settings.sides}${state.settings.sides === "recto-verso" ? ` ${state.settings.duplexBinding}` : ""} - ${totals.rangeLabel}`;
    adminCloseSessionBtn.disabled = false;
  } else {
    adminCurrentSession.textContent = "Aucune session active";
    adminCurrentDetail.textContent = "La borne est disponible.";
    adminCloseSessionBtn.disabled = true;
  }

  if (!state.stats.history.length) {
    adminHistoryList.innerHTML = `
      <div class="empty-state admin-empty-state">
        <strong>Aucune impression enregistree.</strong>
        <p>Les prochaines impressions apparaitront ici.</p>
      </div>
    `;
    return;
  }

  adminHistoryList.innerHTML = state.stats.history
    .slice(0, 8)
    .map((item) => `
      <div class="admin-history-row">
        <div>
          <strong>${formatDateTime(item.date)} - ${item.color === "couleur" ? "Couleur" : "N&B"}</strong>
          <small>${item.files} fichier(s), ${item.pages} page(s), ${item.sheets} feuille(s) - ${item.printer} - ${item.pageRange || "Toutes les pages"}</small>
        </div>
        <span>${item.sourceLabel}</span>
      </div>
    `)
    .join("");
}

async function buildLocalRecord(file, origin = "usb") {
  if (!isAcceptedFile(file.name)) {
    throw new Error(`${file.name} n'est pas un format accepte.`);
  }

  const extension = getExtension(file.name);
  const pages = await estimatePages(file);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    pages: Math.max(1, pages),
    extension,
    origin,
    originLabel: origin === "usb" ? "Cle USB" : "Depot client",
    file,
  };
}

function buildRemoteRecord(file) {
  return {
    id: file.id,
    name: file.originalName,
    size: file.size,
    pages: 1,
    extension: file.extension,
    origin: "remote",
    originLabel: `Code ${state.pickupCode}`,
    downloadUrl: file.downloadUrl,
  };
}

async function handleLocalFiles(selectedFiles) {
  try {
    const records = await Promise.all([...selectedFiles].map((file) => buildLocalRecord(file, "usb")));
    state.pickupCode = null;
    state.files = records;
    renderFileList();
    renderOptions();
    renderAdminStats();
    updateStatus("Fichiers verifies", "success");
  } catch (error) {
    updateStatus("Format refuse");
    alert(error.message);
  }
}

async function loadPickupCode() {
  const code = pickupCodeInput.value.trim();
  if (!/^\d{4}$/.test(code)) {
    alert("Entrez le code a 4 chiffres.");
    return;
  }

  updateStatus("Recherche du code", "busy");
  loadCodeBtn.disabled = true;

  try {
    const response = await fetch(`/api/jobs/${code}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Code introuvable.");

    state.pickupCode = code;
    state.files = payload.files.map(buildRemoteRecord);
    renderFileList();
    renderOptions();
    renderAdminStats();
    updateStatus("Depot charge", "success");
  } catch (error) {
    alert(error.message);
    updateStatus("Code introuvable");
  } finally {
    loadCodeBtn.disabled = false;
  }
}

function openAdminModal() {
  if (!adminModal) return;
  clearIdleTimers();
  hideIdleWarning();
  adminModal.classList.remove("modal-hidden");
  adminPasswordInput.value = "";
  adminError.textContent = "";
  renderAdminState();
}

function closeAdminModal() {
  if (!adminModal) return;
  adminModal.classList.add("modal-hidden");
  resetIdleTimer();
}

function renderAdminState() {
  if (!adminLoginBlock) return;
  adminLoginBlock.classList.toggle("hidden", state.adminUnlocked);
  adminPanel.classList.toggle("hidden", !state.adminUnlocked);

  adminPrinter1.value = state.admin.printer1;
  adminPrinter2.value = state.admin.printer2;
  adminUploadUrl.value = state.admin.uploadUrl;
  adminCleanupDelay.value = String(state.admin.cleanupDelay);
  adminDeletePrint.checked = state.admin.deleteAfterPrint;
  adminRemoteCleanup.checked = state.admin.remoteCleanup;

  const printerLocked = Boolean(stationConfig.lockPrinter);
  adminPrinter1.disabled = printerLocked;
  adminPrinter2.disabled = printerLocked;
  renderAdminStats();
}

function resetSettings() {
  state.settings = {
    printer: state.admin.printer1,
    color: "noir-blanc",
    sides: "recto",
    duplexBinding: "bord-long",
    orientation: "auto",
    paperSize: "A4",
    pageRange: "",
    copies: 1,
  };
  copiesInput.value = "1";
  pageRangeInput.value = "";
  paperSizeSelect.value = "A4";

  document.querySelectorAll(".seg-btn").forEach((button) => {
    const shouldBeActive =
      (button.dataset.setting === "color" && button.dataset.value === "noir-blanc") ||
      (button.dataset.setting === "sides" && button.dataset.value === "recto") ||
      (button.dataset.setting === "duplexBinding" && button.dataset.value === "bord-long") ||
      (button.dataset.setting === "orientation" && button.dataset.value === "auto") ||
      (button.dataset.setting === "printer" && button.dataset.value === state.admin.printer1);
    button.classList.toggle("is-active", shouldBeActive);
  });
}

function resetSession() {
  clearPrintTimers();
  state.source = null;
  state.pickupCode = null;
  state.files = [];
  fileInput.value = "";
  pickupCodeInput.value = "";
  resetSettings();
  renderSourcePane();
  renderFileList();
  renderOptions();
  applyAdminSettings();
  updateStatus("Pret");
  showScreen("home");
  renderAdminStats();
  resetIdleTimer();
}

function clearPrintTimers() {
  state.printTimers.forEach((timer) => clearTimeout(timer));
  state.printTimers = [];
}

function openClientSession() {
  state.sessionActive = true;
  state.sessionSale = createEmptySessionSale();
  state.sessionSale.openedAt = new Date().toISOString();
  resetSession();
  updateStatus("Session ouverte", "success");
}

function closeCurrentSession(reason = "Session fermee", showClosedScreen = true) {
  clearPrintTimers();
  clearIdleTimers();
  hideIdleWarning();
  cleanupRemoteJob();
  state.sessionActive = false;
  state.sessionSale.closedAt = new Date().toISOString();
  state.source = null;
  state.pickupCode = null;
  state.files = [];
  fileInput.value = "";
  pickupCodeInput.value = "";
  progressBar.style.width = "0";
  printTitle.textContent = "Preparation du travail";
  printDetail.textContent = "Initialisation...";
  resetSettings();
  renderSourcePane();
  renderFileList();
  renderOptions();
  applyAdminSettings();
  updateStatus(reason, "success");
  showScreen(showClosedScreen ? "sessionClosed" : "sessionOpen");
  renderAdminStats();
}

async function cleanupRemoteJob() {
  if (!state.pickupCode || !state.admin.remoteCleanup) return;
  try {
    await fetch(`/api/jobs/${state.pickupCode}`, { method: "DELETE" });
  } catch (error) {
    console.warn("Nettoyage distant impossible", error);
  }
}

function registerCompletedPrint(totals) {
  const printedPages = totals.totalImpressions;
  const sourceLabel = state.pickupCode ? `Code ${state.pickupCode}` : "Cle USB";
  const entry = {
    date: new Date().toISOString(),
    color: state.settings.color,
    sides: state.settings.sides,
    duplexBinding: state.settings.duplexBinding,
    pageRange: totals.rangeLabel,
    pages: printedPages,
    sheets: totals.totalSheets,
    files: totals.files,
    printer: state.settings.printer,
    sourceLabel,
  };

  if (state.settings.color === "couleur") {
    state.stats.colorPages += printedPages;
    state.sessionSale.colorPages += printedPages;
  } else {
    state.stats.bwPages += printedPages;
    state.sessionSale.bwPages += printedPages;
  }

  state.stats.sessions += 1;
  state.stats.files += totals.files;
  state.stats.sheets += totals.totalSheets;
  state.stats.history = [entry, ...state.stats.history].slice(0, 30);

  state.sessionSale.files += totals.files;
  state.sessionSale.sheets += totals.totalSheets;
  state.sessionSale.jobs += 1;
  state.sessionSale.details = [entry, ...state.sessionSale.details].slice(0, 10);

  saveStats();
  renderAdminStats();
}

sourceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!state.sessionActive) return;
    state.source = button.dataset.source;
    renderSourcePane();
    updateStatus(state.source === "code" ? "Code de retrait" : "Cle USB", "busy");
    showScreen("source");
    if (state.source === "code") pickupCodeInput.focus();
    resetIdleTimer();
  });
});

startSessionBtn.addEventListener("click", openClientSession);
restartSessionBtn.addEventListener("click", openClientSession);

loadCodeBtn.addEventListener("click", loadPickupCode);
pickupCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadPickupCode();
});

fileInput.addEventListener("change", async (event) => {
  if (!event.target.files?.length) return;
  updateStatus("Analyse des fichiers", "busy");
  await handleLocalFiles(event.target.files);
});

fileList.addEventListener("input", (event) => {
  const id = event.target.dataset.pagesId;
  if (!id) return;
  const fileRecord = state.files.find((item) => item.id === id);
  if (!fileRecord) return;
  fileRecord.pages = Math.max(1, Number(event.target.value) || 1);
  renderOptions();
  renderAdminStats();
});

fileList.addEventListener("click", (event) => {
  const id = event.target.dataset.removeId;
  if (!id) return;
  state.files = state.files.filter((item) => item.id !== id);
  renderFileList();
  renderOptions();
  renderAdminStats();
});

clearFilesBtn.addEventListener("click", () => {
  state.files = [];
  state.pickupCode = null;
  fileInput.value = "";
  pickupCodeInput.value = "";
  renderFileList();
  renderOptions();
  updateStatus("Selection videe");
  renderAdminStats();
});

goToOptionsBtn.addEventListener("click", () => {
  if (!state.files.length) return;
  renderOptions();
  showScreen("options");
});

backToHomeBtn.addEventListener("click", resetSession);
backToSourceBtn.addEventListener("click", () => showScreen("source"));

document.querySelectorAll(".seg-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const { setting, value } = button.dataset;
    if (setting === "printer" && stationConfig.lockPrinter) return;
    state.settings[setting] = value;
    document.querySelectorAll(`.seg-btn[data-setting="${setting}"]`).forEach((other) => other.classList.remove("is-active"));
    button.classList.add("is-active");
    renderOptions();
    renderAdminStats();
  });
});

paperSizeSelect.addEventListener("change", () => {
  state.settings.paperSize = paperSizeSelect.value;
  renderOptions();
  renderAdminStats();
});

copiesInput.addEventListener("input", () => {
  state.settings.copies = Math.max(1, Number(copiesInput.value) || 1);
  renderOptions();
  renderAdminStats();
});

pageRangeInput.addEventListener("input", () => {
  state.settings.pageRange = pageRangeInput.value.trim();
  renderOptions();
  renderAdminStats();
});

startPrintBtn.addEventListener("click", () => {
  if (!state.files.length) return;

  const totals = computeTotals();
  if (!totals.rangeValid) {
    alert("La plage de pages est invalide. Exemple accepte : 1-3,5,8-10.");
    updateStatus("Plage invalide");
    return;
  }
  updateStatus("Envoi au copieur", "busy");
  progressBar.style.width = "0";
  showScreen("printing");

  printMetrics.innerHTML = `
    <div class="metric"><span>Copieur</span><strong>${state.settings.printer}</strong></div>
    <div class="metric"><span>Impressions</span><strong>${totals.totalImpressions}</strong></div>
    <div class="metric"><span>Feuilles</span><strong>${totals.totalSheets}</strong></div>
    <div class="metric"><span>Format</span><strong>${state.settings.paperSize}</strong></div>
    <div class="metric"><span>Plage</span><strong>${totals.rangeLabel}</strong></div>
  `;

  const hasConversion = state.files.some((file) => file.extension !== "pdf");
  const steps = [
    { progress: 12, title: "Verification des fichiers", detail: "Controle des formats acceptes." },
    { progress: 34, title: hasConversion ? "Conversion en PDF" : "PDF pret", detail: hasConversion ? "Preparation Word et images avant impression." : "Aucune conversion necessaire." },
    { progress: 56, title: "Application des reglages", detail: `${state.settings.color}, ${state.settings.sides}, ${state.settings.sides === "recto-verso" ? state.settings.duplexBinding : "sans reliure"}, ${state.settings.orientation}.` },
    { progress: 78, title: "Transmission au copieur", detail: `Envoi vers ${state.settings.printer}.` },
    { progress: 100, title: "Impression terminee", detail: "Nettoyage automatique des fichiers." },
  ];

  steps.forEach((step, index) => {
    const timer = setTimeout(async () => {
      progressBar.style.width = `${step.progress}%`;
      printTitle.textContent = step.title;
      printDetail.textContent = step.detail;

      if (index === steps.length - 1) {
        registerCompletedPrint(totals);
        if (state.admin.deleteAfterPrint) {
          await cleanupRemoteJob();
          state.files = [];
        }
        updateStatus("Fichiers supprimes", "success");
        const resetTimer = setTimeout(resetSession, Number(state.admin.cleanupDelay) * 1000);
        state.printTimers.push(resetTimer);
      }
    }, index * 1300);
    state.printTimers.push(timer);
  });
});

if (adminOpenBtn) adminOpenBtn.addEventListener("click", openAdminModal);
if (adminCloseBtn) adminCloseBtn.addEventListener("click", closeAdminModal);
if (adminModal) {
  adminModal.addEventListener("click", (event) => {
    if (event.target === adminModal) closeAdminModal();
  });
}

if (adminLoginBtn) adminLoginBtn.addEventListener("click", () => {
  if (adminPasswordInput.value === ADMIN_PASSWORD) {
    state.adminUnlocked = true;
    adminError.textContent = "";
    renderAdminState();
  } else {
    adminError.textContent = "Mot de passe incorrect.";
  }
});

if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", () => {
  state.adminUnlocked = false;
  renderAdminState();
});

if (adminCloseSessionBtn) adminCloseSessionBtn.addEventListener("click", () => {
  closeCurrentSession("Session fermee");
});

idleContinueBtn.addEventListener("click", resetIdleTimer);
idleCloseNowBtn.addEventListener("click", () => {
  closeCurrentSession("Session fermee");
});

if (adminResetStatsBtn) adminResetStatsBtn.addEventListener("click", () => {
  const shouldReset = confirm("Remettre les compteurs et l'historique a zero ?");
  if (!shouldReset) return;
  state.stats = createEmptyStats();
  saveStats();
  renderAdminStats();
  updateStatus("Compteurs remis a zero", "success");
});

if (adminSaveBtn) adminSaveBtn.addEventListener("click", () => {
  state.admin = {
    printer1: stationConfig.lockPrinter
      ? (stationConfig.defaultPrinter || adminPrinter1.value.trim() || "COPIEUR 1")
      : (adminPrinter1.value.trim() || "COPIEUR 1"),
    printer2: stationConfig.lockPrinter
      ? (stationConfig.secondaryPrinter || adminPrinter2.value.trim() || "COPIEUR 2")
      : (adminPrinter2.value.trim() || "COPIEUR 2"),
    uploadUrl: adminUploadUrl.value.trim() || "/upload.html",
    cleanupDelay: Number(adminCleanupDelay.value) || 3,
    deleteAfterPrint: adminDeletePrint.checked,
    remoteCleanup: adminRemoteCleanup.checked,
  };
  saveAdminSettings();
  applyAdminSettings();
  renderOptions();
  renderAdminStats();
  closeAdminModal();
  updateStatus("Reglages enregistres", "success");
});

["pointerdown", "keydown", "input", "change"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    if (!state.sessionActive) return;
    if (event.target.closest("#admin-modal")) return;
    if (event.target.closest("#idle-warning-modal")) return;
    resetIdleTimer();
  }, true);
});

function handleAdminCommand(rawCommand) {
  if (!rawCommand) return;
  try {
    const command = JSON.parse(rawCommand);
    if (!command.id || command.id === state.lastAdminCommandId) return;
    state.lastAdminCommandId = command.id;

    if (command.type === "close-session") {
      closeCurrentSession("Session fermee par admin");
    }
  } catch (error) {
    console.warn("Commande admin ignoree", error);
  }
}

window.addEventListener("storage", (event) => {
  if (event.key === stationCommandKey || event.key === COMMAND_KEY) {
    handleAdminCommand(event.newValue);
  }
  if (event.key === STORAGE_KEY) {
    state.admin = loadAdminSettings();
    applyAdminSettings();
    renderOptions();
    renderAdminStats();
  }
});

setInterval(() => {
  handleAdminCommand(localStorage.getItem(stationCommandKey));
  handleAdminCommand(localStorage.getItem(COMMAND_KEY));
}, 1000);

async function pollRemoteCommand() {
  if (!apiBaseUrl) return;
  try {
    const response = await fetch(`${apiBaseUrl}/api/stations/${stationStorageId}/command`);
    if (!response.ok) return;
    handleAdminCommand(JSON.stringify(await response.json()));
  } catch (error) {
    console.warn("Commande distante indisponible", error);
  }
}

setInterval(pollRemoteCommand, 1500);

applyAdminSettings();
renderFileList();
renderOptions();
renderAdminStats();
updateStatus("Pret");
showScreen("sessionOpen");
