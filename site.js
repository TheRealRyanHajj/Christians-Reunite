function createIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function emptyState(title, copy) {
  return `<div class="empty"><strong>${escapeText(title)}</strong><br>${escapeText(copy)}</div>`;
}

document.addEventListener("DOMContentLoaded", createIcons);
