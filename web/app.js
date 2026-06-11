// Client-side quasi-static simulation of the mechanical MNIST classifier.
// Mirrors mnist_mech/machine.py exactly: integer arithmetic only.

"use strict";

const W = MACHINE.weights;        // 10 x 49, values in {-2..2}
const BIAS = MACHINE.bias;        // 10 ints

// machine-wide lift: keeps every rod above its travel stop at the
// worst-case card (uniform across rods, so argmax is unchanged)
const LIFT = Math.max(0, ...W.map((row, k) =>
  16 * row.reduce((s, w) => s + (w < 0 ? -w : 0), 0) - BIAS[k]));

const MAX_HEIGHT = Math.max(...W.map((row, k) =>
  LIFT + BIAS[k] + 16 * row.reduce((s, w) => s + (w > 0 ? w : 0), 0)));

const card = new Uint8Array(784); // the punched card, row-major 28x28

// ---- the machine ----------------------------------------------------

function poolColumns() {           // 49 follower heights, 0..16
  const pooled = new Array(49).fill(0);
  for (let r = 0; r < 28; r++)
    for (let c = 0; c < 28; c++)
      if (card[r * 28 + c])
        pooled[Math.floor(r / 4) * 7 + Math.floor(c / 4)]++;
  return pooled;
}

function rodHeights(pooled) {      // 10 score rod heights
  return W.map((row, k) => {
    let h = LIFT + BIAS[k];
    for (let j = 0; j < 49; j++) h += row[j] * pooled[j];
    return h;
  });
}

function fallingBar(heights) {     // leftmost tallest rod wins
  let best = 0;
  for (let k = 1; k < 10; k++) if (heights[k] > heights[best]) best = k;
  return best;
}

// ---- rendering -------------------------------------------------------

const cardCanvas = document.getElementById("card");
const poolCanvas = document.getElementById("pool");
const rodsCanvas = document.getElementById("rods");
const CELL = cardCanvas.width / 28;
const PCELL = poolCanvas.width / 7;

function drawCard() {
  const g = cardCanvas.getContext("2d");
  g.fillStyle = "#d9c79a";                       // manila card stock
  g.fillRect(0, 0, cardCanvas.width, cardCanvas.height);
  g.fillStyle = "#cdbb8d";
  for (let i = 0; i <= 28; i += 4)               // pooling block ruling
    for (const [x, y, w, h] of [[i * CELL, 0, 1, 336], [0, i * CELL, 336, 1]])
      g.fillRect(x, y, w, h);
  g.fillStyle = "#11100d";
  for (let r = 0; r < 28; r++)
    for (let c = 0; c < 28; c++)
      if (card[r * 28 + c]) {
        g.beginPath();
        g.arc((c + 0.5) * CELL, (r + 0.5) * CELL, CELL * 0.38, 0, 7);
        g.fill();
      }
}

function drawPool(pooled) {
  const g = poolCanvas.getContext("2d");
  g.fillRect(0, 0, poolCanvas.width, poolCanvas.height);
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++) {
      const v = pooled[r * 7 + c];
      const x = c * PCELL, y = r * PCELL;
      g.fillStyle = "#11100d";
      g.fillRect(x, y, PCELL, PCELL);
      if (v) {                                   // the pin pile
        const pile = (PCELL - 10) * v / 16;
        g.fillStyle = "#c9a227";
        g.fillRect(x + 7, y + PCELL - 5 - pile, PCELL - 14, pile);
        g.fillStyle = "#e8e0d0";                 // the follower
        g.fillRect(x + 4, y + PCELL - 8 - pile, PCELL - 8, 3);
      }
      g.fillStyle = v ? "#e8e0d0" : "#564e3f";
      g.font = "11px Georgia";
      g.fillText(v, x + 4, y + 13);
    }
}

function drawRods(heights, winner) {
  const g = rodsCanvas.getContext("2d");
  const Wd = rodsCanvas.width, Hd = rodsCanvas.height;
  g.fillStyle = "#11100d";
  g.fillRect(0, 0, Wd, Hd);
  const slot = Wd / 10, top = 34, floor = Hd - 24;
  const scale = (floor - top) / MAX_HEIGHT;
  // the falling bar rests on the tallest rod
  const barY = floor - heights[winner] * scale;
  for (let k = 0; k < 10; k++) {
    const h = heights[k] * scale;
    const x = (k + 0.5) * slot;
    g.fillStyle = k === winner ? "#e2543a" : "#8a7119";
    g.fillRect(x - 5, floor - h, 10, h);
    g.fillStyle = k === winner ? "#e2543a" : "#9a907c";
    g.font = "14px Georgia";
    g.textAlign = "center";
    g.fillText(k, x, Hd - 7);
    g.fillStyle = "#564e3f";
    g.font = "10px Georgia";
    g.fillText(heights[k], x, floor - h - 4 < 12 ? 12 : floor - h - 4);
  }
  g.fillStyle = "#c9a227";                       // the bar itself
  g.fillRect(8, barY - 4, Wd - 16, 4);
  g.textAlign = "left";
}

function update() {
  const pooled = poolColumns();
  const heights = rodHeights(pooled);
  const winner = fallingBar(heights);
  drawCard();
  drawPool(pooled);
  drawRods(heights, winner);
  document.getElementById("prediction").textContent = winner;
}

// ---- interaction -----------------------------------------------------

let tool = 1; // 1 = punch, 0 = plug
const btnDraw = document.getElementById("btn-draw");
const btnErase = document.getElementById("btn-erase");

function setTool(t) {
  tool = t;
  btnDraw.classList.toggle("active", t === 1);
  btnErase.classList.toggle("active", t === 0);
}
btnDraw.onclick = () => setTool(1);
btnErase.onclick = () => setTool(0);

document.getElementById("btn-clear").onclick = () => {
  card.fill(0);
  document.getElementById("card-label").textContent = "";
  update();
};

let sampleCursor = -1;
function loadSample(step) {
  sampleCursor = (sampleCursor + step + SAMPLES.length) % SAMPLES.length;
  const s = SAMPLES[sampleCursor];
  for (let i = 0; i < 196; i++) {
    const v = parseInt(s.bits[i], 16);
    for (let b = 0; b < 4; b++) card[i * 4 + b] = (v >> (3 - b)) & 1;
  }
  document.getElementById("card-label").textContent =
    `MNIST test card #${s.index} (true digit ${s.label})`;
  update();
}
document.getElementById("btn-sample").onclick = () => loadSample(7); // varied digits

function punchAt(event) {
  const rect = cardCanvas.getBoundingClientRect();
  const cx = (event.clientX - rect.left) / rect.width * 28;
  const cy = (event.clientY - rect.top) / rect.height * 28;
  for (let r = Math.floor(cy - 1.5); r <= Math.ceil(cy + 1.5); r++)
    for (let c = Math.floor(cx - 1.5); c <= Math.ceil(cx + 1.5); c++) {
      if (r < 0 || r > 27 || c < 0 || c > 27) continue;
      const d = Math.hypot(c + 0.5 - cx, r + 0.5 - cy);
      if (d <= (tool ? 1.1 : 1.6)) card[r * 28 + c] = tool;
    }
  document.getElementById("card-label").textContent = "hand-punched card";
  update();
}

let punching = false;
cardCanvas.addEventListener("pointerdown", e => {
  punching = true;
  cardCanvas.setPointerCapture(e.pointerId);
  punchAt(e);
});
cardCanvas.addEventListener("pointermove", e => { if (punching) punchAt(e); });
cardCanvas.addEventListener("pointerup", () => { punching = false; });

// ---- boot ------------------------------------------------------------

document.getElementById("machine-stats").textContent =
  `Test accuracy ${(MACHINE.testAccuracy * 100).toFixed(2)}% with ` +
  `${MACHINE.nonzeroWeights}/490 couplers built.`;
loadSample(22); // start on a 7, like the first MNIST test card
