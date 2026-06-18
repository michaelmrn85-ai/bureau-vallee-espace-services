const metricBw = document.getElementById("metric-bw");
const metricColor = document.getElementById("metric-color");
const metricTotal = document.getElementById("metric-total");
const metricBwRate = document.getElementById("metric-bw-rate");
const metricColorRate = document.getElementById("metric-color-rate");
const metricJobs = document.getElementById("metric-jobs");
const clientTable = document.getElementById("client-table");
const stationGrid = document.getElementById("station-grid");

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value || 0);
}

function stationLabel(station) {
  return station === "poste-2" ? "Poste 2" : "Poste 1";
}

function totalsFor(jobs, station) {
  return jobs.filter((job) => job.station === station).reduce((totals, job) => {
    totals.bw += job.bwPages || 0;
    totals.color += job.colorPages || 0;
    totals.total += job.totalPages || 0;
    totals.jobs += 1;
    return totals;
  }, { bw: 0, color: 0, total: 0, jobs: 0 });
}

function renderCounters(jobs) {
  const bw = jobs.reduce((sum, job) => sum + (job.bwPages || 0), 0);
  const color = jobs.reduce((sum, job) => sum + (job.colorPages || 0), 0);
  const total = bw + color;
  metricBw.textContent = formatNumber(bw);
  metricColor.textContent = formatNumber(color);
  metricTotal.textContent = formatNumber(total);
  metricJobs.textContent = `${jobs.length} dossier${jobs.length > 1 ? "s" : ""}`;
  metricBwRate.textContent = total ? `${Math.round((bw / total) * 100)}% du total` : "0% du total";
  metricColorRate.textContent = total ? `${Math.round((color / total) * 100)}% du total` : "0% du total";
}

function renderStations(jobs) {
  stationGrid.innerHTML = ["poste-1", "poste-2"].map((station) => {
    const totals = totalsFor(jobs, station);
    return `
      <article class="simple-station-card">
        <div>
          <h3>${stationLabel(station)}</h3>
          <p>${totals.jobs} dossier${totals.jobs > 1 ? "s" : ""}</p>
        </div>
        <div><span>N&B</span><strong>${formatNumber(totals.bw)}</strong></div>
        <div><span>Couleur</span><strong>${formatNumber(totals.color)}</strong></div>
      </article>
    `;
  }).join("");
}

function renderTable(jobs) {
  const latest = [...jobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);
  clientTable.innerHTML = latest.length ? latest.map((job) => `
    <tr>
      <td>${job.code}</td>
      <td>${job.customerName || "Client"}</td>
      <td>${stationLabel(job.station)}</td>
      <td>${formatNumber(job.bwPages || 0)}</td>
      <td>${formatNumber(job.colorPages || 0)}</td>
      <td><strong>${formatNumber(job.totalPages || 0)}</strong></td>
    </tr>
  `).join("") : `<tr><td colspan="6">Aucun dossier pour le moment.</td></tr>`;
}

async function refreshDashboard() {
  const response = await fetch("/api/jobs");
  const payload = await response.json();
  if (!response.ok) return;
  const jobs = payload.jobs || [];
  renderCounters(jobs);
  renderStations(jobs);
  renderTable(jobs);
}

document.getElementById("refresh-admin").addEventListener("click", refreshDashboard);
refreshDashboard();
window.setInterval(refreshDashboard, 6000);
