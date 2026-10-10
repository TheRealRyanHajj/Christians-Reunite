const eventsList = document.querySelector("#eventsList");

function eventDateParts(value) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(date),
    full: new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)
  };
}

function renderEvents(items) {
  if (!items.length) {
    eventsList.innerHTML = `<div class="events-empty"><i data-lucide="calendar-heart"></i><h3>More gatherings are on the way.</h3><p>There are no upcoming events posted right now. Check back soon.</p></div>`;
    createIcons();
    return;
  }
  eventsList.innerHTML = items.map((item) => {
    const date = eventDateParts(item.start_at);
    const end = item.end_at ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(item.end_at)) : "";
    return `<article class="event-card ${item.featured ? "featured" : ""}">
      <div class="event-calendar"><span>${escapeText(date.month)}</span><strong>${escapeText(date.day)}</strong></div>
      <div class="event-content">
        <div class="meta">${item.featured ? '<span class="pill"><i data-lucide="star"></i> Featured</span>' : ""}<span>${escapeText(date.full)}${end ? ` – ${escapeText(end)}` : ""}</span></div>
        <h3>${escapeText(item.title)}</h3>
        ${item.summary ? `<p class="event-summary">${escapeText(item.summary)}</p>` : ""}
        <p class="event-description">${escapeText(item.description)}</p>
        <div class="event-footer">${item.location ? `<span><i data-lucide="map-pin"></i>${escapeText(item.location)}</span>` : ""}${item.registration_url ? `<a class="button primary" href="${escapeText(item.registration_url)}" target="_blank" rel="noopener">Learn more <i data-lucide="arrow-up-right"></i></a>` : ""}</div>
      </div>
    </article>`;
  }).join("");
  createIcons();
}

async function loadEvents() {
  eventsList.innerHTML = emptyState("Loading events", "Please wait.");
  try {
    const response = await fetch("/api/events");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load events.");
    renderEvents(data.events || []);
  } catch (error) {
    eventsList.innerHTML = emptyState("Could not load events", error.message);
  }
}

document.querySelector("#refreshEvents").addEventListener("click", loadEvents);
loadEvents();
