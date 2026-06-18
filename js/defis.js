const ICONS = {
  run: "🏃",
  camera: "📷",
  cuisine: "🍽",
  exploration: "🧭",
  culture: "🎭",
  water: "🤿",
  mountain: "⛰",
  bike: "🚴",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((values) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = (values[index] ?? "").trim();
    });
    return normalizeDefi(entry);
  });
}

function normalizeDefi(raw) {
  return {
    id: Number(raw.id),
    nom: raw.nom,
    categorie: raw.categorie,
    description: raw.description,
    dependance_id: Number(raw.dependance_id) || 0,
    points: Number(raw.points) || 0,
    valide: raw.valide === "true" || raw.valide === "1",
    icone: raw.icone,
    difficulte: Number(raw.difficulte) || 1,
  };
}

function isUnlocked(defi, allDefis) {
  if (!defi.dependance_id) return true;
  const parent = allDefis.find((d) => d.id === defi.dependance_id);
  return parent ? parent.valide : false;
}

function getIcon(icone) {
  return ICONS[icone] || icone.slice(0, 2).toUpperCase();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNode(defi, unlocked) {
  const classes = ["tree-node"];
  if (unlocked) classes.push("unlocked");
  if (defi.valide) classes.push("completed");

  const name = unlocked
    ? `<span class="tree-node-name">${escapeHtml(defi.nom)}</span>`
    : "";

  return `
    <div class="tree-node-wrap" title="${escapeHtml(defi.description)}">
      <div class="${classes.join(" ")}" aria-label="${escapeHtml(defi.nom)}">
        <span class="tree-node-icon">${getIcon(defi.icone)}</span>
      </div>
      ${name}
    </div>
  `;
}

function renderTier(defis, difficulty, allDefis) {
  const tierDefis = defis.filter((d) => d.difficulte === difficulty);
  if (!tierDefis.length) {
    return `<div class="tree-tier tree-tier-empty" data-difficulty="${difficulty}"></div>`;
  }

  const nodes = tierDefis.map((d) => renderNode(d, isUnlocked(d, allDefis))).join("");
  return `
    <div class="tree-tier" data-difficulty="${difficulty}">
      <span class="tree-tier-label">Niv. ${difficulty}</span>
      <div class="tree-tier-nodes">${nodes}</div>
    </div>
  `;
}

function renderTree(category, defis, allDefis) {
  const tiers = [1, 2, 3].map((n) => renderTier(defis, n, allDefis)).join("");
  return `
    <article class="tree">
      <h2 class="tree-title">${escapeHtml(category)}</h2>
      <div class="tree-body">${tiers}</div>
    </article>
  `;
}

function renderTrees(defis) {
  const byCategory = new Map();
  defis.forEach((defi) => {
    if (!byCategory.has(defi.categorie)) byCategory.set(defi.categorie, []);
    byCategory.get(defi.categorie).push(defi);
  });

  return [...byCategory.entries()]
    .map(([category, categoryDefis]) => renderTree(category, categoryDefis, defis))
    .join("");
}

async function loadDefisTrees(container) {
  const csvPath = container.dataset.defisCsv;
  if (!csvPath) {
    container.innerHTML = `<p class="trees-error">Fichier CSV non configuré.</p>`;
    return;
  }

  container.innerHTML = `<p class="trees-loading">Chargement des défis…</p>`;

  try {
    const response = await fetch(csvPath);
    if (!response.ok) throw new Error(`Impossible de charger ${csvPath}`);
    const text = await response.text();
    const defis = parseCsv(text);

    if (!defis.length) {
      container.innerHTML = `<p class="trees-empty">Aucun défi pour le moment.</p>`;
      return;
    }

    container.innerHTML = `<div class="trees">${renderTrees(defis)}</div>`;
  } catch (err) {
    container.innerHTML = `<p class="trees-error">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-defis-csv]").forEach(loadDefisTrees);
});
