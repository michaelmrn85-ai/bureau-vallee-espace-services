const ADMIN_PASSWORD = "BV558";
const STORAGE_KEY = "bv-espace-services-admin";
const STATS_KEY = "bv-espace-services-stats";
const SESSION_KEY = "bv-espace-services-current-session";
const COMMAND_KEY = "bv-espace-services-admin-command";
const stationConfig = window.BV_APP_CONFIG || {};
const apiBaseUrl = stationConfig.apiBaseUrl || "";
const STATIONS = [
  { id: "poste-copieur-1", name: "POSTE COPIEUR 1", printer: "COPIEUR 1" },
  { id: "poste-copieur-2", name: "POSTE COPIEUR 2", printer: "COPIEUR 2" },
];

const defaultAdminSettings = {
  printer1: stationConfig.printer1 || "COPIEUR 1",
  printer2: stationConfig.printer2 || "COPIEUR 2",
  printer1Ip: "",
  printer2Ip: "",
  uploadUrl: stationConfig.uploadUrl || "/upload",
  cleanupDelay: 3,
  deleteAfterPrint: true,
  remoteCleanup: true,
};

const loginBlock = document.getElementById("admin-login-page");
const panel = document.getElementById("admin-page-panel");
const passwordInput = document.getElementById("admin-page-password");
const loginBtn = document.getElementById("admin-page-login");
const errorText = document.getElementById("admin-page-error");
const statusPill = document.getElementById("admin-page-status");

const printer1Input = document.getElementById("admin-page-printer-1");
const printer2Input = document.getElementById("admin-page-printer-2");
const printer1IpInput = document.getElementById("admin-page-printer-1-ip");
const printer2IpInput = document.getElementById("admin-page-printer-2-ip");
const uploadUrlInput = document.getElementById("admin-page-upload-url");
const cleanupDelaySelect = document.getElementById("admin-page-cleanup-delay");
const deletePrintInput = document.getElementById("admin-page-delete-print");
const remoteCleanupInput = document.getElementById("admin-page-remote-cleanup");

const bwPages = document.getElementById("admin-page-bw-pages");
const colorPages = document.getElementById("admin-page-color-pages");
const sessionCount = document.getElementById("admin-page-session-count");
const fileCount = document.getElementById("admin-page-file-count");
const currentSession = document.getElementById("admin-page-current-session");
const currentDetail = document.getElementById("admin-page-current-detail");
const stationsContainer = document.getElementById("admin-page-stations");
const sessionBw = document.getElementById("admin-page-session-bw");
const sessionColor = document.getElementById("admin-page-session-color");
const sessionSheets = document.getElementById("admin-page-session-sheets");
const sessionJobs = document.getElementById("admin-page-session-jobs");
const sessionDetailList = document.getElementById("admin-page-session-detail-list");
const closeSessionBtn = document.getElementById("admin-page-close-session");
const resetStatsBtn = document.getElementById("admin-page-reset-stats");
const saveBtn = document.getElementById("admin-page-save");
const logoutBtn = document.getElementById("admin-page-logout");
const historyList = document.getElementById("admin-page-history-list");
let selectedStationId = STATIONS[0].id;

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

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultAdminSettings, ...JSON.parse(raw) } : { ...defaultAdminSettings };
  } catch (error) {
    return { ...defaultAdminSettings };
  }
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...createEmptyStats(), ...JSON.parse(raw) } : createEmptyStats();
  } catch (error) {
    return createEmptyStats();
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : { active: false };
  } catch (error) {
    return { active: false };
  }
}

function loadStationSession(stationId) {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY}:${stationId}`);
    return raw ? JSON.parse(raw) : { active: false };
  } catch (error) {
    return { active: false };
  }
}

async function fetchRemoteStations() {
  if (!apiBaseUrl) return null;
  try {
    const response = await fetch(`${apiBaseUrl}/api/stations`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.stations || [];
  } catch (error) {
    return null;
  }
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function setStatus(text, tone = "neutral") {
  statusPill.textContent = text;
  statusPill.dataset.tone = tone;
}

function renderSettings() {
  const settings = loadSettings();
  printer1Input.value = settings.printer1;
  printer2Input.value = settings.printer2;
  printer1IpInput.value = settings.printer1Ip || "";
  printer2IpInput.value = settings.printer2Ip || "";
  uploadUrlInput.value = settings.uploadUrl;
  cleanupDelaySelect.value = String(settings.cleanupDelay);
  deletePrintInput.checked = settings.deleteAfterPrint;
  remoteCleanupInput.checked = settings.remoteCleanup;
}

async function renderDashboard() {
  const stats = loadStats();
  const remoteStations = await fetchRemoteStations();
  const stationSessions = STATIONS.map((station) => ({
    ...station,
    session: remoteStations?.find((item) => item.stationId === station.id) || loadStationSession(station.id),
  }));
  const activeStation = stationSessions.find((station) => station.session.active) || stationSessions[0];
  selectedStationId = activeStation?.id || STATIONS[0].id;
  const session = activeStation?.session || loadSession();

  bwPages.textContent = String(stats.bwPages);
  colorPages.textContent = String(stats.colorPages);
  sessionCount.textContent = String(stats.sessions);
  fileCount.textContent = String(stats.files);

  if (session.active) {
    currentSession.textContent = `${session.pages || 0} page(s) a encaisser`;
    currentDetail.textContent = `En cours : ${session.currentFiles || 0} fichier(s), ${session.currentPages || 0} page(s) preparee(s) - ${session.printer || "-"}`;
    closeSessionBtn.disabled = false;
  } else {
    currentSession.textContent = session.pages ? `${session.pages} page(s) derniere session` : "Session vide";
    currentDetail.textContent = session.pages ? "Ce detail reste visible jusqu'a la prochaine ouverture de session." : "La borne est disponible.";
    closeSessionBtn.disabled = true;
  }

  stationsContainer.innerHTML = stationSessions
    .map((station) => {
      const item = station.session;
      const pages = item.pages || 0;
      const status = item.active ? "Session active" : pages ? "Derniere session" : "Disponible";
      const detail = item.active
        ? `${item.currentFiles || 0} fichier(s) en cours - ${item.currentPages || 0} page(s) preparee(s)`
        : pages
          ? `${pages} page(s) a encaisser jusqu'a prochaine session`
          : `Pret pour ${station.printer}`;
      return `
        <div class="station-card">
          <div>
            <p class="eyebrow">${station.printer}</p>
            <h3>${station.name}</h3>
            <strong>${status}</strong>
            <p>${detail}</p>
          </div>
          <div class="station-metrics">
            <span>N&B <strong>${item.bwPages || 0}</strong></span>
            <span>Couleur <strong>${item.colorPages || 0}</strong></span>
            <span>Feuilles <strong>${item.sheets || 0}</strong></span>
          </div>
          <button class="danger-btn danger-btn-strong" data-close-station="${station.id}" ${item.active ? "" : "disabled"}>Fermer ce poste</button>
        </div>
      `;
    })
    .join("");

  sessionBw.textContent = String(session.bwPages || 0);
  sessionColor.textContent = String(session.colorPages || 0);
  sessionSheets.textContent = String(session.sheets || 0);
  sessionJobs.textContent = String(session.jobs || 0);

  if (!session.details?.length) {
    sessionDetailList.innerHTML = `
      <div class="empty-state admin-empty-state">
        <strong>Aucun travail dans cette session.</strong>
        <p>Le detail caisse se remplira apres impression.</p>
      </div>
    `;
  } else {
    sessionDetailList.innerHTML = session.details
      .map((item) => `
        <div class="admin-history-row">
          <div>
            <strong>${item.color === "couleur" ? "Couleur" : "N&B"} - ${item.pages} page(s)</strong>
            <small>${item.files} fichier(s), ${item.sheets} feuille(s) - ${item.printer} - ${item.pageRange || "Toutes les pages"}</small>
          </div>
          <span>${item.sourceLabel}</span>
        </div>
      `)
      .join("");
  }

  if (!stats.history.length) {
    historyList.innerHTML = `
      <div class="empty-state admin-empty-state">
        <strong>Aucune impression enregistree.</strong>
        <p>Les prochaines impressions apparaitront ici.</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = stats.history
    .slice(0, 12)
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

function unlockAdmin() {
  loginBlock.classList.add("hidden");
  panel.classList.remove("hidden");
  setStatus("Connecte", "success");
  renderSettings();
  renderDashboard();
}

loginBtn.addEventListener("click", () => {
  if (passwordInput.value !== ADMIN_PASSWORD) {
    errorText.textContent = "Mot de passe incorrect.";
    setStatus("Refuse");
    return;
  }
  errorText.textContent = "";
  unlockAdmin();
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginBtn.click();
});

saveBtn.addEventListener("click", () => {
  const settings = {
    printer1: printer1Input.value.trim() || "COPIEUR 1",
    printer2: printer2Input.value.trim() || "COPIEUR 2",
    printer1Ip: printer1IpInput.value.trim(),
    printer2Ip: printer2IpInput.value.trim(),
    uploadUrl: uploadUrlInput.value.trim() || "/upload",
    cleanupDelay: Number(cleanupDelaySelect.value) || 3,
    deleteAfterPrint: deletePrintInput.checked,
    remoteCleanup: remoteCleanupInput.checked,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  setStatus("Reglages enregistres", "success");
});

function sendCloseCommand(stationId = null) {
  if (apiBaseUrl && stationId) {
    fetch(`${apiBaseUrl}/api/stations/${stationId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "close-session" }),
    }).catch(() => {});
  }
  const key = stationId ? `${COMMAND_KEY}:${stationId}` : COMMAND_KEY;
  localStorage.setItem(key, JSON.stringify({
    id: crypto.randomUUID(),
    type: "close-session",
    stationId,
    createdAt: new Date().toISOString(),
  }));
  setStatus("Commande envoyee", "busy");
  setTimeout(renderDashboard, 500);
}

closeSessionBtn.addEventListener("click", () => {
  sendCloseCommand(selectedStationId);
});

stationsContainer.addEventListener("click", (event) => {
  const stationId = event.target.dataset.closeStation;
  if (!stationId) return;
  sendCloseCommand(stationId);
});

resetStatsBtn.addEventListener("click", () => {
  const shouldReset = confirm("Remettre les compteurs et l'historique a zero ?");
  if (!shouldReset) return;
  localStorage.setItem(STATS_KEY, JSON.stringify(createEmptyStats()));
  renderDashboard();
  setStatus("Compteurs remis a zero", "success");
});

logoutBtn.addEventListener("click", () => {
  panel.classList.add("hidden");
  loginBlock.classList.remove("hidden");
  passwordInput.value = "";
  setStatus("Verrouille");
});

window.addEventListener("storage", (event) => {
  if ([STATS_KEY, SESSION_KEY].includes(event.key)) {
    renderDashboard();
  }
});

setInterval(() => {
  if (!panel.classList.contains("hidden")) renderDashboard();
}, 1000);
