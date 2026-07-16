const dashboardUpdated = document.getElementById("dashboard-updated");
const adminActionStatus = document.getElementById("admin-action-status");
const counterUploadUrl = document.getElementById("counter-upload-url");
const copyCounterUrl = document.getElementById("copy-counter-url");
const counterQr = document.getElementById("counter-qr");
const adminTabButtons = document.querySelectorAll("[data-admin-tab]");
const messageList = document.getElementById("file-message-list");
const messageDetail = document.getElementById("file-message-detail");
const mailboxTitle = document.getElementById("mailbox-title");
const mailboxSubtitle = document.getElementById("mailbox-subtitle");
const mailCount = document.getElementById("mail-count");
const qrCount = document.getElementById("qr-count");

let allJobs = [];
let activeTab = "mail";
let selectedJobCode = "";

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

function stationName(stationId) {
  return stationId === "poste-2" ? "Poste 2" : "Poste 1";
}

function senderLabel(job) {
  return job.senderEmail || job.customerName || "Client";
}

function sourceLabel(job) {
  if (job.source === "mail") return job.counterOnly ? "Mail - comptoir" : "Mail client";
  if (job.adminUpload || job.source === "comptoir") return "QR comptoir";
  if (job.source === "qr") return "QR client";
  return job.source || "Dossier";
}

function fileDownloadUrl(job, file) {
  return file?.downloadUrl || (job?.code && file?.id ? `/api/jobs/${encodeURIComponent(job.code)}/files/${encodeURIComponent(file.id)}?download=1` : "");
}

function jobDownloadAllUrl(job) {
  return job?.downloadAllUrl || (job?.code && job?.files?.length ? `/api/jobs/${encodeURIComponent(job.code)}/download-all` : "");
}

function jobsForTab(tab) {
  return allJobs
    .filter((job) => tab === "mail" ? job.source === "mail" : (job.source === "qr" || job.source === "comptoir" || (job.adminUpload && job.source !== "mail")))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function renderMailboxList() {
  const mailJobs = jobsForTab("mail");
  const qrJobs = jobsForTab("qr");
  if (mailCount) mailCount.textContent = String(mailJobs.length);
  if (qrCount) qrCount.textContent = String(qrJobs.length);

  const jobs = activeTab === "mail" ? mailJobs : qrJobs;
  if (mailboxTitle) mailboxTitle.textContent = activeTab === "mail" ? "Fichiers mail" : "Fichiers QR code";
  if (mailboxSubtitle) mailboxSubtitle.textContent = activeTab === "mail" ? "Envois reçus par adresse mail." : "Envois reçus par QR client ou QR comptoir.";
  if (!jobs.some((job) => job.code === selectedJobCode)) selectedJobCode = jobs[0]?.code || "";

  messageList.innerHTML = jobs.length ? jobs.map((job) => `
    <button class="file-message-item${job.code === selectedJobCode ? " active" : ""}" type="button" data-job-code="${escapeHtml(job.code)}">
      <span>${escapeHtml(sourceLabel(job))}</span>
      <strong>${escapeHtml(senderLabel(job))}</strong>
      <small>${new Date(job.createdAt).toLocaleString("fr-FR")} · ${(job.files || []).length} fichier${(job.files || []).length > 1 ? "s" : ""}</small>
      ${job.counterOnly ? `<em>Comptoir</em>` : `<em>Poste</em>`}
    </button>
  `).join("") : `<p class="admin-empty-files">Aucun fichier pour le moment.</p>`;
  renderSelectedDetail();
}

function renderSelectedDetail() {
  const job = allJobs.find((item) => item.code === selectedJobCode);
  if (!job) {
    messageDetail.innerHTML = `<p class="admin-empty-files">Aucun envoi sélectionné.</p>`;
    return;
  }
  const files = job.files || [];
  const folderUrl = jobDownloadAllUrl(job);
  messageDetail.innerHTML = `
    <header class="file-detail-head">
      <div>
        <span>${escapeHtml(sourceLabel(job))} · Code ${escapeHtml(job.code)}</span>
        <h3>${escapeHtml(senderLabel(job))}</h3>
        <p>${new Date(job.createdAt).toLocaleString("fr-FR")} · ${escapeHtml(job.stationLabel || "")}</p>
      </div>
      ${folderUrl ? `<a class="counter-download" href="${folderUrl}">Télécharger le dossier</a>` : ""}
    </header>
    ${job.counterOnly ? `<div class="file-detail-alert">Fichier Word/DOC reçu : traitement au comptoir.</div>` : ""}
    <div class="file-detail-list">
      ${files.map((file) => {
        const url = fileDownloadUrl(job, file);
        return `<div class="file-detail-row">
          <div>
            <strong>${escapeHtml(file.originalName)}</strong>
            <span>${escapeHtml(String(file.extension || "").toUpperCase())} · ${formatSize(file.size)} · ${file.pages || 1} page(s)</span>
          </div>
          ${url ? `<a href="${url}">Télécharger</a>` : `<span>Lien indisponible</span>`}
        </div>`;
      }).join("")}
    </div>
  `;
}

async function refreshFiles() {
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) return;
    allJobs = payload.jobs || [];
    if (dashboardUpdated) dashboardUpdated.textContent = `Fichiers reçus - ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    renderMailboxList();
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
  if (!window.confirm(`Confirmer l'extinction du ${label} ?`)) return;
  if (adminActionStatus) adminActionStatus.textContent = `Commande d'extinction envoyée au ${label}...`;
  try {
    const response = await fetch(`/api/stations/${station}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "shutdown-station" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Commande impossible.");
    if (adminActionStatus) adminActionStatus.textContent = `Extinction demandée pour ${label}.`;
  } catch (error) {
    if (adminActionStatus) adminActionStatus.textContent = error.message || "Commande impossible.";
  }
}

document.getElementById("refresh-admin")?.addEventListener("click", refreshFiles);
adminTabButtons.forEach((button) => button.addEventListener("click", () => {
  activeTab = button.dataset.adminTab || "mail";
  adminTabButtons.forEach((item) => item.classList.toggle("active", item === button));
  selectedJobCode = "";
  renderMailboxList();
}));
messageList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-job-code]");
  if (!button) return;
  selectedJobCode = button.dataset.jobCode || "";
  renderMailboxList();
});
document.querySelectorAll("[data-shutdown-station]").forEach((button) => button.addEventListener("click", () => shutdownStation(button.dataset.shutdownStation)));
copyCounterUrl?.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(counterUploadUrl.value);
  if (adminActionStatus) adminActionStatus.textContent = "Lien comptoir copié.";
});

refreshFiles();
window.setInterval(refreshFiles, 5000);
loadAdminConfig();
