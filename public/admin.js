const codesList = document.getElementById("codes-list");
const codesMessage = document.getElementById("codes-message");
const refreshBtn = document.getElementById("refresh-codes");
const noticeInput = document.getElementById("notice-message");
const activateBtn = document.getElementById("activate-notice");
const disableBtn = document.getElementById("disable-notice");
const adminMessage = document.getElementById("notice-admin-message");
const sessionInput = document.getElementById("session-message");
const sessionAdminMessage = document.getElementById("session-admin-message");

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function setCodesMessage(text, tone = "") {
  codesMessage.textContent = text;
  codesMessage.dataset.tone = tone;
}

function setAdminMessage(text, tone = "") {
  adminMessage.textContent = text;
  adminMessage.dataset.tone = tone;
}

function setSessionAdminMessage(text, tone = "") {
  sessionAdminMessage.textContent = text;
  sessionAdminMessage.dataset.tone = tone;
}

function renderSessionStatuses(stations) {
  Object.entries(stations || {}).forEach(([station, state]) => {
    const label = document.getElementById(`${station}-status`);
    if (!label) return;
    label.textContent = state.active ? "Ouvert" : "Ferme";
    label.dataset.tone = state.active ? "success" : "";
  });
}

function renderPrintRequests(job) {
  if (!job.printRequests?.length) return "";
  const labels = {
    queued: "En attente",
    printing: "En impression",
    done: "Imprime",
    failed: "Erreur",
  };
  return `
    <div class="print-request-list">
      ${job.printRequests.map((request) => `
        <span>${request.fileName || "PDF"} - ${labels[request.status] || request.status} - ${request.settingsLabel || job.printSettingsLabel || ""}${request.error ? ` - ${request.error}` : ""}</span>
      `).join("")}
    </div>
  `;
}

function renderJobs(jobs) {
  if (!jobs.length) {
    codesList.innerHTML = `
      <div class="empty-card">
        <strong>Aucun code actif.</strong>
        <p>Les prochains uploads clients apparaitront ici.</p>
      </div>
    `;
    return;
  }

  const stations = [
    { id: "poste-1", label: "Poste 1" },
    { id: "poste-2", label: "Poste 2" },
  ];

  codesList.innerHTML = stations.map((station) => {
    const stationJobs = jobs.filter((job) => (job.station || "poste-1") === station.id);
    const totals = stationJobs.reduce((sum, job) => ({
      bwPages: sum.bwPages + Number(job.bwPages || 0),
      colorPages: sum.colorPages + Number(job.colorPages || 0),
      totalPages: sum.totalPages + Number(job.totalPages || 0),
    }), { bwPages: 0, colorPages: 0, totalPages: 0 });

    return `
      <section class="station-history">
        <div class="station-history-heading">
          <div>
            <p class="eyebrow">Historique impression</p>
            <h3>${station.label}</h3>
          </div>
          <div class="station-history-totals">
            <span>N&B <strong>${totals.bwPages}</strong></span>
            <span>Couleur <strong>${totals.colorPages}</strong></span>
            <span>Total <strong>${totals.totalPages}</strong></span>
          </div>
        </div>
        ${stationJobs.length ? stationJobs.map((job) => `
    <article class="code-card ${job.status === "termine" ? "is-complete" : ""}">
      <div class="code-main">
        <span>Code</span>
        <strong>${job.code}</strong>
        <em>${job.status === "termine" ? "Termine" : "Actif"}</em>
      </div>
      <div>
        <h2>${job.customerName || "Client"}</h2>
        <p>${job.files.length} fichier(s) - ${job.stationLabel || station.label} - depot ${formatDate(job.createdAt)}${job.deletedAt ? ` - termine ${formatDate(job.deletedAt)}` : ""}</p>
        <p>Compteur session : ${job.bwPages || 0} page(s) N&B, ${job.colorPages || 0} page(s) couleur.</p>
        <p>${job.printSettingsLabel || (job.printMode === "couleur" ? "Couleur" : "Noir et blanc")}</p>
        <div class="code-files">
          ${job.files.map((file) => `<span>${file.originalName} - ${file.pages} page(s)</span>`).join("")}
        </div>
        ${renderPrintRequests(job)}
      </div>
      <div class="code-metrics">
        <div><span>N&B</span><strong>${job.bwPages}</strong></div>
        <div><span>Couleur</span><strong>${job.colorPages}</strong></div>
        <div><span>Total</span><strong>${job.totalPages}</strong></div>
      </div>
    </article>
        `).join("") : `
          <div class="empty-card">
            <strong>Aucun suivi sur ${station.label}.</strong>
          </div>
        `}
      </section>
    `;
  }).join("");
}

async function loadCodes() {
  setCodesMessage("Chargement des codes...");
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    renderJobs(payload.jobs || []);
    setCodesMessage(`${payload.jobs?.length || 0} suivi(s) client conserve(s).`, "success");
  } catch (error) {
    setCodesMessage(error.message, "error");
  }
}

async function loadNotice() {
  try {
    const response = await fetch("/api/notice");
    const notice = await response.json();
    noticeInput.value = notice.message || "";
    setAdminMessage(notice.active ? "Message actuellement affiche." : "Aucun message affiche.", notice.active ? "success" : "");
  } catch (error) {
    setAdminMessage("Message actuel indisponible.", "error");
  }
}

async function loadSession() {
  try {
    const response = await fetch("/api/session");
    const session = await response.json();
    sessionInput.value = session.message || "";
    renderSessionStatuses(session.stations);
    setSessionAdminMessage("Etat des postes charge.", "success");
  } catch (error) {
    setSessionAdminMessage("Etat de session indisponible.", "error");
  }
}

async function saveSession(station, active) {
  const message = sessionInput.value.trim() || "Bienvenue en Espace Services, merci de vous approcher du ou de la vendeuse.";
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station, active, message }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
    renderSessionStatuses(payload.stations);
    setSessionAdminMessage(`${payload.stationLabel} ${payload.active ? "ouvert" : "ferme avec message d'accueil"}.`, payload.active ? "success" : "");
  } catch (error) {
    setSessionAdminMessage(error.message, "error");
  }
}

async function saveNotice(active) {
  const message = noticeInput.value.trim();
  try {
    const response = await fetch("/api/notice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active, message }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
    setAdminMessage(payload.active ? "Message affiche sur les pages clients." : "Message desactive.", "success");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
}

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    noticeInput.value = button.dataset.preset;
  });
});

refreshBtn.addEventListener("click", loadCodes);

activateBtn.addEventListener("click", () => {
  if (!noticeInput.value.trim()) {
    setAdminMessage("Ecrivez ou selectionnez un message.", "error");
    return;
  }
  saveNotice(true);
});

disableBtn.addEventListener("click", () => {
  saveNotice(false);
});

document.querySelectorAll("[data-session-action][data-station]").forEach((button) => {
  button.addEventListener("click", () => {
    saveSession(button.dataset.station, button.dataset.sessionAction === "open");
  });
});

loadCodes();
loadNotice();
loadSession();
