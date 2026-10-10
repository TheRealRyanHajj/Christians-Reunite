let signedIn = false;
let events = [];
let currentPage = 1;
let totalPages = 1;
let searchTimer = null;
const PAGE_SIZE = 50;

const $ = (selector) => document.querySelector(selector);
const adminAuth = $("#adminAuth");
const adminPanel = $("#adminPanel");
const loginForm = $("#adminLoginForm");
const loginNotice = $("#loginNotice");
const adminNotice = $("#adminNotice");
const adminList = $("#adminList");
const eventList = $("#eventAdminList");
const eventModal = $("#eventModal");

function notice(target, message, isError = false) {
  target.textContent = message;
  target.classList.toggle("error", isError);
}

async function request(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function showSignedOut(message = "") {
  signedIn = false;
  adminAuth.hidden = false;
  adminPanel.hidden = true;
  eventModal.hidden = true;
  notice(loginNotice, message, Boolean(message));
}

function showSignedIn() {
  signedIn = true;
  adminAuth.hidden = true;
  adminPanel.hidden = false;
  createIcons();
}

async function initAuth() {
  try {
    await request("/api/admin/session");
    showSignedIn();
    await Promise.all([loadEvents(), loadAdminRequests()]);
  } catch {
    showSignedOut();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  notice(loginNotice, "Signing in…");
  try {
    await request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("#adminEmail").value, password: $("#adminPassword").value })
    });
    $("#adminPassword").value = "";
    showSignedIn();
    await Promise.all([loadEvents(), loadAdminRequests()]);
  } catch (error) {
    notice(loginNotice, error.message, true);
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  try { await request("/api/admin/logout", { method: "POST" }); } catch {}
  showSignedOut();
});

function switchView(view) {
  const isEvents = view === "events";
  $("#eventsView").hidden = !isEvents;
  $("#prayersView").hidden = isEvents;
  $("#newEventBtn").hidden = !isEvents;
  $("#adminViewTitle").textContent = isEvents ? "Events" : "Prayer requests";
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

function eventDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function renderEvents() {
  const query = $("#eventSearch").value.trim().toLowerCase();
  const filtered = events.filter((item) => [item.title, item.summary, item.description, item.location].some((value) => String(value || "").toLowerCase().includes(query)));
  $("#publishedCount").textContent = events.filter((item) => item.status === "published").length;
  $("#draftCount").textContent = events.filter((item) => item.status === "draft").length;
  $("#upcomingCount").textContent = events.filter((item) => new Date(item.end_at || item.start_at) >= new Date()).length;
  if (!filtered.length) {
    eventList.innerHTML = emptyState(query ? "No matching events" : "No events yet", query ? "Try a different search." : "Create your first event to get started.");
    return;
  }
  eventList.innerHTML = filtered.map((item) => `
    <article class="admin-event-row">
      <div class="event-date-block"><strong>${new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(new Date(item.start_at))}</strong><span>${new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(item.start_at))}</span></div>
      <div class="admin-event-copy">
        <div class="meta"><span class="pill ${item.status === "draft" ? "neutral" : ""}">${escapeText(item.status)}</span>${item.featured ? '<span class="pill"><i data-lucide="star"></i> Featured</span>' : ""}</div>
        <h3>${escapeText(item.title)}</h3>
        <p>${escapeText(eventDate(item.start_at))}${item.location ? ` · ${escapeText(item.location)}` : ""}</p>
      </div>
      <div class="row-actions horizontal-actions">
        <button class="button secondary" type="button" data-edit-event="${item.id}"><i data-lucide="pencil"></i> Edit</button>
        <button class="icon-button danger-icon" type="button" data-delete-event="${item.id}" aria-label="Delete ${escapeText(item.title)}"><i data-lucide="trash-2"></i></button>
      </div>
    </article>`).join("");
  createIcons();
}

async function loadEvents() {
  try {
    const data = await request("/api/admin/events");
    events = data.events || [];
    renderEvents();
  } catch (error) {
    if (/not signed in/i.test(error.message)) return showSignedOut("Your session expired. Please sign in again.");
    eventList.innerHTML = emptyState("Could not load events", error.message);
  }
}

function openEventEditor(item = null) {
  $("#eventForm").reset();
  $("#eventId").value = item?.id || "";
  $("#eventEditorTitle").textContent = item ? "Edit event" : "Create event";
  $("#eventTitle").value = item?.title || "";
  $("#eventSummary").value = item?.summary || "";
  $("#eventDescription").value = item?.description || "";
  $("#eventStart").value = toLocalInput(item?.start_at);
  $("#eventEnd").value = toLocalInput(item?.end_at);
  $("#eventLocation").value = item?.location || "";
  $("#eventUrl").value = item?.registration_url || "";
  $("#eventFeatured").checked = Boolean(item?.featured);
  $("#eventStatus").value = item?.status || "draft";
  notice($("#eventFormNotice"), "");
  eventModal.hidden = false;
  document.body.classList.add("modal-open");
  $("#eventTitle").focus();
}

function closeEventEditor() {
  eventModal.hidden = true;
  document.body.classList.remove("modal-open");
}

$("#newEventBtn").addEventListener("click", () => openEventEditor());
document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeEventEditor));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !eventModal.hidden) closeEventEditor(); });
$("#eventSearch").addEventListener("input", renderEvents);

eventList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-event]");
  if (editButton) return openEventEditor(events.find((item) => item.id === editButton.dataset.editEvent));
  const deleteButton = event.target.closest("[data-delete-event]");
  if (!deleteButton) return;
  const item = events.find((entry) => entry.id === deleteButton.dataset.deleteEvent);
  if (!item || !window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
  try {
    await request("/api/admin/events", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    notice(adminNotice, "Event deleted.");
    await loadEvents();
  } catch (error) { notice(adminNotice, error.message, true); }
});

$("#eventForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#eventId").value;
  const body = {
    id: id || undefined,
    title: $("#eventTitle").value,
    summary: $("#eventSummary").value,
    description: $("#eventDescription").value,
    startAt: new Date($("#eventStart").value).toISOString(),
    endAt: $("#eventEnd").value ? new Date($("#eventEnd").value).toISOString() : null,
    location: $("#eventLocation").value,
    registrationUrl: $("#eventUrl").value,
    featured: $("#eventFeatured").checked,
    status: $("#eventStatus").value
  };
  const saveButton = $("#saveEventBtn");
  saveButton.disabled = true;
  notice($("#eventFormNotice"), "Saving…");
  try {
    await request("/api/admin/events", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    closeEventEditor();
    notice(adminNotice, id ? "Event updated." : "Event created.");
    await loadEvents();
  } catch (error) { notice($("#eventFormNotice"), error.message, true); }
  finally { saveButton.disabled = false; }
});

function renderPrayers(items, meta) {
  totalPages = meta.totalPages || 1;
  $("#adminCount").textContent = `${meta.total || 0} request${meta.total === 1 ? "" : "s"}`;
  $("#prayerNavCount").textContent = meta.total || 0;
  $("#pageInfo").textContent = `Page ${meta.page || 1} of ${totalPages}`;
  $("#prevPage").disabled = currentPage <= 1;
  $("#nextPage").disabled = currentPage >= totalPages;
  if (!items.length) { adminList.innerHTML = emptyState("No matching requests", "Adjust the filters to see more."); return; }
  adminList.innerHTML = items.map((item) => `
    <article class="request-card admin-row">
      <div class="admin-row-main"><div class="meta"><span class="pill">${escapeText(item.category)}</span>${item.urgent ? '<span class="pill urgent">Urgent</span>' : ""}${item.public_permission ? '<span class="pill">Wall OK</span>' : '<span class="pill neutral">Private</span>'}${item.wants_contact ? '<span class="pill">Contact</span>' : ""}<span>${formatDate(item.created_at)}</span></div><p>${escapeText(item.prayer_request)}</p><div class="detail compact-detail"><span><strong>Name:</strong> ${escapeText(item.name || "Anonymous")}</span><span><strong>Phone:</strong> ${escapeText(item.phone || "Not provided")}</span><span><strong>Status:</strong> ${escapeText(item.status)}</span></div></div>
      <div class="actions row-actions"><button class="button secondary" type="button" data-id="${item.id}" data-status="prayed">Mark prayed</button><button class="button secondary" type="button" data-id="${item.id}" data-status="new">Reopen</button><button class="button danger" type="button" data-id="${item.id}" data-status="archived">Archive</button></div>
    </article>`).join("");
}

async function loadAdminRequests() {
  if (!signedIn) return;
  adminList.innerHTML = emptyState("Loading", "Please wait.");
  try {
    const params = new URLSearchParams({ q: $("#searchInput").value.trim(), status: $("#statusFilter").value, priority: $("#priorityFilter").value, sort: $("#sortSelect").value, page: String(currentPage), pageSize: String(PAGE_SIZE) });
    const data = await request(`/api/admin/prayers?${params}`);
    renderPrayers(data.prayers || [], data);
  } catch (error) { adminList.innerHTML = emptyState("Could not load prayer requests", error.message); }
}

async function updateStatus(id, status) {
  try {
    await request("/api/admin/prayers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    notice(adminNotice, "Prayer request updated.");
    await loadAdminRequests();
  } catch (error) { notice(adminNotice, error.message, true); }
}

adminList.addEventListener("click", (event) => { const button = event.target.closest("[data-id][data-status]"); if (button) updateStatus(button.dataset.id, button.dataset.status); });
$("#searchInput").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { currentPage = 1; loadAdminRequests(); }, 250); });
[$("#statusFilter"), $("#priorityFilter"), $("#sortSelect")].forEach((input) => input.addEventListener("change", () => { currentPage = 1; loadAdminRequests(); }));
$("#prevPage").addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; loadAdminRequests(); } });
$("#nextPage").addEventListener("click", () => { if (currentPage < totalPages) { currentPage += 1; loadAdminRequests(); } });
$("#refreshAdmin").addEventListener("click", () => Promise.all([loadEvents(), loadAdminRequests()]));

initAuth();
