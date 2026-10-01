const statusText = document.querySelector(".status-indicator span:last-child");
const retryButton = document.getElementById("retry-button");

function reloadSoon(delayMs = 0) {
  window.setTimeout(() => window.location.reload(), delayMs);
}

function updateStatusIndicator() {
  if (!statusText) return;
  if (navigator.onLine) {
    statusText.textContent = "متصل - جاري إعادة التحميل...";
    reloadSoon(1000);
  } else {
    statusText.textContent = "يتم البحث عن الاتصال...";
  }
}

function updateConnectionStatus() {
  if (navigator.onLine) reloadSoon();
}

retryButton?.addEventListener("click", () => {
  window.location.reload();
});

window.addEventListener("online", () => {
  window.location.reload();
});

window.setInterval(updateConnectionStatus, 3000);
window.setInterval(updateStatusIndicator, 2000);
updateStatusIndicator();
