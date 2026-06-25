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
  if (job.source === "mail") return job.counterOnly ? "Mail comptoir" : "Mail";
  if (job.adminUpload || job.source === "comptoir") return "QR comptoir";
  if (job.source === "qr") return "QR client";
  if (job.source === "usb") return "Cle USB";
  return job.source || "Dossier";
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
    };
  });
}

function renderStations(stations) {
  if (!stationGrid) return;
  stationGrid.innerHTML = normalizeStations(stations).map((station) => `
    <article class="counter-station-card">
      <h3>${escapeHtml(station.stationLabel)}</h3>
      <div class="counter-values">
        <div>
          <span>N&amp;B</span>
          <strong>${formatNumber(station.bwPages)}</strong>
        </div>
        <div>
          <span>Couleur</span>
          <strong>${formatNumber(station.colorPages)}</strong>
        </div>
      </div>
    </article>
  `).join("");
}

function renderPrinterIpCounters() {
  if (!printerIpGrid) return;
  printerIpGrid.innerHTML = `
    <article class="printer-ip-card">
      <strong>A configurer</strong>
      <span>Lecture directe des compteurs copieurs des que les IP et le protocole compteur sont renseignes.</span>
    </article>
  `;
}

function renderAdminFiles(target, jobs, emptyText) {
  if (!target) return;
  target.innerHTML = jobs.length ? jobs.map((job) => {
    const files = job.files || [];
    return `
      <article class="admin-file-card">
        <div class="admin-file-head">
          <div>
            <span>${sourceLabel(job)} - Code ${escapeHtml(job.code)}</span>
            <strong>${escapeHtml(job.customerName || "Client")}</strong>
          </div>
          <div class="admin-file-actions">
            ${job.downloadAllUrl ? `<a href="${job.downloadAllUrl}">Telecharger le dossier</a>` : ""}
          </div>
        </div>
        <div class="admin-file-meta">
          <span>${new Date(job.createdAt).toLocaleString("fr-FR")}</span>
          <span>${files.length} fichier${files.length > 1 ? "s" : ""}</span>
          ${job.counterOnly ? "<span>Traitement comptoir</span>" : ""}
        </div>
        <div class="admin-file-items">
          ${files.map((file) => `
            <div class="admin-file-row">
              <div>
                <strong>${escapeHtml(file.originalName)}</strong>
                <span>${String(file.extension || "").toUpperCase()} - ${formatSize(file.size)} - ${file.pages || 1} page(s)</span>
              </div>
              <a href="${file.downloadUrl}">Telecharger</a>
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
    const response = await fetch("/api/dashboard");
    const payload = await response.json();
    if (!response.ok) return;
    renderStations(payload.stations || []);
    renderPrinterIpCounters();
    if (dashboardUpdated) {
      dashboardUpdated.textContent = `Derniere mise a jour : ${new Date(payload.generatedAt || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
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
