const adminSummary = document.getElementById("admin-summary");
const stationDashboard = document.getElementById("station-dashboard");
const stationReportTable = document.getElementById("station-report-table");
const adminUploadList = document.getElementById("admin-upload-list");
const adminUploadModal = document.getElementById("admin-upload-modal");
const openAdminUploadBtn = document.getElementById("open-admin-upload");
const closeAdminUploadBtn = document.getElementById("close-admin-upload");
const codesMessage = document.getElementById("codes-message");
const refreshBtn = document.getElementById("refresh-codes");

let latestJobs = [];
let latestStations = {
  "poste-1": { label: "Poste 1", active: false },
  "poste-2": { label: "Poste 2", active: false },
};

function setCodesMessage(text, tone = "") {
  codesMessage.textContent = text;
  codesMessage.dataset.tone = tone;
}

function doneRequests(job) {
  return (job.printRequests || []).filter((request) => request.status === "done");
}

function donePrintCount(job) {
  return doneRequests(job).length;
}

function printableJobs() {
  return latestJobs.filter((job) => !job.adminUpload);
}

function summarizeStation(stationId) {
  return printableJobs()
    .filter((job) => (job.station || "poste-1") === stationId)
    .reduce((summary, job) => {
      summary.bwPages += Number(job.bwPages || 0);
      summary.colorPages += Number(job.colorPages || 0);
      summary.totalPages += Number(job.totalPages || 0);
      summary.activeJobs += job.status === "actif" ? 1 : 0;
      summary.donePrints += donePrintCount(job);
      return summary;
    }, { bwPages: 0, colorPages: 0, totalPages: 0, activeJobs: 0, donePrints: 0 });
}

function allTotals() {
  return Object.keys(latestStations).reduce((totals, stationId) => {
    const summary = summarizeStation(stationId);
    totals.bwPages += summary.bwPages;
    totals.colorPages += summary.colorPages;
    totals.totalPages += summary.totalPages;
    totals.activeJobs += summary.activeJobs;
    totals.donePrints += summary.donePrints;
    return totals;
  }, { bwPages: 0, colorPages: 0, totalPages: 0, activeJobs: 0, donePrints: 0 });
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function formatPercent(part, total) {
  if (!total) return "0 %";
  return `${Math.round((part / total) * 100)} %`;
}

function formatAdminDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function clientRows() {
  const rows = new Map();

  for (const job of printableJobs()) {
    const client = job.customerName || "Client sans nom";
    const station = job.station || "poste-1";
    if (!rows.has(client)) {
      rows.set(client, {
        client,
        bw: { "poste-1": 0, "poste-2": 0 },
        color: { "poste-1": 0, "poste-2": 0 },
        total: { "poste-1": 0, "poste-2": 0 },
      });
    }
    const row = rows.get(client);
    row.bw[station] += Number(job.bwPages || 0);
    row.color[station] += Number(job.colorPages || 0);
    row.total[station] += Number(job.totalPages || 0);
  }

  return [...rows.values()].sort((a, b) => {
    const totalA = a.total["poste-1"] + a.total["poste-2"];
    const totalB = b.total["poste-1"] + b.total["poste-2"];
    return totalB - totalA || a.client.localeCompare(b.client);
  });
}

function renderSummary() {
  const totals = allTotals();
  const clientCount = new Set(printableJobs().map((job) => job.customerName || "Client sans nom")).size;
  const openStations = Object.values(latestStations).filter((station) => station.active).length;
  const cards = [
    { label: "Postes d'impression", value: openStations, detail: `${Object.keys(latestStations).length} configures`, tone: "blue" },
    { label: "Clients", value: clientCount, detail: "Enregistres", tone: "violet" },
    { label: "Total impressions", value: totals.totalPages, detail: "Total copies", tone: "green" },
    { label: "N&B", value: totals.bwPages, detail: formatPercent(totals.bwPages, totals.totalPages), tone: "gray" },
    { label: "Couleur", value: totals.colorPages, detail: formatPercent(totals.colorPages, totals.totalPages), tone: "orange" },
  ];

  adminSummary.innerHTML = cards.map((card) => `
    <article class="admin-stat-card is-${card.tone}">
      <span class="admin-stat-icon" aria-hidden="true"></span>
      <div>
        <small>${card.label}</small>
        <strong>${formatNumber(card.value)}</strong>
        <em>${card.detail}</em>
      </div>
    </article>
  `).join("");
}

function renderReportTable() {
  const rows = clientRows();
  const totals = rows.reduce((sum, row) => {
    for (const station of ["poste-1", "poste-2"]) {
      sum.bw[station] += row.bw[station];
      sum.color[station] += row.color[station];
      sum.total[station] += row.total[station];
    }
    return sum;
  }, {
    bw: { "poste-1": 0, "poste-2": 0 },
    color: { "poste-1": 0, "poste-2": 0 },
    total: { "poste-1": 0, "poste-2": 0 },
  });

  const totalCell = (group, station) => formatNumber(group[station]);
  const groupTotal = (group) => formatNumber(group["poste-1"] + group["poste-2"]);

  stationReportTable.innerHTML = `
    <table class="admin-report-table">
      <thead>
        <tr>
          <th rowspan="2">Client</th>
          <th colspan="3">N&B copies</th>
          <th colspan="3">Couleur copies</th>
          <th colspan="3">Total copies</th>
        </tr>
        <tr>
          <th>Poste 1</th>
          <th>Poste 2</th>
          <th>Total</th>
          <th>Poste 1</th>
          <th>Poste 2</th>
          <th>Total</th>
          <th>Poste 1</th>
          <th>Poste 2</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.map((row) => `
          <tr>
            <td>${row.client}</td>
            <td>${totalCell(row.bw, "poste-1")}</td>
            <td>${totalCell(row.bw, "poste-2")}</td>
            <td><strong>${groupTotal(row.bw)}</strong></td>
            <td>${totalCell(row.color, "poste-1")}</td>
            <td>${totalCell(row.color, "poste-2")}</td>
            <td><strong>${groupTotal(row.color)}</strong></td>
            <td>${totalCell(row.total, "poste-1")}</td>
            <td>${totalCell(row.total, "poste-2")}</td>
            <td><strong>${groupTotal(row.total)}</strong></td>
          </tr>
        `).join("") : `
          <tr>
            <td colspan="10" class="admin-empty-cell">Aucune impression client pour le moment.</td>
          </tr>
        `}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td>${totalCell(totals.bw, "poste-1")}</td>
          <td>${totalCell(totals.bw, "poste-2")}</td>
          <td>${groupTotal(totals.bw)}</td>
          <td>${totalCell(totals.color, "poste-1")}</td>
          <td>${totalCell(totals.color, "poste-2")}</td>
          <td>${groupTotal(totals.color)}</td>
          <td>${totalCell(totals.total, "poste-1")}</td>
          <td>${totalCell(totals.total, "poste-2")}</td>
          <td>${groupTotal(totals.total)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function renderStationControls() {
  stationDashboard.innerHTML = `
    <div class="admin-section-heading">
      <h2>Postes d'impression</h2>
      <p>Ouverture et arret des postes client.</p>
    </div>
    <div class="admin-station-grid">
      ${Object.entries(latestStations).map(([stationId, station]) => {
        const summary = summarizeStation(stationId);
        const active = Boolean(station.active);
        return `
          <article class="admin-station-card ${active ? "is-online" : "is-offline"}">
            <div>
              <span>${station.label}</span>
              <strong>${active ? "Ouvert" : "Arret"}</strong>
              <small>${summary.activeJobs} session(s) active(s) - ${summary.donePrints} impression(s)</small>
            </div>
            <div class="admin-station-actions">
              <button type="button" data-session-action="open" data-station="${stationId}">Ouvrir</button>
              <button type="button" data-session-action="close" data-station="${stationId}">Stopper</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderDashboard() {
  renderSummary();
  renderReportTable();
  renderStationControls();
}

function renderAdminUploads() {
  const uploads = latestJobs
    .filter((job) => job.adminUpload)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  adminUploadList.innerHTML = `
    <div class="admin-section-heading">
      <h2>Fichiers recus par QR code comptoir</h2>
      <p>${uploads.length} depot(s) comptoir.</p>
    </div>
    <div class="admin-upload-compact-list">
      ${uploads.length ? uploads.map((job) => `
        <article class="admin-upload-item">
          <div class="admin-upload-summary">
            <span>Code ${job.code} - ${formatAdminDate(job.createdAt)}</span>
            <strong>${job.customerName || "Client comptoir"}</strong>
            <small>${job.files.length} fichier(s) - ${job.depositPages || 0} page(s) detectee(s)</small>
          </div>
          <div class="admin-upload-actions">
            ${job.downloadAllUrl ? `<a class="button-link" href="${job.downloadAllUrl}">Telecharger tout</a>` : ""}
            ${job.files.map((file) => `<a class="text-link" href="${file.downloadUrl}">${file.originalName}</a>`).join("")}
          </div>
        </article>
      `).join("") : `<p class="empty-state">Aucun fichier comptoir recu pour le moment.</p>`}
    </div>
  `;
}

async function loadCodes() {
  setCodesMessage("Mise a jour...");
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    latestJobs = payload.jobs || [];
    renderDashboard();
    renderAdminUploads();
    setCodesMessage("Tableau de bord a jour.", "success");
  } catch (error) {
    setCodesMessage(error.message, "error");
  }
}

async function loadSession() {
  try {
    const response = await fetch("/api/session");
    const session = await response.json();
    if (!response.ok) throw new Error(session.error || "Etat des postes indisponible.");
    latestStations = Object.fromEntries(Object.entries(session.stations || latestStations).map(([id, state]) => [
      id,
      { label: state.label || latestStations[id]?.label || id, active: Boolean(state.active) },
    ]));
    renderDashboard();
  } catch (error) {
    setCodesMessage(error.message, "error");
  }
}

async function saveSession(station, active) {
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station, active, message: "" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
    latestStations = Object.fromEntries(Object.entries(payload.stations || latestStations).map(([id, state]) => [
      id,
      { label: state.label || latestStations[id]?.label || id, active: Boolean(state.active) },
    ]));
    renderDashboard();
    setCodesMessage(`${payload.stationLabel} ${payload.active ? "ouvert" : "stoppe"}.`, payload.active ? "success" : "");
  } catch (error) {
    setCodesMessage(error.message, "error");
  }
}

function refreshDashboard() {
  loadCodes();
  loadSession();
}

refreshBtn.addEventListener("click", refreshDashboard);

openAdminUploadBtn.addEventListener("click", () => {
  adminUploadModal.classList.remove("hidden");
});

closeAdminUploadBtn.addEventListener("click", () => {
  adminUploadModal.classList.add("hidden");
});

adminUploadModal.addEventListener("click", (event) => {
  if (event.target === adminUploadModal) adminUploadModal.classList.add("hidden");
});

stationDashboard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-session-action][data-station]");
  if (!button) return;
  saveSession(button.dataset.station, button.dataset.sessionAction === "open");
});

refreshDashboard();
window.setInterval(loadSession, 4000);
window.setInterval(loadCodes, 4000);
