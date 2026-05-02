const form = document.getElementById("phone-upload-form");
const fileInput = document.getElementById("phone-files");
const fileList = document.getElementById("phone-file-list");
const result = document.getElementById("pickup-result");
const resultCode = document.getElementById("pickup-result-code");

const allowedExtensions = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];

function formatBytes(bytes) {
  if (!bytes) return "0 Ko";
  const units = ["o", "Ko", "Mo", "Go"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function isAllowed(file) {
  const name = file.name.toLowerCase();
  return allowedExtensions.some((extension) => name.endsWith(extension));
}

function renderFiles() {
  const files = [...fileInput.files];
  if (!files.length) {
    fileList.innerHTML = "";
    return;
  }

  fileList.innerHTML = files
    .map((file) => `
      <div class="phone-file-row">
        <strong>${file.name}</strong>
        <span>${formatBytes(file.size)} - ${isAllowed(file) ? "OK" : "Format refuse"}</span>
      </div>
    `)
    .join("");
}

fileInput.addEventListener("change", renderFiles);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...fileInput.files];
  if (!files.length) return;
  const refused = files.find((file) => !isAllowed(file));
  if (refused) {
    alert(`${refused.name} n'est pas un format accepte.`);
    return;
  }

  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.textContent = "Envoi en cours...";

  try {
    const body = new FormData(form);
    const response = await fetch("/api/jobs", {
      method: "POST",
      body,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Envoi impossible.");

    resultCode.textContent = payload.code;
    result.classList.remove("hidden");
    form.classList.add("hidden");
  } catch (error) {
    alert(error.message);
    submit.disabled = false;
    submit.textContent = "Obtenir mon code";
  }
});
