async function loadSessionState() {
  const screen = document.getElementById("session-screen");
  const message = document.getElementById("session-screen-message");
  if (!screen || !message) return;
  const params = new URLSearchParams(window.location.search);
  const station = params.get("station") === "poste-2" || window.location.pathname.includes("poste-2") ? "poste-2" : "poste-1";

  try {
    const response = await fetch(`/api/session?station=${station}`);
    const session = await response.json();
    if (session.active) {
      document.body.classList.remove("session-closed");
      screen.classList.add("hidden");
      message.textContent = "";
      return;
    }

    message.textContent = session.message || "Bienvenue en Espace Services, merci de vous approcher du ou de la vendeuse.";
    screen.classList.remove("hidden");
    document.body.classList.add("session-closed");
  } catch (error) {
    message.textContent = "Bienvenue en Espace Services, merci de vous approcher du ou de la vendeuse.";
    screen.classList.remove("hidden");
    document.body.classList.add("session-closed");
  }
}

loadSessionState();
window.setInterval(loadSessionState, 3000);
