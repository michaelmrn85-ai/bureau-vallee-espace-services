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

function isAdminUpload() {
  return params().get("mode") === "admin";
}

function currentStation() {
  return params().get("station") === "poste-2" ? "poste-2" : "poste-1";
}

function civilityLabel(value) {
  if (value === "madame") return "Madame";
  if (value === "monsieur") return "Monsieur";
  return "";
}

function setupCustomerFromQr() {
  const query = params();
  const customerName = cleanName(query.get("customerName"));
  const civility = civilityLabel(query.get("civility"));
  if (!customerName) return;
  customerNameInput.value = customerName;
  mobileGreeting.textContent = `Bonjour ${[civility, customerName].filter(Boolean).join(" ")}`;
  mobileGreeting.classList.remove("hidden");
  uploadLead.textContent = "Ajoutez vos fichiers. Le code obtenu sera rattache a votre session sur le poste.";
}

function setupUploadMode() {
  if (!isAdminUpload()) return;
  uploadLead.textContent = "Envoyez vos fichiers a l'equipe Bureau Vallee. Ils seront recuperes au comptoir.";
  resultHelp.textContent = "Merci. Vos fichiers sont bien envoyes au comptoir.";
}

function renderSelectedFiles() {
  const files = [...filesInput.files];
  selectedFiles.innerHTML = files.map((file) => `<div>${file.name}</div>`).join("");
}

function setUploadMessage(text, tone = "") {
  uploadMessage.textContent = text;
  uploadMessage.dataset.tone = tone;
}

function setUploadBusy(active) {
  isUploading = active;
  uploadBusy.classList.toggle("hidden", !active);
  filesInput.disabled = active;
}

async function sendUpload() {
  if (isUploading) return;
  if (!filesInput.files.length) {
    setUploadMessage("Ajoutez au moins un fichier.", "error");
    return;
  }

  const formData = new FormData(uploadForm);
  formData.set("station", currentStation());
  formData.set("printMode", "noir-blanc");
  formData.set("source", "qr");
  const query = params();
  const customerName = cleanName(query.get("customerName"));
  if (customerName) formData.set("customerName", customerName);
  if (["madame", "monsieur"].includes(query.get("civility"))) formData.set("civility", query.get("civility"));
  if (query.get("printCard") === "1") formData.set("printCard", "1");
  if (isAdminUpload()) {
    formData.set("adminUpload", "1");
    if (!formData.get("customerName")) formData.set("customerName", "Client comptoir");
  }
  setUploadBusy(true);
  setUploadMessage("Merci de patienter, envoi de vos fichiers...");
  result.classList.add("hidden");

  try {
    const response = await fetch("/api/jobs", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Envoi impossible.");
    resultCode.textContent = payload.code;
    result.classList.remove("hidden");
    uploadForm.reset();
    selectedFiles.innerHTML = "";
    setUploadMessage("Fichiers envoyes.", "success");
  } catch (error) {
    setUploadMessage(error.message, "error");
  } finally {
    setUploadBusy(false);
  }
}

filesInput.addEventListener("change", () => {
  renderSelectedFiles();
  sendUpload();
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  sendUpload();
});

setupUploadMode();
setupCustomerFromQr();
