const wall = document.querySelector("#prayerWall");

function renderWall(items) {
  if (!items.length) {
    wall.innerHTML = emptyState("No public requests yet", "Shared requests will appear here.");
    return;
  }

  wall.innerHTML = items.map((item) => `
    <article class="request-card">
      <div class="meta">
        <span class="pill">${escapeText(item.category)}</span>
        ${item.urgent ? '<span class="pill urgent">Urgent</span>' : ""}
        <span>${escapeText(item.name || "Anonymous")}</span>
        <span>${formatDate(item.created_at)}</span>
      </div>
      <p>${escapeText(item.prayer_request)}</p>
    </article>
  `).join("");
}

async function loadWall() {
  wall.innerHTML = emptyState("Loading", "Please wait.");

  try {
    const response = await fetch("/api/prayers");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load prayer wall.");
    renderWall(data.prayers || []);
  } catch (error) {
    wall.innerHTML = emptyState("Could not load requests", error.message);
  }
}

document.querySelector("#refreshWall").addEventListener("click", loadWall);
loadWall();
