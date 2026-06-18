const state = {
  station: location.pathname.includes("poste-2") ? "poste-2" : "poste-1",
  customer: { id: "", firstName: "", lastName: "", printCard: false },
  job: null,
  selected: new Set(),
  previewFileId: "",
  qrPoll: null,
  qrStartedAt: 0,
};

const views = {
  identity: document.getElementById("identity-view"),
  home: document.getElementById("home-view"),
  print: document.getElementById("print-view"),
};
const identityForm = document.getElementById("identity-form");
const lastNameInput = document.getElementById("last-name");
const firstNameInput = document.getElementById("first-name");
const printCardInput = document.getElementById("print-card");
const clientIdInput = document.getElementById("client-id-input");
const customerPill = document.getElementById("customer-pill");
const stationLabel = document.getElementById("station-label");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const fileCount = document.getElementById("file-count");
const previewStage = document.getElementById("preview-stage");
const selectedSummary = document.getElementById("selected-summary");
const pagesSummary = document.getElementById("pages-summary");
const copiesInput = document.getElementById("copies");
const copiesSummary = document.getElementById("copies-summary");
const statusLine = document.getElementById("status-line");
const qrModal = document.getElementById("qr-modal");
const qrImage = document.getElementById("qr-image");
const uploadUrlInput = document.getElementById("upload-url");
const idModal = document.getElementById("id-modal");
const clientIdValue = document.getElementById("client-id-value");
const printModal = document.getElementById("print-modal");
const printModalTitle = document.getElementById("print-modal-title");
const printModalText = document.getElementById("print-modal-text");

function $(selector) {
  return document.querySelector(selector);
}

function showView(name) {
  Object.values(views).forEach((view) => view.classList.add("hidden"));
  views[name].classList.remove("hidden");
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function cleanId(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
}

function customerName() {
  return [state.customer.firstName, state.customer.lastName].filter(Boolean).join(" ");
}

function displayCustomer() {
  const name = `${state.customer.firstName} ${state.customer.lastName.toUpperCase()}`.trim();
  return name || "Session libre";
}

function updateCustomerUi() {
  const idLabel = state.customer.id ? ` - ID ${state.customer.id}` : "";
  customerPill.textContent = state.customer.firstName || state.customer.lastName
    ? `Bonjour ${displayCustomer()}${idLabel}`
    : "Session libre";
}

function queryParams() {
  const params = new URLSearchParams({
    station: state.station,
    customerName: customerName(),
    clientId: state.customer.id,
    printCard: state.customer.printCard ? "1" : "0",
  });
  return params.toString();
}

async function identifyCustomer() {
  const response = await fetch("/api/clients/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: customerName(),
      clientId: state.customer.id,
      printCard: state.customer.printCard ? "1" : "0",
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Identification impossible.");
  state.customer.id = payload.client.id;
  state.customer.printCard = Boolean(payload.client.printCard);
  clientIdValue.textContent = state.customer.id;
  idModal.classList.remove("hidden");
}

function settings() {
  const colorMode = document.querySelector("input[name='colorMode']:checked")?.value || "noir-blanc";
  const duplex = document.querySelector("input[name='duplex']:checked")?.value || "recto";
  const rangeMode = document.querySelector("input[name='rangeMode']:checked")?.value || "all";
  return {
    colorMode,
    duplex,
    paperSize: "A4",
    scaling: "ajuster",
    orientation: "auto",
    pageRange: rangeMode === "pages" ? document.getElementById("page-range").value : "",
    pagesPerSheet: 1,
    copies: Math.max(1, Number.parseInt(copiesInput.value, 10) || 1),
  };
}

function fileKind(file) {
  const ext = (file.extension || "").replace(".", "").toUpperCase();
  return ext || "DOC";
}

function normalizedExtension(file) {
  const ext = String(file?.extension || "").toLowerCase();
  return ext.startsWith(".") ? ext : `.${ext}`;
}

function renderPreview(file) {
  if (!file) {
    previewStage.innerHTML = `<div class="empty-preview">Sélectionnez un fichier pour afficher l'aperçu.</div>`;
    return;
  }
  const extension = normalizedExtension(file);
  if ([".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    const tag = extension === ".pdf"
      ? `<iframe src="${file.viewUrl}" title="${file.originalName}"></iframe>`
      : `<img src="${file.viewUrl}" alt="${file.originalName}">`;
    previewStage.innerHTML = tag;
    return;
  }
  previewStage.innerHTML = `<div class="empty-preview"><strong>${file.originalName}</strong><p>Ce format sera traité au comptoir avant impression.</p></div>`;
}

function updateSummary() {
  const files = state.job?.files || [];
  const selectedFiles = files.filter((file) => state.selected.has(file.id));
  const pages = selectedFiles.reduce((sum, file) => sum + (file.pages || 0), 0);
  selectedSummary.textContent = `${selectedFiles.length} fichier${selectedFiles.length > 1 ? "s" : ""}`;
  pagesSummary.textContent = `${pages} page${pages > 1 ? "s" : ""}`;
  copiesSummary.textContent = String(settings().copies);
  fileCount.textContent = `(${files.length})`;
}

function renderFiles() {
  const files = state.job?.files || [];
  if (!files.length) {
    fileList.innerHTML = `<div class="empty-preview">Aucun fichier dans cette session.</div>`;
    renderPreview(null);
    updateSummary();
    return;
  }
  if (!state.previewFileId || !files.some((file) => file.id === state.previewFileId)) {
    state.previewFileId = files[0].id;
  }
  fileList.innerHTML = files.map((file) => `
    <article class="file-row ${file.id === state.previewFileId ? "active" : ""}" data-file-id="${file.id}">
      <input type="checkbox" ${state.selected.has(file.id) ? "checked" : ""} data-select-file="${file.id}">
      <span class="file-badge">${fileKind(file)}</span>
      <div><strong>${file.originalName}</strong><p>${fileKind(file)} · ${(file.size / 1024 / 1024).toFixed(1)} Mo · ${file.pages || 1} page(s)</p></div>
      <div><button class="icon-btn" data-preview-file="${file.id}" type="button">◉</button><button class="icon-btn" data-delete-file="${file.id}" type="button">⌫</button></div>
    </article>
  `).join("");
  renderPreview(files.find((file) => file.id === state.previewFileId));
  updateSummary();
}

async function loadJob(code) {
  const response = await fetch(`/api/jobs/${code}?${queryParams()}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Session introuvable.");
  state.job = payload;
  state.selected = new Set(payload.files.map((file) => file.id));
  document.getElementById("job-code-label").textContent = `Code ${payload.code}`;
  showView("print");
  renderFiles();
}

async function pollQrUploads() {
  try {
    const response = await fetch("/api/jobs");
    const payload = await response.json();
    if (!response.ok) return;
    const matching = (payload.jobs || [])
      .filter((job) => job.station === state.station)
      .filter((job) => new Date(job.createdAt || 0).getTime() >= state.qrStartedAt)
      .filter((job) => {
        if (!state.customer.id && !customerName()) return true;
        return (state.customer.id && job.clientId === state.customer.id) || job.customerName === customerName();
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!matching) return;
    window.clearInterval(state.qrPoll);
    state.qrPoll = null;
    qrModal.classList.add("hidden");
    await loadJob(matching.code);
  } catch (error) {
    // The next polling cycle will retry.
  }
}

async function createOrAppendJob(files) {
  if (!files.length) return;
  const formData = new FormData();
  formData.set("station", state.station);
  formData.set("customerName", customerName() || `Client ${state.station === "poste-2" ? "Poste 2" : "Poste 1"}`);
  formData.set("clientId", state.customer.id);
  formData.set("printCard", state.customer.printCard ? "1" : "0");
  formData.set("source", "usb");
  formData.set("printMode", "noir-blanc");
  files.forEach((file) => formData.append("files", file));
  statusLine.textContent = "Chargement des fichiers...";
  const endpoint = state.job?.code ? `/api/jobs/${state.job.code}/files` : "/api/jobs";
  const response = await fetch(endpoint, { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
  state.job = payload;
  state.selected = new Set(payload.files.map((file) => file.id));
  document.getElementById("job-code-label").textContent = `Code ${payload.code}`;
  statusLine.textContent = "Fichiers prêts.";
  showView("print");
  renderFiles();
}

function openQr() {
  const url = `${location.origin}/upload?${queryParams()}`;
  qrImage.src = `/qr.svg?${queryParams()}&t=${Date.now()}`;
  uploadUrlInput.value = url;
  qrModal.classList.remove("hidden");
  state.qrStartedAt = Date.now() - 1000;
  window.clearInterval(state.qrPoll);
  state.qrPoll = window.setInterval(pollQrUploads, 2500);
}

async function lookupJob() {
  const code = window.prompt("Entrez le code de vos impressions");
  if (!code) return;
  try {
    await loadJob(code.replace(/\D/g, "").slice(0, 4));
  } catch (error) {
    window.alert(error.message);
  }
}

async function deleteFile(fileId) {
  if (!state.job) return;
  const response = await fetch(`/api/jobs/${state.job.code}/files/${fileId}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
  state.job = payload;
  state.selected.delete(fileId);
  renderFiles();
}

async function deleteSelected() {
  const ids = [...state.selected];
  for (const id of ids) await deleteFile(id);
}

async function printSelected() {
  if (!state.job) return;
  const files = state.job.files.filter((file) => state.selected.has(file.id));
  if (!files.length) {
    statusLine.textContent = "Sélectionnez au moins un fichier.";
    return;
  }
  printModalTitle.textContent = "En attente";
  printModalText.textContent = `${displayCustomer()}, vos impressions sont envoyées au copieur.${state.job.source === "usb" ? " N'oubliez pas votre clé USB." : ""}`;
  printModal.classList.remove("hidden");
  for (const file of files) {
    const response = await fetch(`/api/jobs/${state.job.code}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: file.id, settings: settings() }),
    });
    const payload = await response.json();
    if (!response.ok) {
      printModalTitle.textContent = "Action nécessaire";
      printModalText.textContent = payload.error || "Impression impossible.";
      return;
    }
    state.job = payload.job;
  }
  window.setTimeout(() => printModal.classList.add("hidden"), 3800);
}

async function endSession() {
  if (state.job?.code) await fetch(`/api/jobs/${state.job.code}`, { method: "DELETE" }).catch(() => {});
  state.job = null;
  state.selected.clear();
  showView("home");
}

async function requestHelp() {
  await fetch("/api/help", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ station: state.station }),
  }).catch(() => {});
  window.alert("Un conseiller a été prévenu.");
}

identityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.customer = {
    id: cleanId(clientIdInput.value),
    firstName: cleanName(firstNameInput.value),
    lastName: cleanName(lastNameInput.value),
    printCard: printCardInput.value === "yes",
  };
  if (!state.customer.firstName || !state.customer.lastName) return;
  await identifyCustomer();
  updateCustomerUi();
  showView("home");
});

document.body.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "usb") fileInput.click();
  if (action === "qr" || action === "phone") openQr();
  if (action === "lookup") lookupJob();
  if (action === "help") requestHelp();
  if (event.target.id === "add-files") fileInput.click();
  if (event.target.id === "print-selected") printSelected();
  if (event.target.id === "cancel-session") endSession();
  if (event.target.id === "delete-selected") deleteSelected();
  if (event.target.id === "identity-qr") openQr();
  if (event.target.id === "copy-url") navigator.clipboard?.writeText(uploadUrlInput.value);
  if (event.target.closest("[data-close-modal]")) event.target.closest(".modal").classList.add("hidden");
  if (event.target.closest("[data-close-modal]") && event.target.closest("#qr-modal")) {
    window.clearInterval(state.qrPoll);
    state.qrPoll = null;
  }
  const previewId = event.target.closest("[data-preview-file]")?.dataset.previewFile;
  if (previewId) {
    state.previewFileId = previewId;
    renderFiles();
  }
  const deleteId = event.target.closest("[data-delete-file]")?.dataset.deleteFile;
  if (deleteId) await deleteFile(deleteId);
});

document.body.addEventListener("change", (event) => {
  const selectId = event.target.dataset.selectFile;
  if (selectId) {
    if (event.target.checked) state.selected.add(selectId);
    else state.selected.delete(selectId);
    updateSummary();
  }
  if (event.target.id === "select-all") {
    state.selected = new Set(event.target.checked ? (state.job?.files || []).map((file) => file.id) : []);
    renderFiles();
  }
  if (["copies", "page-range"].includes(event.target.id) || event.target.name) updateSummary();
});

fileInput.addEventListener("change", async () => {
  try {
    await createOrAppendJob([...fileInput.files]);
  } catch (error) {
    statusLine.textContent = error.message;
  } finally {
    fileInput.value = "";
  }
});

stationLabel.textContent = state.station === "poste-2" ? "Poste 2" : "Poste 1";
updateCustomerUi();
showView("home");
