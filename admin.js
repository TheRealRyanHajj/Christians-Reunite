
let signedIn = false;

const adminNotice = document.querySelector("#adminNotice");
const adminPanel = document.querySelector("#adminPanel");
const adminList = document.querySelector("#adminList");
const adminCount = document.querySelector("#adminCount");
const loginForm = document.querySelector("#adminLoginForm");
const logoutBtn = document.querySelector("#logoutBtn");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const priorityFilter = document.querySelector("#priorityFilter");
const sortSelect = document.querySelector("#sortSelect");
const pageInfo = document.querySelector("#pageInfo");
const prevPage = document.querySelector("#prevPage");
const nextPage = document.querySelector("#nextPage");

const PAGE_SIZE = 50;
let currentPage = 1;
let totalPages = 1;
let searchTimer = null;

function setNotice(message, isError = false) {
  adminNotice.textContent = message;
  adminNotice.classList.toggle("error", isError);
}

async function initAuth() {
  try {
    const response = await fetch('/api/admin/session');
    signedIn = response.ok;
    if (signedIn) await loadAdminRequests(); else showSignedOut();
  } catch (error) { showSignedOut(); setNotice(error.message, true); }
}

function showSignedOut() {
  signedIn = false;
  adminPanel.hidden = true;
  loginForm.hidden = false;
  logoutBtn.hidden = true;
  setNotice('Sign in to manage prayer requests.');
}

function showSignedIn() {
  signedIn = true;
  adminPanel.hidden = false;
  loginForm.hidden = true;
  logoutBtn.hidden = false;
  setNotice('Signed in.');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: document.querySelector('#adminEmail').value, password: document.querySelector('#adminPassword').value})
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Could not sign in.');
    document.querySelector('#adminPassword').value = '';
    signedIn = true; await loadAdminRequests();
  } catch(error) { setNotice(error.message, true); }
});

function renderAdmin(items, meta) {
  totalPages = meta.totalPages || 1;
  adminCount.textContent = `${meta.total || 0} request${meta.total === 1 ? "" : "s"}`;
  pageInfo.textContent = `Page ${meta.page || 1} of ${totalPages}`;
  prevPage.disabled = currentPage <= 1;
  nextPage.disabled = currentPage >= totalPages;

  if (!items.length) {
    adminList.innerHTML = emptyState("No matching requests", "Adjust search or filters.");
    return;
  }

  adminList.innerHTML = items.map((item) => `
    <article class="request-card admin-row">
      <div class="admin-row-main">
        <div class="meta">
          <span class="pill">${escapeText(item.category)}</span>
          ${item.urgent ? '<span class="pill urgent">Urgent</span>' : ""}
          ${item.public_permission ? '<span class="pill">Wall OK</span>' : '<span class="pill">Private</span>'}
          ${item.wants_contact ? '<span class="pill">Contact</span>' : ""}
          ${item.status === "prayed" ? '<span class="pill">Prayed</span>' : ""}
          <span>${formatDate(item.created_at)}</span>
        </div>
        <p>${escapeText(item.prayer_request)}</p>
        <div class="detail compact-detail">
          <span><strong>Name:</strong> ${escapeText(item.name || "Anonymous")}</span>
          <span><strong>Phone:</strong> ${escapeText(item.phone || "Not provided")}</span>
          <span><strong>Status:</strong> ${escapeText(item.status)}</span>
        </div>
      </div>
      <div class="actions row-actions">
        <button class="button secondary" type="button" data-id="${item.id}" data-status="prayed">Mark Prayed</button>
        <button class="button secondary" type="button" data-id="${item.id}" data-status="new">Reopen</button>
        <button class="button danger" type="button" data-id="${item.id}" data-status="archived">Archive</button>
      </div>
    </article>
  `).join("");
}

async function loadAdminRequests() {
  if (!signedIn) {
    showSignedOut();
    return;
  }

  adminList.innerHTML = emptyState("Loading", "Please wait.");

  try {
    const params = new URLSearchParams({
      q: searchInput.value.trim(),
      status: statusFilter.value,
      priority: priorityFilter.value,
      sort: sortSelect.value,
      page: String(currentPage),
      pageSize: String(PAGE_SIZE)
    });
    const response = await fetch(`/api/admin/prayers?${params}`, {
      credentials: "same-origin"
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load admin requests.");

    showSignedIn();
    renderAdmin(data.prayers || [], data);
  } catch (error) {
    showSignedOut();
    setNotice(error.message, true);
  }
}

async function updateStatus(id, status) {
  try {
    const response = await fetch("/api/admin/prayers", {
      method: "PATCH",
      headers: {
                "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, status })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not update request.");
    await loadAdminRequests();
  } catch (error) {
    setNotice(error.message, true);
  }
}

function resetAndLoad() {
  currentPage = 1;
  loadAdminRequests();
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(resetAndLoad, 250);
}

logoutBtn.addEventListener("click", async () => {
  try { await fetch('/api/admin/logout', {method: 'POST'}); } finally { showSignedOut(); }
});

document.querySelector("#refreshAdmin").addEventListener("click", loadAdminRequests);
searchInput.addEventListener("input", scheduleSearch);
statusFilter.addEventListener("change", resetAndLoad);
priorityFilter.addEventListener("change", resetAndLoad);
sortSelect.addEventListener("change", resetAndLoad);
prevPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadAdminRequests();
  }
});
nextPage.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage += 1;
    loadAdminRequests();
  }
});
adminList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id][data-status]");
  if (button) updateStatus(button.dataset.id, button.dataset.status);
});

initAuth();
