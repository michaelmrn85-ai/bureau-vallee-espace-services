const metricBw = document.getElementById("metric-bw");
const metricColor = document.getElementById("metric-color");
const metricTotal = document.getElementById("metric-total");
const metricPending = document.getElementById("metric-pending");
const metricFailed = document.getElementById("metric-failed");
const metricBwRate = document.getElementById("metric-bw-rate");
const metricColorRate = document.getElementById("metric-color-rate");
const metricJobs = document.getElementById("metric-jobs");
const clientTable = document.getElementById("client-table");
const stationGrid = document.getElementById("station-grid");
const dashboardUpdated = document.getElementById("dashboard-updated");
const adminActionStatus = document.getElementById("admin-action-status");
const counterUploadUrl = document.getElementById("counter-upload-url");
const copyCounterUrl = document.getElementById("copy-counter-url");
const counterQr = document.getElementById("counter-qr");
const counterReceptionsList = document.getElementById("counter-receptions-list");

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value || 0);
}

function statusText(row) {
  if (row.failedRequests) return "Erreur";
  if (row.printingRequests) return "En cours";
  if (row.pendingRequests) return "En attente";
  return "Confirmé";
}

function statusClass(row) {
  if (row.failedRequests) return "is-error";
  if (row.printingRequests) return "is-printing";
  if (row.pendingRequests) return "is-pending";
  return "is-done";
}

function renderCounters(data) {
  const totals = data.totals || {};
  const bw = totals.bwPages || 0;
  const color = totals.colorPages || 0;
  const total = totals.totalPages || 0;
  const inProgress = (totals.pending || 0) + (totals.printing || 0);
  metricBw.textContent = formatNumber(bw);
  metricColor.textContent = formatNumber(color);
  metricTotal.textContent = formatNumber(total);
  metricPending.textContent = formatNumber(inProgress);
  metricFailed.textContent = `${formatNumber(totals.failed || 0)} erreur${(totals.failed || 0) > 1 ? "s" : ""}`;
  metricJobs.textContent = `${formatNumber(totals.jobs || 0)} dossier${(totals.jobs || 0) > 1 ? "s" : ""} confirmé${(totals.jobs || 0) > 1 ? "s" : ""}`;
  metricBwRate.textContent = total ? `${Math.round((bw / total) * 100)}% du total imprimé` : "0% du total imprimé";
  metricColorRate.textContent = total ? `${Math.round((color / total) * 100)}% du total imprimé` : "0% du total imprimé";
  dashboardUpdated.textContent = `Dernière mise à jour : ${new Date(data.generatedAt || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function renderStations(stations) {
  stationGrid.innerHTML = (stations || []).map((station) => {
    const pending = (station.pending || 0) + (station.printing || 0);
    return `
      <article class="simple-station-card real-station-card">
        <div>
          <h3>${station.stationLabel}</h3>
          <p>${formatNumber(station.jobs)} dossier${station.jobs > 1 ? "s" : ""} confirmé${station.jobs > 1 ? "s" : ""}</p>
        </div>
        <div><span>N&B</span><strong>${formatNumber(station.bwPages)}</strong></div>
        <div><span>Couleur</span><strong>${formatNumber(station.colorPages)}</strong></div>
        <div><span>En cours</span><strong>${formatNumber(pending)}</strong></div>
      </article>
    `;
  }).join("");
}

function renderTable(rows) {
  clientTable.innerHTML = rows?.length ? rows.map((row) => `
    <tr>
      <td><strong>${row.code}</strong></td>
      <td>${row.customerName || "Client"}</td>
      <td>${row.stationLabel}</td>
      <td>${formatNumber(row.bwPages)}</td>
      <td>${formatNumber(row.colorPages)}</td>
      <td><strong>${formatNumber(row.totalPages)}</strong></td>
      <td><span class="print-state ${statusClass(row)}">${statusText(row)}</span></td>
    </tr>
  `).join("") : `<tr><td colspan="7">Aucune impression confirmée pour le moment.</td></tr>`;
}

function renderCounterReceptions(jobs) {
  const counterJobs = (jobs || []).filter((job) => job.adminUpload).slice(0, 12);
  counterReceptionsList.innerHTML = counterJobs.length ? counterJobs.map((job) => `
    <article class="counter-reception-item">
      <div>
        <strong>${job.customerName || "Client comptoir"}</strong>
        <span>${new Date(job.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <p>${(job.files || []).map((file) => file.originalName).join(", ")}</p>
    </article>
  `).join("") : `<p class="empty-counter-receptions">Aucun fichier comptoir recu pour le moment.</p>`;
}

async function refreshCounterReceptions() {
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) return;
    renderCounterReceptions(payload.jobs || []);
  } catch (error) {}
}

async function refreshDashboard() {
  const response = await fetch("/api/dashboard");
  const payload = await response.json();
  if (!response.ok) return;
  renderCounters(payload);
  renderStations(payload.stations || []);
  renderTable(payload.rows || []);
  refreshCounterReceptions();
}

document.getElementById("refresh-admin").addEventListener("click", refreshDashboard);
refreshDashboard();
window.setInterval(refreshDashboard, 5000);


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
  const label = station === "poste-2" ? "Poste 2" : "Poste 1";
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
    if (adminActionStatus) adminActionStatus.textContent = `Extinction demandee pour ${label}. L'agent du poste va l'executer.`;
  } catch (error) {
    if (adminActionStatus) adminActionStatus.textContent = error.message || "Commande impossible.";
  }
}

document.querySelectorAll("[data-shutdown-station]").forEach((button) => {
  button.addEventListener("click", () => shutdownStation(button.dataset.shutdownStation));
});

copyCounterUrl?.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(counterUploadUrl.value);
  if (adminActionStatus) adminActionStatus.textContent = "Lien comptoir copie.";
});

loadAdminConfig();
