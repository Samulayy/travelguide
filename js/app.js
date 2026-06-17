const STEPS_BASE = "steps/";
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

  return loaded.sort((a, b) => new Date(a.date) - new Date(b.date));
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
  detailTitle.textContent = step.title;
  detailText.innerHTML = renderParagraphs(step.text);
  detailPhotos.innerHTML = renderPhotos(step.photos);

  document.querySelectorAll(".step-list-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === stepId);
  });

  Object.entries(markers).forEach(([id, marker]) => {
    marker.getElement()?.classList.toggle("marker-active", id === stepId);
  });

  if (panMap) {
    map.setView([step.lat, step.lng], Math.max(map.getZoom(), 5), { animate: true });
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
  stepList.innerHTML = steps
    .map(
      (step) => `
        <li>
          <button class="step-list-item" type="button" data-id="${escapeHtml(step.id)}">
            <span class="step-list-date">${formatDate(step.date)}</span>
            <span class="step-list-title">${escapeHtml(step.title)}</span>
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
  map = L.map("map", { zoomControl: true }).setView([30, 10], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  const latLngs = [];

  steps.forEach((step, index) => {
    latLngs.push([step.lat, step.lng]);

    const marker = L.circleMarker([step.lat, step.lng], {
      radius: 8,
      fillColor: "#e94560",
      color: "#fff",
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindTooltip(step.title, { direction: "top", offset: [0, -8] });
    marker.on("click", () => showStep(step.id, { panMap: false }));

    const el = marker.getElement();
    if (el) {
      el.classList.add("step-marker");
      el.dataset.index = index + 1;
    }

    markers[step.id] = marker;
  });

  if (latLngs.length > 1) {
    routeLine = L.polyline(latLngs, {
      color: "#e94560",
      weight: 2,
      opacity: 0.5,
      dashArray: "6 8",
    }).addTo(map);
  }

  if (latLngs.length > 0) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 6 });
  }
}

function handleInitialHash() {
  const hash = location.hash.slice(1);
  if (hash && steps.some((s) => s.id === hash)) {
    showStep(hash);
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
