async function loadNotice() {
  const banner = document.getElementById("notice-banner");
  const noticeScreen = document.getElementById("notice-screen");
  const noticeScreenMessage = document.getElementById("notice-screen-message");
  if (!banner && !noticeScreen) return;

  function hideNotice() {
    document.body.classList.remove("notice-active");
    if (banner) {
      banner.classList.add("hidden");
      banner.textContent = "";
    }
    if (noticeScreen) {
      noticeScreen.classList.add("hidden");
    }
    if (noticeScreenMessage) {
      noticeScreenMessage.textContent = "";
    }
  }

  try {
    const response = await fetch("/api/notice");
    const notice = await response.json();
    if (!notice.active || !notice.message) {
      hideNotice();
      return;
    }

    if (noticeScreen && noticeScreenMessage) {
      noticeScreenMessage.textContent = notice.message;
      noticeScreen.classList.remove("hidden");
      document.body.classList.add("notice-active");
      if (banner) banner.classList.add("hidden");
      return;
    }

    if (banner) {
      banner.textContent = notice.message;
      banner.classList.remove("hidden");
    }
  } catch (error) {
    hideNotice();
  }
}

loadNotice();
window.setInterval(loadNotice, 3000);
