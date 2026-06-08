const stationDashboard = document.getElementById("station-dashboard");
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

function donePrintCount(job) {
  return (job.printRequests || []).filter((request) => request.status === "done").length;
}

function summarizeStation(stationId) {
  return latestJobs
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

function renderDashboard() {
  stationDashboard.innerHTML = Object.entries(latestStations).map(([stationId, station]) => {
    const summary = summarizeStation(stationId);
    const active = Boolean(station.active);
    return `
      <article class="station-counter-card ${active ? "is-open" : "is-closed"}">
        <div class="station-counter-heading">
          <div>
            <span>${station.label}</span>
            <strong>${active ? "Ouvert" : "Arret"}</strong>
          </div>
          <small>${summary.activeJobs} session(s) active(s)</small>
        </div>

        <div class="station-counter-total">
          <span>Total</span>
          <strong>${summary.totalPages}</strong>
          <small>${summary.donePrints} impression(s) confirmee(s)</small>
        </div>

        <div class="station-counter-grid">
          <div>
            <span>N&B</span>
            <strong>${summary.bwPages}</strong>
          </div>
          <div>
            <span>Couleur</span>
            <strong>${summary.colorPages}</strong>
          </div>
        </div>

        <div class="station-counter-actions">
          <button type="button" data-session-action="open" data-station="${stationId}">Ouvrir ${station.label}</button>
          <button class="danger" type="button" data-session-action="close" data-station="${stationId}">Arret ${station.label}</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadCodes() {
  setCodesMessage("Mise a jour des compteurs...");
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    latestJobs = payload.jobs || [];
    renderDashboard();
    setCodesMessage("Compteurs reels N&B et Couleur par poste.", "success");
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
      body: JSON.stringify({ station, active, message: "Mise a jour ou grande serie d'impressions en cours." }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
    latestStations = Object.fromEntries(Object.entries(payload.stations || latestStations).map(([id, state]) => [
      id,
      { label: state.label || latestStations[id]?.label || id, active: Boolean(state.active) },
    ]));
    renderDashboard();
    setCodesMessage(`${payload.stationLabel} ${payload.active ? "ouvert" : "en arret"}.`, payload.active ? "success" : "");
  } catch (error) {
    setCodesMessage(error.message, "error");
  }
}

refreshBtn.addEventListener("click", () => {
  loadCodes();
  loadSession();
});

stationDashboard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-session-action][data-station]");
  if (!button) return;
  saveSession(button.dataset.station, button.dataset.sessionAction === "open");
});

loadSession();
loadCodes();
window.setInterval(loadSession, 4000);
window.setInterval(loadCodes, 4000);
