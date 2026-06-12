let googleIdToken = sessionStorage.getItem("adminGoogleIdToken") || "";

const adminNotice = document.querySelector("#adminNotice");
const adminPanel = document.querySelector("#adminPanel");
const adminList = document.querySelector("#adminList");
const adminCount = document.querySelector("#adminCount");
const googleSignIn = document.querySelector("#googleSignIn");
const logoutBtn = document.querySelector("#logoutBtn");

function setNotice(message, isError = false) {
  adminNotice.textContent = message;
  adminNotice.classList.toggle("error", isError);
}

async function loadConfig() {
  const response = await fetch("/api/config");
  const config = await response.json();
  if (!response.ok) throw new Error(config.error || "Missing auth config.");
  if (!config.googleClientId) throw new Error("Missing GOOGLE_CLIENT_ID.");
  return config;
}

function waitForGoogle() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        resolve();
      }
      if (tries > 80) {
        clearInterval(timer);
        reject(new Error("Google sign-in script did not load."));
      }
    }, 100);
  });
}

async function initAuth() {
  try {
    const config = await loadConfig();
    await waitForGoogle();

    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: handleGoogleCredential
    });

    window.google.accounts.id.renderButton(googleSignIn, {
      theme: "filled_black",
      size: "large",
      text: "signin_with",
      shape: "rectangular"
    });

    if (googleIdToken) {
      await loadAdminRequests();
      return;
    }

    showSignedOut();
  } catch (error) {
    adminPanel.hidden = true;
    googleSignIn.hidden = true;
    logoutBtn.hidden = true;
    setNotice(error.message, true);
  }
}

async function handleGoogleCredential(response) {
  googleIdToken = response.credential || "";
  sessionStorage.setItem("adminGoogleIdToken", googleIdToken);
  await loadAdminRequests();
}

function showSignedOut() {
  googleIdToken = "";
  sessionStorage.removeItem("adminGoogleIdToken");
  adminPanel.hidden = true;
  googleSignIn.hidden = false;
  logoutBtn.hidden = true;
  setNotice("Sign in with an allowed Google account to view prayer requests.");
}

function showSignedIn() {
  adminPanel.hidden = false;
  googleSignIn.hidden = true;
  logoutBtn.hidden = false;
  setNotice("Signed in with Google.");
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
        ${item.status === "prayed" ? '<span class="pill">Prayed</span>' : ""}
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
        <button class="button secondary" type="button" data-id="${item.id}" data-status="new">Reopen</button>
        <button class="button danger" type="button" data-id="${item.id}" data-status="archived">Archive</button>
      </div>
    </article>
  `).join("");
}

async function loadAdminRequests() {
  if (!googleIdToken) {
    showSignedOut();
    return;
  }

  adminList.innerHTML = emptyState("Loading", "Please wait.");

  try {
    const response = await fetch("/api/admin/prayers", {
      headers: { Authorization: `Bearer ${googleIdToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load admin requests.");

    showSignedIn();
    renderAdmin(data.prayers || []);
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
        Authorization: `Bearer ${googleIdToken}`,
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

logoutBtn.addEventListener("click", () => {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  showSignedOut();
});

document.querySelector("#refreshAdmin").addEventListener("click", loadAdminRequests);
adminList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id][data-status]");
  if (button) updateStatus(button.dataset.id, button.dataset.status);
});

initAuth();
