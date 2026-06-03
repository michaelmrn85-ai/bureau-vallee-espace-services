const uploadForm = document.getElementById("upload-form");
const filesInput = document.getElementById("files-input");
const selectedFiles = document.getElementById("selected-files");
const result = document.getElementById("result");
const resultCode = document.getElementById("result-code");
const uploadMessage = document.getElementById("upload-message");
const uploadBusy = document.getElementById("upload-busy");
let isUploading = false;

function currentStation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("station") === "poste-2" ? "poste-2" : "poste-1";
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
