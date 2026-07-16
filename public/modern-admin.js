const stationGrid = document.getElementById("station-grid");
const printerIpGrid = document.getElementById("printer-ip-grid");
const dashboardUpdated = document.getElementById("dashboard-updated");
const adminActionStatus = document.getElementById("admin-action-status");
const counterUploadUrl = document.getElementById("counter-upload-url");
const copyCounterUrl = document.getElementById("copy-counter-url");
const counterQr = document.getElementById("counter-qr");
const mailFilesList = document.getElementById("mail-files-list");
const qrFilesList = document.getElementById("qr-files-list");
const adminTabButtons = document.querySelectorAll("[data-admin-tab]");
const adminViews = document.querySelectorAll("[data-admin-view]");

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value || 0);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return Math.max(1, Math.round(value / 1024)) + " Ko";
  return (value / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo";
}

function sourceLabel(job) {
  if (job.source === "mail") return job.counterOnly ? "Mail - comptoir" : "Mail client";
  if (job.adminUpload || job.source === "comptoir") return "QR comptoir";
  if (job.source === "qr") return "QR client";
  if (job.source === "usb") return "Cle USB";
  return job.source || "Dossier";
}

function senderLabel(job) {
  return job.senderEmail || job.customerName || "Client";
}
function stationName(stationId) {
  return stationId === "poste-2" ? "Poste 2" : "Poste 1";
}

function normalizeStations(stations) {
  const list = Array.isArray(stations) ? stations : [];
  return ["poste-1", "poste-2"].map((stationId) => {
    const found = list.find((item) => item.station === stationId || item.stationId === stationId);
    return {
      station: stationId,
      stationLabel: found?.stationLabel || stationName(stationId),
      bwPages: found?.bwPages || 0,
      colorPages: found?.colorPages || 0,
      realBwPages: found?.realBwPages || 0,
      realColorPages: found?.realColorPages || 0,
      realTotalPages: found?.realTotalPages || 0,
    };
  });
}

function renderStations(stations) {
  if (!stationGrid) return;
  stationGrid.innerHTML = normalizeStations(stations).map((station) => {
    const hasRealSplit = (station.realBwPages || station.realColorPages) > 0;
    return `
    <article class="counter-station-card">
      <h3>${escapeHtml(station.stationLabel)}</h3>
      <div class="counter-values">
        <div>
          <span>Total reel copieur</span>
          <strong>${formatNumber(station.realTotalPages || 0)}</strong>
          <small>Lu directement sur le Canon</small>
        </div>
        <div>
          <span>N&amp;B / Couleur</span>
          <strong>${hasRealSplit ? `${formatNumber(station.realBwPages)} / ${formatNumber(station.realColorPages)}` : `${formatNumber(station.bwPages)} / ${formatNumber(station.colorPages)}`}</strong>
          <small>${hasRealSplit ? "Réel copieur" : "Estimation kiosk"}</small>
        </div>
      </div>
    </article>`;
  }).join("");
}

function renderPrinterIpCounters(printers = []) {
  if (!printerIpGrid) return;
  const list = Array.isArray(printers) && printers.length ? printers : [
    { label: "Copieur 1", ip: "10.0.0.221" },
    { label: "Copieur 2", ip: "10.0.0.222" },
  ];
  printerIpGrid.innerHTML = list.map((printer) => `
    <article class="printer-ip-card">
      <strong>${escapeHtml(printer.label || printer.name || "Copieur")}</strong>
      <span>IP : ${escapeHtml(printer.ip || "Non renseignee")}</span>
      <small>Compteur direct IP a connecter via SNMP/copieur.</small>
    </article>
  `).join("");
}

function fileDownloadUrl(job, file) {
  if (file && file.downloadUrl && file.downloadUrl !== "undefined") return file.downloadUrl;
  if (job?.code && file?.id) return `/api/jobs/${encodeURIComponent(job.code)}/files/${encodeURIComponent(file.id)}?download=1`;
  return "";
}

function jobDownloadAllUrl(job, files) {
  if (job && job.downloadAllUrl && job.downloadAllUrl !== "undefined") return job.downloadAllUrl;
  if (job?.code && files?.length) return `/api/jobs/${encodeURIComponent(job.code)}/download-all`;
  return "";
}

function renderAdminFiles(target, jobs, emptyText) {
  if (!target) return;
  const sortedJobs = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  target.innerHTML = sortedJobs.length ? sortedJobs.map((job) => {
    const files = job.files || [];
    const folderUrl = jobDownloadAllUrl(job, files);
    const sender = senderLabel(job);
    return `
      <article class="admin-file-card">
        <div class="admin-file-head">
          <div>
            <span>${sourceLabel(job)} - Code ${escapeHtml(job.code)}</span>
            <strong>${escapeHtml(sender)}</strong>
          </div>
          <div class="admin-file-actions">
            ${folderUrl ? `<a href="${folderUrl}">Telecharger le dossier</a>` : ""}
          </div>
        </div>
        <div class="admin-file-meta">
          <span>${new Date(job.createdAt).toLocaleString("fr-FR")}</span>
          <span>${files.length} fichier${files.length > 1 ? "s" : ""}</span>
          ${job.counterOnly ? "<span>Word/DOC - comptoir</span>" : "<span>Imprimable poste</span>"}
        </div>
        <div class="admin-file-items">
          ${files.map((file) => `
            <div class="admin-file-row">
              <div>
                <strong>${escapeHtml(file.originalName)}</strong>
                <span>${String(file.extension || "").toUpperCase()} - ${formatSize(file.size)} - ${file.pages || 1} page(s)</span>
              </div>
              ${fileDownloadUrl(job, file) ? `<a href="${fileDownloadUrl(job, file)}">Telecharger</a>` : `<span class="admin-file-unavailable">Lien indisponible</span>`}
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("") : `<p class="admin-empty-files">${emptyText}</p>`;
}

function renderSourceFileLists(jobs) {
  const allJobs = Array.isArray(jobs) ? jobs : [];
  const mailJobs = allJobs.filter((job) => job.source === "mail");
  const qrJobs = allJobs.filter((job) => job.source === "qr" || job.source === "comptoir" || (job.adminUpload && job.source !== "mail"));
  renderAdminFiles(mailFilesList, mailJobs, "Aucun fichier mail recu pour le moment.");
  renderAdminFiles(qrFilesList, qrJobs, "Aucun fichier QR code recu pour le moment.");
}

async function refreshFiles() {
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) return;
    renderSourceFileLists(payload.jobs || []);
  } catch (error) {}
}

async function refreshDashboard() {
  try {
    if (dashboardUpdated) {
      dashboardUpdated.textContent = `Fichiers recus - ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    }
    refreshFiles();
  } catch (error) {}
}

async function loadAdminConfig() {
  try {
    const response = await fetch("/api/config");
    const payload = await response.json();
    if (!response.ok) return;
    if (counterUploadUrl && payload.counterUploadUrl) counterUploadUrl.value = payload.counterUploadUrl;
    if (counterQr && payload.counterQrUrl) counterQr.src = `${payload.counterQrUrl}&t=${Date.now()}`;
  } catch (error) {}
}

async function shutdownStation(station) {
  const label = stationName(station);
  const confirmed = window.confirm(`Confirmer l'extinction du ${label} ?`);
  if (!confirmed) return;
  if (adminActionStatus) adminActionStatus.textContent = `Commande d'extinction envoyee au ${label}...`;
  try {
    const response = await fetch(`/api/stations/${station}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "shutdown-station" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Commande impossible.");
    if (adminActionStatus) adminActionStatus.textContent = `Extinction demandee pour ${label}.`;
  } catch (error) {
    if (adminActionStatus) adminActionStatus.textContent = error.message || "Commande impossible.";
  }
}

document.getElementById("refresh-admin")?.addEventListener("click", refreshDashboard);

adminTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.adminTab;
    adminTabButtons.forEach((item) => item.classList.toggle("active", item === button));
    adminViews.forEach((view) => view.classList.toggle("active", view.dataset.adminView === tab));
    refreshFiles();
  });
});

document.querySelectorAll("[data-shutdown-station]").forEach((button) => {
  button.addEventListener("click", () => shutdownStation(button.dataset.shutdownStation));
});

copyCounterUrl?.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(counterUploadUrl.value);
  if (adminActionStatus) adminActionStatus.textContent = "Lien comptoir copie.";
});

refreshDashboard();
window.setInterval(refreshDashboard, 5000);
loadAdminConfig();






