async function loadNotice() {
  const banner = document.getElementById("notice-banner");
  if (!banner) return;
  try {
    const response = await fetch("/api/notice");
    const notice = await response.json();
    if (!notice.active || !notice.message) {
      banner.classList.add("hidden");
      banner.textContent = "";
      return;
    }
    banner.textContent = notice.message;
    banner.classList.remove("hidden");
  } catch (error) {
    banner.classList.add("hidden");
  }
}

loadNotice();
window.setInterval(loadNotice, 15000);
