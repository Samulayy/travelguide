const EMBED_WIDTH = 640;
const EMBED_HEIGHT = 480;

function scaleEmbed() {
  const viewport = document.getElementById("embed-viewport");
  const scaleEl = document.getElementById("embed-scale");
  if (!viewport || !scaleEl) return;

  const { clientWidth: vw, clientHeight: vh } = viewport;
  const scale = Math.max(vw / EMBED_WIDTH, vh / EMBED_HEIGHT);

  scaleEl.style.transform = `scale(${scale})`;
}

scaleEmbed();
window.addEventListener("resize", scaleEmbed);
