const noticeInput = document.getElementById("notice-message");
const activateBtn = document.getElementById("activate-notice");
const disableBtn = document.getElementById("disable-notice");
const adminMessage = document.getElementById("notice-admin-message");

function setAdminMessage(text, tone = "") {
  adminMessage.textContent = text;
  adminMessage.dataset.tone = tone;
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
