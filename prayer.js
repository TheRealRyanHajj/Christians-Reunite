const DEFAULT_CATEGORIES = [
  "Addiction",
  "Family",
  "Finances",
  "Health",
  "Marriage",
  "Grief",
  "Guidance",
  "Salvation",
  "Community",
  "Other"
];

const form = document.querySelector("#prayerForm");
const statusEl = document.querySelector("#formStatus");
const nameInput = document.querySelector("#name");
const phoneInput = document.querySelector("#phone");
const wantsContact = document.querySelector("#wantsContact");
const contactRow = document.querySelector("#contactRow");
const categorySelect = document.querySelector("#category");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function fillCategories(categories = DEFAULT_CATEGORIES) {
  categorySelect.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });
}

function updateContactState() {
  const canContact = nameInput.value.trim() && phoneInput.value.trim();
  wantsContact.disabled = !canContact;
  contactRow.classList.toggle("disabled", !canContact);
  if (!canContact) wantsContact.checked = false;
}

async function loadCategories() {
  try {
    const response = await fetch("/api/categories");
    if (!response.ok) throw new Error("Could not load categories.");
    const data = await response.json();
    fillCategories(data.categories);
  } catch {
    fillCategories();
  }
}

async function submitPrayer(event) {
  event.preventDefault();
  setStatus("Submitting...");

  const payload = {
    name: nameInput.value.trim() || null,
    phone: phoneInput.value.trim() || null,
    wantsContact: wantsContact.checked,
    category: categorySelect.value,
    publicPermission: document.querySelector("#publicPermission").checked,
    prayerRequest: document.querySelector("#request").value.trim(),
    urgent: document.querySelector("#urgent").checked
  };

  try {
    const response = await fetch("/api/prayers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not submit prayer request.");

    form.reset();
    updateContactState();
    setStatus("Prayer request submitted. Thank you for trusting us to pray with you.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

nameInput.addEventListener("input", updateContactState);
phoneInput.addEventListener("input", updateContactState);
form.addEventListener("submit", submitPrayer);
fillCategories();
loadCategories();
updateContactState();
