const wall = document.querySelector("#prayerWall");
const wallSearch = document.querySelector("#wallSearch");
const wallCategory = document.querySelector("#wallCategory");
const wallPriority = document.querySelector("#wallPriority");
const wallSort = document.querySelector("#wallSort");
const wallCount = document.querySelector("#wallCount");
const wallPageInfo = document.querySelector("#wallPageInfo");
const prevWallPage = document.querySelector("#prevWallPage");
const nextWallPage = document.querySelector("#nextWallPage");

const WALL_PAGE_SIZE = 30;
let wallPage = 1;
let wallTotalPages = 1;
let wallSearchTimer = null;

function renderWall(items, meta) {
  wallTotalPages = meta.totalPages || 1;
  wallCount.textContent = `${meta.total || 0} request${meta.total === 1 ? "" : "s"}`;
  wallPageInfo.textContent = `Page ${meta.page || 1} of ${wallTotalPages}`;
  prevWallPage.disabled = wallPage <= 1;
  nextWallPage.disabled = wallPage >= wallTotalPages;

  if (!items.length) {
    wall.innerHTML = emptyState("No matching public requests", "Adjust search or filters.");
    return;
  }

  wall.innerHTML = items.map((item) => {
    const prayedCount = Number(item.prayed_count || 0);
    return `
      <article class="request-card wall-row">
        <div class="meta">
          <span class="pill">${escapeText(item.category)}</span>
          ${item.urgent ? '<span class="pill urgent">Urgent</span>' : ""}
          ${prayedCount === 0 ? '<span class="pill">Not prayed yet</span>' : `<span class="pill">${prayedCount} prayed</span>`}
          <span>${escapeText(item.name || "Anonymous")}</span>
          <span>${formatDate(item.created_at)}</span>
        </div>
        <p>${escapeText(item.prayer_request)}</p>
        <div class="actions">
          <button class="button primary" type="button" data-prayed-id="${item.id}">
            <i data-lucide="heart-handshake"></i>
            I prayed
          </button>
        </div>
      </article>
    `;
  }).join("");
  createIcons();
}

async function loadCategories() {
  try {
    const response = await fetch("/api/categories");
    const data = await response.json();
    if (!response.ok) throw new Error("Could not load categories.");

    data.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      wallCategory.append(option);
    });
  } catch {
    // Keep the default "All" option.
  }
}

async function loadWall() {
  wall.innerHTML = emptyState("Loading", "Please wait.");

  try {
    const params = new URLSearchParams({
      q: wallSearch.value.trim(),
      category: wallCategory.value,
      priority: wallPriority.value,
      sort: wallSort.value,
      page: String(wallPage),
      pageSize: String(WALL_PAGE_SIZE)
    });
    const response = await fetch(`/api/prayers?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load prayer wall.");
    renderWall(data.prayers || [], data);
  } catch (error) {
    wall.innerHTML = emptyState("Could not load requests", error.message);
  }
}

async function incrementPrayed(id, button) {
  button.disabled = true;
  button.textContent = "Prayed";

  try {
    const response = await fetch("/api/prayers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "prayed" })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not update prayer count.");

    const card = button.closest(".request-card");
    const countPill = [...card.querySelectorAll(".pill")].find((pill) => pill.textContent.includes("prayed"));
    if (countPill) countPill.textContent = `${data.prayedCount} prayed`;
  } catch (error) {
    button.disabled = false;
    button.textContent = "I prayed";
    wall.insertAdjacentHTML("afterbegin", emptyState("Could not update count", error.message));
  }
}

function resetAndLoadWall() {
  wallPage = 1;
  loadWall();
}

function scheduleWallSearch() {
  clearTimeout(wallSearchTimer);
  wallSearchTimer = setTimeout(resetAndLoadWall, 250);
}

document.querySelector("#refreshWall").addEventListener("click", loadWall);
wallSearch.addEventListener("input", scheduleWallSearch);
wallCategory.addEventListener("change", resetAndLoadWall);
wallPriority.addEventListener("change", resetAndLoadWall);
wallSort.addEventListener("change", resetAndLoadWall);
prevWallPage.addEventListener("click", () => {
  if (wallPage > 1) {
    wallPage -= 1;
    loadWall();
  }
});
nextWallPage.addEventListener("click", () => {
  if (wallPage < wallTotalPages) {
    wallPage += 1;
    loadWall();
  }
});
wall.addEventListener("click", (event) => {
  const button = event.target.closest("[data-prayed-id]");
  if (button) incrementPrayed(button.dataset.prayedId, button);
});

loadCategories();
loadWall();
