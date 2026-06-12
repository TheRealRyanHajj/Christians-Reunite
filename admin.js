let supabaseClient = null;
let authRedirectUrl = "";

const adminNotice = document.querySelector("#adminNotice");
const adminPanel = document.querySelector("#adminPanel");
const adminList = document.querySelector("#adminList");
const adminCount = document.querySelector("#adminCount");
const loginBtn = document.querySelector("#loginBtn");
const logoutBtn = document.querySelector("#logoutBtn");

function setNotice(message, isError = false) {
  adminNotice.textContent = message;
  adminNotice.classList.toggle("error", isError);
}

async function initAuth() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "Missing auth config.");

    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    authRedirectUrl = config.authRedirectUrl || window.location.href.split("#")[0];
    supabaseClient.auth.onAuthStateChange(updateAuthUI);
    await updateAuthUI();
  } catch (error) {
    loginBtn.hidden = true;
    logoutBtn.hidden = true;
    adminPanel.hidden = true;
    setNotice(error.message, true);
  }
}

async function getToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token || "";
}

async function updateAuthUI() {
  if (!supabaseClient) return;

  const { data } = await supabaseClient.auth.getSession();
  const session = data.session;

  loginBtn.hidden = Boolean(session);
  logoutBtn.hidden = !session;

  if (!session) {
    adminPanel.hidden = true;
    setNotice("Sign in with Google to view prayer requests.");
    return;
  }

  adminPanel.hidden = false;
  setNotice(`Signed in as ${session.user.email}.`);
  await loadAdminRequests();
}

function renderAdmin(items) {
  adminCount.textContent = `${items.length} request${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    adminList.innerHTML = emptyState("No prayer requests", "New requests will appear here.");
    return;
  }

  adminList.innerHTML = items.map((item) => `
    <article class="request-card">
      <div class="meta">
        <span class="pill">${escapeText(item.category)}</span>
        ${item.urgent ? '<span class="pill urgent">Urgent</span>' : ""}
        ${item.public_permission ? '<span class="pill">Wall OK</span>' : '<span class="pill">Private</span>'}
        ${item.wants_contact ? '<span class="pill">Contact</span>' : ""}
        <span>${formatDate(item.created_at)}</span>
      </div>
      <p>${escapeText(item.prayer_request)}</p>
      <div class="detail">
        <span><strong>Name:</strong> ${escapeText(item.name || "Anonymous")}</span>
        <span><strong>Phone:</strong> ${escapeText(item.phone || "Not provided")}</span>
        <span><strong>Status:</strong> ${escapeText(item.status)}</span>
      </div>
      <div class="actions">
        <button class="button secondary" type="button" data-id="${item.id}" data-status="prayed">Mark Prayed</button>
        <button class="button danger" type="button" data-id="${item.id}" data-status="archived">Archive</button>
      </div>
    </article>
  `).join("");
}

async function loadAdminRequests() {
  adminList.innerHTML = emptyState("Loading", "Please wait.");

  try {
    const response = await fetch("/api/admin/prayers", {
      headers: { Authorization: `Bearer ${await getToken()}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load admin requests.");
    renderAdmin(data.prayers || []);
  } catch (error) {
    adminPanel.hidden = true;
    setNotice(error.message, true);
  }
}

async function updateStatus(id, status) {
  try {
    const response = await fetch("/api/admin/prayers", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
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

loginBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirectUrl }
  });
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await updateAuthUI();
});

document.querySelector("#refreshAdmin").addEventListener("click", loadAdminRequests);
adminList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id][data-status]");
  if (button) updateStatus(button.dataset.id, button.dataset.status);
});

initAuth();
