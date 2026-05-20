const codesList = document.getElementById("codes-list");
const codesMessage = document.getElementById("codes-message");
const refreshBtn = document.getElementById("refresh-codes");
const noticeInput = document.getElementById("notice-message");
const activateBtn = document.getElementById("activate-notice");
const disableBtn = document.getElementById("disable-notice");
const adminMessage = document.getElementById("notice-admin-message");
const sessionInput = document.getElementById("session-message");
const openSessionBtn = document.getElementById("open-session");
const closeSessionBtn = document.getElementById("close-session");
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

  codesList.innerHTML = jobs.map((job) => `
    <article class="code-card ${job.status === "termine" ? "is-complete" : ""}">
      <div class="code-main">
        <span>Code</span>
        <strong>${job.code}</strong>
        <em>${job.status === "termine" ? "Termine" : "Actif"}</em>
      </div>
      <div>
        <h2>${job.customerName || "Client"}</h2>
        <p>${job.files.length} fichier(s) - depot ${formatDate(job.createdAt)} - ${job.printMode === "couleur" ? "Couleur" : "Noir et blanc"}${job.deletedAt ? ` - termine ${formatDate(job.deletedAt)}` : ""}</p>
        <div class="code-files">
          ${job.files.map((file) => `<span>${file.originalName} - ${file.pages} page(s)</span>`).join("")}
        </div>
      </div>
      <div class="code-metrics">
        <div><span>N&B</span><strong>${job.bwPages}</strong></div>
        <div><span>Couleur</span><strong>${job.colorPages}</strong></div>
        <div><span>Total</span><strong>${job.totalPages}</strong></div>
      </div>
    </article>
  `).join("");
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
    setSessionAdminMessage(session.active ? "Session client ouverte." : "Session client fermee.", session.active ? "success" : "");
  } catch (error) {
    setSessionAdminMessage("Etat de session indisponible.", "error");
  }
}

async function saveSession(active) {
  const message = sessionInput.value.trim() || "Bienvenue en Espace Services, merci de vous approcher du ou de la vendeuse.";
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active, message }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
    setSessionAdminMessage(payload.active ? "Session client ouverte." : "Session client fermee avec message d'accueil.", payload.active ? "success" : "");
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

openSessionBtn.addEventListener("click", () => {
  saveSession(true);
});

closeSessionBtn.addEventListener("click", () => {
  saveSession(false);
});

loadCodes();
loadNotice();
loadSession();
