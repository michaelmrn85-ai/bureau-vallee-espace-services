const codesList = document.getElementById("codes-list");
const codesMessage = document.getElementById("codes-message");
const refreshBtn = document.getElementById("refresh-codes");

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
    <article class="code-card">
      <div class="code-main">
        <span>Code</span>
        <strong>${job.code}</strong>
      </div>
      <div>
        <h2>${job.customerName || "Client"}</h2>
        <p>${job.files.length} fichier(s) - depot ${formatDate(job.createdAt)} - ${job.printMode === "couleur" ? "Couleur" : "Noir et blanc"}</p>
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
    setCodesMessage(`${payload.jobs?.length || 0} code(s) actif(s).`, "success");
  } catch (error) {
    setCodesMessage(error.message, "error");
  }
}

refreshBtn.addEventListener("click", loadCodes);
loadCodes();
