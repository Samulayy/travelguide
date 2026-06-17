const STEPS_BASE = "steps/";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLOR_DEFAULT = "#e94560";
const COLOR_QUICK = "#7c3aed";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

let map;
let steps = [];
let markers = {};
let routeLine;

const panelPlaceholder = document.getElementById("panel-placeholder");
const panelDetail = document.getElementById("panel-detail");
const stepList = document.getElementById("step-list");
const panelBack = document.getElementById("panel-back");
const detailDate = document.getElementById("detail-date");
const detailTitle = document.getElementById("detail-title");
const detailText = document.getElementById("detail-text");
const detailPhotos = document.getElementById("detail-photos");

async function loadSteps() {
  const response = await fetch(`${STEPS_BASE}index.json`);
  if (!response.ok) throw new Error("Impossible de charger steps/index.json");
  const files = await response.json();

  const loaded = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(`${STEPS_BASE}${file}`);
      if (!res.ok) throw new Error(`Impossible de charger ${file}`);
      return res.json();
    })
  );

  const chronological = loaded.sort((a, b) => new Date(a.date) - new Date(b.date));

  for (let i = 0; i < chronological.length; i++) {
    const step = chronological[i];
    step.dayNumber = i + 1;

    if (i > 0) {
      const prevDate = new Date(chronological[i - 1].date + "T12:00:00");
      const currDate = new Date(step.date + "T12:00:00");
      step.isQuickStep = currDate - prevDate < MS_PER_DAY;
    } else {
      step.isQuickStep = false;
    }

    if (step.lat != null && step.lng != null) {
      step.resolvedPlace = step.place;
    } else if (step.place) {
      const geo = await geocodePlace(step.place);
      step.lat = geo.lat;
      step.lng = geo.lng;
      step.resolvedPlace = geo.label;
    } else {
      throw new Error(`Étape "${step.id}" : champ "place" requis`);
    }

    step.displayTitle = `Jour ${step.dayNumber} — ${step.resolvedPlace || step.place}`;
  }

  return chronological;
}

async function geocodePlace(place) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?" +
    new URLSearchParams({ name: place, count: "1", language: "fr", format: "json" });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Géocodage échoué pour « ${place} »`);

  const data = await res.json();
  if (!data.results?.length) {
    throw new Error(`Lieu introuvable : « ${place} » (précisez ex. « Paris, France »)`);
  }

  const r = data.results[0];
  const parts = [r.name];
  if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
  if (r.country) parts.push(r.country);

  return { lat: r.latitude, lng: r.longitude, label: parts.join(", ") };
}

function getDisplaySteps() {
  return [...steps].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getLatestStep() {
  return steps[steps.length - 1];
}

function formatDate(isoDate) {
  return dateFormatter.format(new Date(isoDate + "T12:00:00"));
}

function renderParagraphs(text) {
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join("");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPhotos(photos) {
  if (!photos || photos.length === 0) return "";
  return photos
    .map(
      (photo) => `
        <figure class="photo">
          <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption || "")}" loading="lazy">
          ${photo.caption ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>` : ""}
        </figure>
      `
    )
    .join("");
}

function showStep(stepId, { panMap = true } = {}) {
  const step = steps.find((s) => s.id === stepId);
  if (!step) return;

  panelPlaceholder.classList.add("hidden");
  panelDetail.classList.remove("hidden");

  detailDate.textContent = formatDate(step.date);
  detailTitle.textContent = step.displayTitle;
  detailText.innerHTML = renderParagraphs(step.text);
  detailPhotos.innerHTML = renderPhotos(step.photos);

  document.querySelectorAll(".step-list-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === stepId);
  });

  Object.entries(markers).forEach(([id, marker]) => {
    const el = marker.getElement();
    if (!el) return;
    el.classList.toggle("marker-active", id === stepId);
  });

  if (panMap) {
    map.setView([step.lat, step.lng], Math.max(map.getZoom(), 6), { animate: true });
  }

  history.replaceState(null, "", `#${stepId}`);

  if (window.innerWidth < 768) {
    panelDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showList() {
  panelDetail.classList.add("hidden");
  panelPlaceholder.classList.remove("hidden");

  document.querySelectorAll(".step-list-item").forEach((el) => {
    el.classList.remove("active");
  });

  Object.values(markers).forEach((marker) => {
    marker.getElement()?.classList.remove("marker-active");
  });

  history.replaceState(null, "", " ");
}

function renderStepList() {
  stepList.innerHTML = getDisplaySteps()
    .map(
      (step) => `
        <li>
          <button class="step-list-item" type="button" data-id="${escapeHtml(step.id)}">
            <span class="step-list-date">${formatDate(step.date)}</span>
            <span class="step-list-title">${escapeHtml(step.displayTitle)}</span>
          </button>
        </li>
      `
    )
    .join("");

  stepList.querySelectorAll(".step-list-item").forEach((btn) => {
    btn.addEventListener("click", () => showStep(btn.dataset.id));
  });
}

function initMap() {
  const latest = getLatestStep();
  const initialCenter = latest ? [latest.lat, latest.lng] : [30, 10];
  const initialZoom = latest ? 6 : 2;

  map = L.map("map", { zoomControl: true }).setView(initialCenter, initialZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  const latLngs = [];

  steps.forEach((step) => {
    latLngs.push([step.lat, step.lng]);

    const fillColor = step.isQuickStep ? COLOR_QUICK : COLOR_DEFAULT;

    const marker = L.circleMarker([step.lat, step.lng], {
      radius: 8,
      fillColor,
      color: "#fff",
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindTooltip(step.displayTitle, { direction: "top", offset: [0, -8] });
    marker.on("click", () => showStep(step.id, { panMap: false }));

    const el = marker.getElement();
    if (el) {
      el.classList.add("step-marker");
      if (step.isQuickStep) el.classList.add("marker-quick");
      el.dataset.color = step.isQuickStep ? "quick" : "default";
    }

    markers[step.id] = marker;
  });

  if (latLngs.length > 1) {
    routeLine = L.polyline(latLngs, {
      color: COLOR_DEFAULT,
      weight: 2,
      opacity: 0.5,
      dashArray: "6 8",
    }).addTo(map);
  }
}

function handleInitialHash() {
  const hash = location.hash.slice(1);
  if (hash && steps.some((s) => s.id === hash)) {
    showStep(hash);
    return;
  }

  const latest = getLatestStep();
  if (latest) {
    map.setView([latest.lat, latest.lng], 6);
  }
}

panelBack.addEventListener("click", showList);

window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);
  if (hash && steps.some((s) => s.id === hash)) {
    showStep(hash, { panMap: false });
  } else {
    showList();
  }
});

loadSteps()
  .then((data) => {
    steps = data;
    renderStepList();
    initMap();
    handleInitialHash();
  })
  .catch((err) => {
    console.error(err);
    stepList.innerHTML = `<li class="error">Erreur de chargement : ${escapeHtml(err.message)}</li>`;
  });
