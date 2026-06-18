async function loadSessionState() {
  const screen = document.getElementById("session-screen");
  const message = document.getElementById("session-screen-message");
  if (!screen || !message) return;
  document.body.classList.remove("session-closed");
  screen.classList.add("hidden");
  message.textContent = "";
}

loadSessionState();
