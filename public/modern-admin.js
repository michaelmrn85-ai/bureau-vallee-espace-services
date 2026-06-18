const stationGrid = document.getElementById("station-grid");
const clientTable = document.getElementById("client-table");
const alertBand = document.getElementById("alert-band");
const metrics = {
  stations: document.getElementById("metric-stations"),
  clients: document.getElementById("metric-clients"),
  total: document.getElementById("metric-total"),
  bw: document.getElementById("metric-bw"),
  bwRate: document.getElementById("metric-bw-rate"),
  color: document.getElementById("metric-color"),
  colorRate: document.getElementById("metric-color-rate"),
};

const stationMeta = {
  "poste-1": { label: "Poste 1 - Accueil", ip: "192.168.1.101", model: "HP LaserJet Pro M404dn", place: "Accueil" },
  "poste-2": { label: "Poste 2 - Étage", ip: "192.168.1.102", model: "HP Color LaserJet Pro M454dw", place: "1er étage" },
};

function number(value) {
  return new Intl.NumberFormat("fr-FR").format(value || 0);
}

function groupRows(jobs) {
  const rows = new Map();
  for (const job of jobs) {
    const key = job.customerName || "Client";
    const row = rows.get(key) || { client: key, clientId: job.clientId || "", p1bw: 0, p2bw: 0, color: 0, total: 0, last: "" };
    const bw = job.bwPages || 0;
    const color = job.colorPages || 0;
    if (job.station === "poste-2") row.p2bw += bw;
    else row.p1bw += bw;
    row.color += color;
    row.total += job.totalPages || bw + color;
    row.clientId = row.clientId || job.clientId || "";
    row.last = job.createdAt || row.last;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

function renderMetrics(jobs) {
  const clients = new Set(jobs.map((job) => job.clientId || job.customerName).filter(Boolean));
  const bw = jobs.reduce((sum, job) => sum + (job.bwPages || 0), 0);
  const color = jobs.reduce((sum, job) => sum + (job.colorPages || 0), 0);
  const total = bw + color;
  metrics.stations.textContent = "2";
  metrics.clients.textContent = number(clients.size);
  metrics.total.textContent = number(total);
  metrics.bw.textContent = number(bw);
  metrics.color.textContent = number(color);
  metrics.bwRate.textContent = total ? `${Math.round((bw / total) * 100)}%` : "0%";
  metrics.colorRate.textContent = total ? `${Math.round((color / total) * 100)}%` : "0%";
}

function renderTable(jobs) {
  const rows = groupRows(jobs);
  clientTable.innerHTML = rows.length ? rows.map((row) => `
    <tr>
      <td><strong>${row.client}</strong>${row.clientId ? `<br><small>ID ${row.clientId}</small>` : ""}</td>
      <td>${number(row.p1bw)}</td>
      <td>${number(row.p2bw)}</td>
      <td>${number(row.color)}</td>
      <td><strong>${number(row.total)}</strong></td>
      <td>${row.last ? new Date(row.last).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">Aucune impression pour le moment.</td></tr>`;
}

function stationTotals(jobs, station) {
  return jobs.filter((job) => job.station === station).reduce((acc, job) => {
    acc.bw += job.bwPages || 0;
    acc.color += job.colorPages || 0;
    acc.sessions += 1;
    return acc;
  }, { bw: 0, color: 0, sessions: 0 });
}

function renderStations(jobs, session) {
  stationGrid.innerHTML = Object.entries(stationMeta).map(([id, meta]) => {
    const totals = stationTotals(jobs, id);
    const paused = Boolean(session?.stations?.[id]?.active);
    return `
      <article class="station-card">
        <div class="printer-visual">▣</div>
        <div>
          <h3>${meta.label} <span class="badge">${paused ? "En pause" : "En ligne"}</span></h3>
          <p>IP : ${meta.ip}</p>
          <p>Modèle : ${meta.model}</p>
          <p>Emplacement : ${meta.place}</p>
        </div>
        <div class="station-actions">
          <strong>${number(totals.bw)} <small>N&B</small></strong>
          <strong>${number(totals.color)} <small>Couleur</small></strong>
          <button class="primary" data-toggle-station="${id}" data-paused="${paused}" type="button">${paused ? "Rouvrir le poste" : "Stopper le poste"}</button>
          <button class="secondary" data-shutdown-station="${id}" type="button">Éteindre le poste</button>
        </div>
      </article>
    `;
  }).join("");
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
  return payload;
}

async function refresh() {
  const [{ jobs }, session, help] = await Promise.all([
    fetchJson("/api/jobs"),
    fetchJson("/api/session"),
    fetchJson("/api/help"),
  ]);
  renderMetrics(jobs);
  renderTable(jobs);
  renderStations(jobs, session);
  const requests = help.requests || [];
  if (requests.length) {
    alertBand.querySelector("p").textContent = `${requests.length} demande(s) d'aide en attente.`;
  } else {
    alertBand.querySelector("p").textContent = "Aucune alerte en cours.";
  }
}

async function toggleStation(station, paused) {
  await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station, active: !paused, message: "Poste momentanément indisponible." }),
  });
  refresh();
}

async function shutdownStation(station) {
  await fetch(`/api/stations/${station}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "shutdown-station" }),
  });
  window.alert("Commande d'arrêt envoyée au poste.");
  refresh();
}

document.body.addEventListener("click", (event) => {
  const toggle = event.target.dataset.toggleStation;
  if (toggle) toggleStation(toggle, event.target.dataset.paused === "true");
  const shutdown = event.target.dataset.shutdownStation;
  if (shutdown) shutdownStation(shutdown);
});

document.getElementById("refresh-admin").addEventListener("click", refresh);
refresh();
window.setInterval(refresh, 6000);
