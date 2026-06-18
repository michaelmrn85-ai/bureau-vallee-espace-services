const uploadForm = document.getElementById("upload-form");
const filesInput = document.getElementById("files-input");
const selectedFiles = document.getElementById("selected-files");
const result = document.getElementById("result");
const resultCode = document.getElementById("result-code");
const resultHelp = document.getElementById("result-help");
const uploadLead = document.getElementById("upload-lead");
const uploadMessage = document.getElementById("upload-message");
const uploadBusy = document.getElementById("upload-busy");
const customerNameInput = document.getElementById("customer-name");
const mobileGreeting = document.getElementById("mobile-greeting");
let isUploading = false;

function params() {
  return new URLSearchParams(window.location.search);
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function currentStation() {
  return params().get("station") === "poste-2" ? "poste-2" : "poste-1";
}

function existingJobCode() {
  const code = String(params().get("code") || "").replace(/\D/g, "").slice(0, 4);
  return code.length === 4 ? code : "";
}

function uploadSource() {
  return params().get("source") === "mail" ? "mail" : "qr";
}

function setUploadMessage(text, tone = "") {
  uploadMessage.textContent = text;
  uploadMessage.dataset.tone = tone;
}

function setBusy(active) {
  isUploading = active;
  uploadBusy.classList.toggle("hidden", !active);
  filesInput.disabled = active;
}

function renderSelectedFiles() {
  selectedFiles.innerHTML = [...filesInput.files].map((file) => `<div>${file.name}</div>`).join("");
}

function setupIdentity() {
  const query = params();
  const customerName = cleanName(query.get("customerName"));
  const clientId = String(query.get("clientId") || "").replace(/\D/g, "").slice(0, 5);
  if (customerName) {
    customerNameInput.value = customerName;
    mobileGreeting.textContent = `Bonjour ${customerName}${clientId.length === 5 ? ` - ID ${clientId}` : ""}`;
  }
  const code = existingJobCode();
  if (code) {
    uploadLead.textContent = "Ajoutez vos fichiers. Ils seront ajoutes au dossier deja ouvert sur le poste.";
    resultHelp.textContent = "Vos nouveaux fichiers sont transmis au poste.";
  }
  if (uploadSource() === "mail") {
    uploadLead.textContent = code
      ? "Ajoutez les pieces jointes recues par mail au dossier deja ouvert sur le poste."
      : "Ajoutez les pieces jointes recues par mail. Un code dossier sera cree pour les ouvrir sur le poste.";
  }
  if (query.get("mode") === "admin") {
    uploadLead.textContent = "Envoyez vos fichiers au comptoir Bureau Vallee.";
    resultHelp.textContent = "Merci. Vos fichiers sont bien envoyes au comptoir.";
  }
}

async function sendUpload() {
  if (isUploading) return;
  if (!filesInput.files.length) {
    setUploadMessage("Ajoutez au moins un fichier.", "error");
    return;
  }

  const query = params();
  const formData = new FormData(uploadForm);
  const customerName = cleanName(query.get("customerName"));
  const clientId = String(query.get("clientId") || "").replace(/\D/g, "").slice(0, 5);
  formData.set("station", currentStation());
  formData.set("printMode", "noir-blanc");
  formData.set("source", uploadSource());
  if (customerName) formData.set("customerName", customerName);
  if (clientId.length === 5) formData.set("clientId", clientId);
  if (query.get("printCard") === "1") formData.set("printCard", "1");
  if (query.get("mode") === "admin") {
    formData.set("adminUpload", "1");
    if (!formData.get("customerName")) formData.set("customerName", "Client comptoir");
  }

  setBusy(true);
  setUploadMessage("");
  result.classList.add("hidden");
  try {
    const code = existingJobCode();
    const endpoint = code ? `/api/jobs/${code}/files` : "/api/jobs";
    const response = await fetch(endpoint, { method: "POST", body: formData });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Envoi impossible.");
    resultCode.textContent = payload.code;
    result.classList.remove("hidden");
    uploadForm.reset();
    selectedFiles.innerHTML = "";
    setUploadMessage("Fichiers envoyés.", "success");
  } catch (error) {
    setUploadMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

filesInput.addEventListener("change", () => {
  renderSelectedFiles();
  sendUpload();
});

uploadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendUpload();
});

setupIdentity();



