const station = window.location.pathname.includes("poste-2") ? "poste-2" : "poste-1";
const stationLabel = document.getElementById("station-label");
const usbButton = document.getElementById("usb-button");
const qrButton = document.getElementById("qr-button");
const usbFiles = document.getElementById("usb-files");
const statusMessage = document.getElementById("status-message");
const qrModal = document.getElementById("qr-modal");
const qrImage = document.getElementById("qr-image");
const uploadUrl = document.getElementById("upload-url");
const closeQr = document.getElementById("close-qr");
const copyUrl = document.getElementById("copy-url");

function stationName() {
  return station === "poste-2" ? "Poste 2" : "Poste 1";
}

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

function qrParams() {
  return new URLSearchParams({
    station,
    source: "qr",
  }).toString();
}

function openQrModal() {
  const params = qrParams();
  const url = `${window.location.origin}/upload?${params}`;
  qrImage.src = `/qr.svg?${params}&t=${Date.now()}`;
  uploadUrl.value = url;
  qrModal.classList.remove("hidden");
  setStatus("Scannez le QR code pour envoyer vos documents.", "success");
}

async function uploadUsbFiles(files) {
  if (!files.length) return;
  const formData = new FormData();
  formData.set("station", station);
  formData.set("customerName", `Client ${stationName()}`);
  formData.set("source", "usb");
  formData.set("printMode", "noir-blanc");
  files.forEach((file) => formData.append("files", file));

  setStatus("Chargement des fichiers de la clé USB...");
  usbButton.disabled = true;
  qrButton.disabled = true;

  try {
    const response = await fetch("/api/jobs", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Chargement impossible.");
    setStatus(`Fichiers reçus. Code dossier : ${payload.code}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    usbButton.disabled = false;
    qrButton.disabled = false;
    usbFiles.value = "";
  }
}

stationLabel.textContent = stationName();

usbButton.addEventListener("click", () => {
  usbFiles.click();
});

qrButton.addEventListener("click", openQrModal);

usbFiles.addEventListener("change", () => {
  uploadUsbFiles([...usbFiles.files]);
});

closeQr.addEventListener("click", () => {
  qrModal.classList.add("hidden");
});

copyUrl.addEventListener("click", async () => {
  await navigator.clipboard?.writeText(uploadUrl.value);
  setStatus("Lien copié.", "success");
});
