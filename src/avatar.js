// ============================================================
//  MISSIONE GRAMMATICA — Il drago: disegno SVG e oggetti sbloccabili
// ============================================================
"use strict";

const DRAGON_COLORS = {
  verde:     { main: "#4CC38A", dark: "#2E9E6A", belly: "#FCEFB4" },
  blu:       { main: "#4A9EF0", dark: "#2F78C4", belly: "#D8EEFF" },
  rosso:     { main: "#EF5B5B", dark: "#C23A3A", belly: "#FFE0C2" },
  viola:     { main: "#9A6CF0", dark: "#6E44C9", belly: "#F1E6FF" },
  ossidiana: { main: "#46445A", dark: "#26252F", belly: "#B9B5D6" },
  oro:       { main: "#F2B830", dark: "#C98F0E", belly: "#FFF5CC" },
  argento:   { main: "#B8C2D6", dark: "#7E8AA3", belly: "#F2F5FA" },
  ghiaccio:  { main: "#8FD3FF", dark: "#3E9BD6", belly: "#EAF8FF" },
  smeraldo:  { main: "#1FB57A", dark: "#0F7A52", belly: "#D9F7EA" },
};

// slot → elenco oggetti {id, name, lv}
const AVATAR_CATALOG = [
  { slot: "color", label: "Colore", items: [
    { id: "verde", name: "Verde bosco", lv: 1 }, { id: "blu", name: "Blu oceano", lv: 2 },
    { id: "rosso", name: "Rosso fuoco", lv: 4 }, { id: "viola", name: "Viola magico", lv: 6 },
    { id: "ossidiana", name: "Ossidiana", lv: 8 }, { id: "oro", name: "Oro leggendario", lv: 11 },
    { id: "argento", name: "Argento lunare", streak: 14 }, { id: "smeraldo", name: "Smeraldo del campione", trophy: 3 } ] },
  { slot: "wings", label: "Ali", dragon: true, items: [
    { id: "small", name: "Alette", lv: 1 }, { id: "big", name: "Ali da volo", lv: 4 }, { id: "fire", name: "Ali di fuoco", lv: 7 } ] },
  { slot: "horns", label: "Corna", dragon: true, items: [
    { id: "none", name: "Niente", lv: 1 }, { id: "short", name: "Cornetti", lv: 3 },
    { id: "curved", name: "Corna ricurve", lv: 5 }, { id: "crystal", name: "Corna di cristallo", lv: 9 } ] },
  { slot: "crest", label: "Cresta", dragon: true, items: [
    { id: "none", name: "Niente", lv: 1 }, { id: "spikes", name: "Spuntoni", lv: 2 }, { id: "royal", name: "Cresta reale", lv: 6 } ] },
  { slot: "tail", label: "Coda", dragon: true, items: [
    { id: "arrow", name: "Punta a freccia", lv: 1 }, { id: "flame", name: "Coda fiammeggiante", lv: 5 } ] },
  { slot: "face", label: "Viso", items: [
    { id: "none", name: "Niente", lv: 1 }, { id: "glasses", name: "Occhiali da studioso", lv: 3 }, { id: "mask", name: "Maschera da eroe", lv: 8 } ] },
  { slot: "neck", label: "Collo", items: [
    { id: "none", name: "Niente", lv: 1 }, { id: "scarf", name: "Sciarpa", lv: 4 }, { id: "medal", name: "Medaglia d'oro", lv: 9 } ] },
  { slot: "head", label: "Testa", items: [
    { id: "none", name: "Niente", lv: 1 }, { id: "wizard", name: "Cappello da mago", lv: 7 }, { id: "crown", name: "Corona", lv: 10 } ] },
  { slot: "aura", label: "Aura", items: [
    { id: "none", name: "Niente", lv: 1 }, { id: "stars", name: "Stelline", lv: 4 },
    { id: "flames", name: "Fiamme", lv: 8 }, { id: "rainbow", name: "Arcobaleno", lv: 12 },
    { id: "aurora", name: "Aurora boreale", streak: 7 }, { id: "galaxy", name: "Galassia", streak: 30 }, { id: "lightning", name: "Fulmini del duellante", trophy: 1 } ] },
];
const AVATAR_DEFAULT = { color: "verde", wings: "small", horns: "none", crest: "none", tail: "arrow", face: "none", neck: "none", head: "none", aura: "none", name: "", seenLevel: 1 };

function unlockedAt(level) {   // oggetti che si sbloccano esattamente a quel livello
  const out = [];
  AVATAR_CATALOG.forEach(c => c.items.forEach(i => { if (i.lv === level) out.push({ ...i, slot: c.slot, label: c.label }); }));
  return out;
}
function nextUnlock(level) {
  let best = null;
  AVATAR_CATALOG.forEach(c => c.items.forEach(i => { if (i.lv > level && (!best || i.lv < best.lv)) best = { ...i, label: c.label }; }));
  return best;
}
function newSince(seen, level) { const out = []; for (let l = seen + 1; l <= level; l++) out.push(...unlockedAt(l)); return out; }

// ---------------- evoluzione ----------------
const STAGE_XP = [0, 100, 300, 650, 1200, 2000, 3200];
const LINES = {
  fuoco: { name: "Linea del Fuoco", icon: "🔥", mult: 1,
    names: ["Uovo misterioso", "Lucertola", "Iguana", "Coccodrillo", "Draghetto", "Drago", "Drago delle Parole"] },
  ghiaccio: { name: "Linea del Ghiaccio", icon: "❄️", mult: 4, palette: "ghiaccio",
    names: ["Uovo di ghiaccio", "Axolotl delle nevi", "Tritone di ghiaccio", "Serpente marino", "Cucciolo di drago d'acqua", "Leviatano dei ghiacci", "Drago dell'Inverno"] },
};
const LINE_ORDER = ["fuoco", "ghiaccio"];
const nextLine = l => LINE_ORDER[LINE_ORDER.indexOf(l) + 1] || null;
function stagesOf(line) { const L = LINES[line] || LINES.fuoco; return STAGE_XP.map((x, i) => ({ xp: x * L.mult, n: L.names[i] })); }
const STAGES = stagesOf("fuoco");
const DRAGON_FROM = 4, FINAL_STAGE = STAGE_XP.length - 1;
function stageOf(xp, line) { let s = 0; stagesOf(line).forEach((st, i) => { if (xp >= st.xp) s = i; }); return s; }

// ---------------- disegno ----------------
const mirror = s => `<g transform="translate(200,0) scale(-1,1)">${s}</g>`;
const both = s => s + mirror(s);
function star(cx, cy, r, fill) {
  let p = ""; for (let i = 0; i < 10; i++) { const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; p += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `; }
  return `<polygon points="${p}" fill="${fill}"/>`;
}

// ---------- geometria: curve "affusolate" per code e colli ----------
function bez(P, t) {
  const u = 1 - t;
  return [u*u*u*P[0][0] + 3*u*u*t*P[1][0] + 3*u*t*t*P[2][0] + t*t*t*P[3][0],
          u*u*u*P[0][1] + 3*u*u*t*P[1][1] + 3*u*t*t*P[2][1] + t*t*t*P[3][1]];
}
function bezN(P, t) {   // normale unitaria (rivolta verso l'alto, y negativa)
  const u = 1 - t;
  const dx = 3*u*u*(P[1][0]-P[0][0]) + 6*u*t*(P[2][0]-P[1][0]) + 3*t*t*(P[3][0]-P[2][0]);
  const dy = 3*u*u*(P[1][1]-P[0][1]) + 6*u*t*(P[2][1]-P[1][1]) + 3*t*t*(P[3][1]-P[2][1]);
  const l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l;
  if (ny > 0) { nx = -nx; ny = -ny; }
  return [nx, ny, Math.atan2(dy, dx) * 180 / Math.PI];
}
function taper(P, w0, w1, fill, extra = "") {
  const L = [], R = [], n = 30;
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = bez(P, t), [nx, ny] = bezN(P, t), w = (w0 + (w1 - w0) * t) / 2;
    L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
  }
  const pts = L.concat(R.reverse()).map(p => p[0].toFixed(1) + " " + p[1].toFixed(1));
  return `<path d="M${pts.join(" L")} Z" fill="${fill}" stroke-linejoin="round" ${extra}/>`;
}
const leg = (x1, y1, x2, y2, w, c, claws) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>` +
  (claws ? `<path d="M${x2} ${y2} l6 1 M${x2} ${y2} l5 4 M${x2} ${y2} l1 5" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>` : "");
const tri = (x, y, nx, ny, h, w, c) => { const tx = -ny, ty = nx;
  return `<path d="M${(x - tx * w).toFixed(1)} ${(y - ty * w).toFixed(1)} L${(x + nx * h).toFixed(1)} ${(y + ny * h).toFixed(1)} L${(x + tx * w).toFixed(1)} ${(y + ty * w).toFixed(1)} Z" fill="${c}"/>`; };
const sideEye = (e, extra = "") => `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="#fff" ${extra}/><circle cx="${e.x + e.r * 0.3}" cy="${e.y + e.r * 0.1}" r="${e.r * 0.62}" fill="#2B2340"/><circle cx="${e.x + e.r * 0.55}" cy="${e.y - e.r * 0.3}" r="${e.r * 0.25}" fill="#fff"/>`;

// ---------- creature di profilo: ognuna restituisce i pezzi e i punti di aggancio ----------
function sideLizard(C) {
  const tail = [[66, 146], [40, 150], [22, 160], [10, 140]];
  return {
    far: leg(80, 150, 74, 166, 6, C.dark, 1) + leg(112, 150, 120, 166, 6, C.dark, 1),
    tail: taper(tail, 13, 2, C.main),
    body: `<ellipse cx="92" cy="146" rx="32" ry="12" fill="${C.main}"/><ellipse cx="94" cy="152" rx="24" ry="5" fill="${C.belly}"/>` +
      `<circle cx="80" cy="140" r="2.6" fill="${C.dark}" opacity=".55"/><circle cx="95" cy="137" r="3" fill="${C.dark}" opacity=".55"/><circle cx="108" cy="140" r="2.4" fill="${C.dark}" opacity=".55"/>`,
    near: leg(78, 152, 66, 168, 7, C.main, 1) + leg(110, 152, 122, 168, 7, C.main, 1),
    head: `<ellipse cx="130" cy="140" rx="17" ry="11" fill="${C.main}"/><ellipse cx="143" cy="143" rx="11" ry="7" fill="${C.main}"/>` +
      `<path d="M136 147 Q146 149 153 144" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="151" cy="140" r="1.3" fill="${C.dark}"/>`,
    eye: { x: 134, y: 136, r: 4.2 }, top: { x: 131, y: 130, s: 0.42, rot: 0 }, neck: { x: 116, y: 144, h: 22, rot: 0 }, chest: { x: 112, y: 152 },
  };
}
function sideIguana(C) {
  const tail = [[58, 140], [30, 148], [16, 168], [2, 150]];
  let bands = ""; for (let t = 0.2; t < 0.9; t += 0.15) { const [x, y] = bez(tail, t), [nx, ny] = bezN(tail, t), w = (15 - 12 * t) / 2;
    bands += `<path d="M${(x + nx * w).toFixed(1)} ${(y + ny * w).toFixed(1)} L${(x - nx * w).toFixed(1)} ${(y - ny * w).toFixed(1)}" stroke="${C.dark}" stroke-width="3"/>`; }
  let spines = ""; for (let x = 62; x <= 134; x += 8) { const dx = (x - 92) / 38; if (Math.abs(dx) >= 1) continue;
    const y = 140 - 17 * Math.sqrt(1 - dx * dx); spines += tri(x, y + 2, 0, -1, 6 + (x - 62) / 10, 3.5, C.dark); }
  return {
    far: leg(78, 146, 72, 166, 8, C.dark, 1) + leg(114, 146, 122, 166, 8, C.dark, 1),
    tail: taper(tail, 16, 3, C.main) + bands,
    body: spines + `<ellipse cx="92" cy="140" rx="38" ry="17" fill="${C.main}"/><ellipse cx="94" cy="149" rx="28" ry="7" fill="${C.belly}"/>`,
    near: leg(76, 150, 64, 170, 9, C.main, 1) + leg(112, 150, 126, 170, 9, C.main, 1),
    head: tri(128, 120, 0, -1, 10, 4, C.dark) + tri(138, 118, 0, -1, 9, 4, C.dark) +
      `<path d="M128 146 Q130 172 148 148 Z" fill="${C.main}" stroke="${C.dark}" stroke-width="2"/>` +
      `<path d="M116 132 Q128 116 150 120 Q164 124 163 136 Q160 148 142 149 Q124 150 116 142 Z" fill="${C.main}"/>` +
      `<circle cx="128" cy="139" r="5.5" fill="${C.belly}" stroke="${C.dark}" stroke-width="1.5"/>` +
      `<path d="M142 144 Q152 145 161 140" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="159" cy="132" r="1.4" fill="${C.dark}"/>`,
    eye: { x: 142, y: 129, r: 4.6 }, top: { x: 140, y: 122, s: 0.5, rot: 0 }, neck: { x: 120, y: 140, h: 26, rot: 0 }, chest: { x: 118, y: 152 },
  };
}
function sideCroc(C) {
  const tail = [[50, 148], [24, 150], [8, 160], [-4, 138]];
  let scutes = ""; for (let t = 0.08; t < 0.95; t += 0.1) { const [x, y] = bez(tail, t), [nx, ny] = bezN(tail, t), w = (22 - 18 * t) / 2;
    scutes += tri(x + nx * w, y + ny * w, nx, ny, 6 - 3 * t, 3, C.dark); }
  let ridges = ""; for (let x = 54; x <= 128; x += 9) { const dx = (x - 90) / 44; if (Math.abs(dx) >= 1) continue;
    const y = 150 - 16 * Math.sqrt(1 - dx * dx); ridges += `<ellipse cx="${x}" cy="${y + 1}" rx="4" ry="3" fill="${C.dark}"/>`; }
  let teeth = ""; for (let x = 146; x <= 186; x += 6) teeth += `<path d="M${x} 149 L${x + 3} 155 L${x + 6} 149" fill="#fff"/>`;
  return {
    far: leg(66, 154, 60, 170, 9, C.dark, 1) + leg(112, 154, 120, 170, 9, C.dark, 1),
    tail: taper(tail, 22, 4, C.main) + scutes,
    body: ridges + `<ellipse cx="90" cy="150" rx="44" ry="16" fill="${C.main}"/><ellipse cx="92" cy="159" rx="36" ry="6" fill="${C.belly}"/>` +
      [70, 84, 98, 112].map(x => `<path d="M${x} 154 L${x} 164" stroke="${C.main}" stroke-width="1.5" opacity=".5"/>`).join(""),
    near: leg(64, 158, 52, 172, 10, C.main, 1) + leg(110, 158, 124, 172, 10, C.main, 1),
    head: `<ellipse cx="136" cy="147" rx="17" ry="12" fill="${C.main}"/>` +
      `<path d="M136 137 L188 140 Q198 142 197 148 Q196 155 188 155 L136 158 Z" fill="${C.main}"/>` + teeth +
      `<path d="M140 150 L194 149" stroke="${C.dark}" stroke-width="2"/>` +
      `<circle cx="141" cy="134" r="8" fill="${C.main}"/><circle cx="191" cy="139" r="3.5" fill="${C.main}"/><circle cx="192" cy="139" r="1.3" fill="${C.dark}"/>`,
    eye: { x: 142, y: 133, r: 4.6 }, top: { x: 138, y: 128, s: 0.45, rot: 0 }, neck: { x: 122, y: 148, h: 28, rot: 0 }, chest: { x: 122, y: 160 },
  };
}
function sideDragon(C) {      // Drago: in piedi su quattro zampe, collo lungo
  const tail = [[62, 140], [30, 150], [14, 172], [-2, 150]];
  const neck = [[114, 132], [132, 116], [124, 92], [142, 76]];
  const t = bez(tail, 1), tn = bezN(tail, 1);
  const crest = [];
  for (let k = 0.1; k <= 0.9; k += 0.2) { const [x, y] = bez(neck, k), [nx, ny] = bezN(neck, k), w = (22 - 8 * k) / 2; crest.push([x + nx * w, y + ny * w, nx, ny, 7]); }
  for (let x = 70; x <= 108; x += 9) { const dx = (x - 92) / 36; crest.push([x, 138 - 22 * Math.sqrt(1 - dx * dx), 0, -1, 7]); }
  return {
    far: leg(80, 150, 76, 172, 11, C.dark, 1) + leg(110, 150, 114, 172, 10, C.dark, 1),
    tail: taper(tail, 18, 3, C.main),
    body: `<ellipse cx="92" cy="138" rx="36" ry="22" fill="${C.main}"/><ellipse cx="96" cy="149" rx="26" ry="10" fill="${C.belly}"/>` +
      taper(neck, 22, 15, C.main) + taper([[118, 136], [134, 120], [128, 96], [146, 82]], 9, 6, C.belly),
    near: `<circle cx="74" cy="144" r="15" fill="${C.main}"/>` + leg(72, 152, 66, 172, 12, C.main, 1) + leg(114, 146, 122, 172, 11, C.main, 1),
    head: `<ellipse cx="150" cy="72" rx="18" ry="14" fill="${C.main}"/><ellipse cx="168" cy="78" rx="14" ry="9" fill="${C.main}"/>` +
      `<path d="M156 84 Q168 86 180 80" stroke="${C.dark}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="177" cy="74" r="1.6" fill="${C.dark}"/>`,
    eye: { x: 153, y: 68, r: 5 }, top: { x: 148, y: 60, s: 0.5, rot: -8 }, neck: { x: 130, y: 102, h: 22, rot: -25 }, chest: { x: 126, y: 122 },
    shoulder: { x: 104, y: 122, s: 1 }, hornBase: { x: 142, y: 62, s: 1 }, tailTip: { x: t[0], y: t[1], rot: tn[2] }, crest, royal: { x: 150, y: 58, s: 0.8, rot: -8 },
  };
}
function sideWordDragon(C) {  // Drago delle Parole: ritto sulle zampe, ali spiegate, libro tra le zampe
  const tail = [[86, 162], [50, 178], [20, 176], [8, 150]];
  const neck = [[110, 92], [116, 74], [112, 60], [126, 46]];
  const t = bez(tail, 1), tn = bezN(tail, 1);
  const crest = [];
  for (let k = 0.1; k <= 0.95; k += 0.2) { const [x, y] = bez(neck, k), [nx, ny] = bezN(neck, k), w = (22 - 8 * k) / 2; crest.push([x - Math.abs(nx) * w, y + ny * w * 0.3, -1, -0.2, 7]); }
  return {
    far: leg(110, 150, 120, 176, 11, C.dark, 1),
    tail: taper(tail, 20, 3, C.main),
    body: `<ellipse cx="100" cy="122" rx="26" ry="40" fill="${C.main}" transform="rotate(12 100 122)"/>` +
      `<ellipse cx="108" cy="124" rx="14" ry="30" fill="${C.belly}" transform="rotate(12 108 124)"/>` +
      [0, 1, 2, 3, 4].map(i => `<path d="M${96 + i * 2} ${104 + i * 11} q10 3 18 1" stroke="${C.main}" stroke-width="1.6" fill="none" opacity=".45"/>`).join("") +
      taper(neck, 22, 16, C.main) + taper([[114, 98], [122, 78], [118, 64], [130, 52]], 9, 6, C.belly),
    near: `<circle cx="92" cy="150" r="17" fill="${C.main}"/>` + leg(92, 160, 88, 178, 12, C.main, 1) +
      // libro aperto tra le zampe anteriori
      `<g transform="rotate(-8 136 116)"><path d="M118 108 L136 112 L154 108 L154 132 L136 136 L118 132 Z" fill="#FFF8E7" stroke="#C98F0E" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M136 112 L136 136" stroke="#C98F0E" stroke-width="2"/>` +
      [0, 1, 2, 3].map(i => `<path d="M122 ${115 + i * 4.5} l10 1.5 M140 ${116.5 + i * 4.5} l10 -1.5" stroke="#B9AE95" stroke-width="1.4"/>`).join("") + `</g>` +
      leg(116, 104, 124, 116, 8, C.main) + leg(120, 112, 146, 120, 8, C.main),
    head: `<ellipse cx="132" cy="42" rx="17" ry="13" fill="${C.main}"/><ellipse cx="149" cy="48" rx="13" ry="8.5" fill="${C.main}"/>` +
      `<path d="M138 54 Q150 56 161 50" stroke="${C.dark}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="158" cy="44" r="1.6" fill="${C.dark}"/>`,
    eye: { x: 135, y: 38, r: 5 }, top: { x: 130, y: 30, s: 0.5, rot: -8 }, neck: { x: 113, y: 74, h: 22, rot: -75 }, chest: { x: 110, y: 96 },
    shoulder: { x: 96, y: 98, s: 1.35 }, hornBase: { x: 124, y: 32, s: 1 }, tailTip: { x: t[0], y: t[1], rot: tn[2] }, crest, royal: { x: 132, y: 28, s: 0.8, rot: -8 },
  };
}

// ---------- oggetti dei draghi visti di profilo ----------
const WING = {
  small: "M0 0 Q-6 -26 -28 -34 Q-22 -22 -30 -14 Q-16 -12 -16 2 Z",
  big: "M0 0 Q-2 -48 -18 -72 Q-26 -52 -44 -50 Q-38 -38 -58 -32 Q-44 -22 -54 -10 Q-32 -10 -16 6 Z",
};
function sideWing(av, C, a, far, uid) {
  const path = av.wings === "small" ? WING.small : WING.big;
  const fill = av.wings === "fire" ? `url(#fire-${uid})` : far ? C.dark : C.main;
  const memb = av.wings === "big" && !far ? `<path d="M-2 -2 Q-12 -40 -18 -70 M-4 0 Q-28 -30 -44 -48 M-6 2 Q-34 -20 -56 -31" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>` : "";
  const tr = far ? `translate(${a.x + 10} ${a.y - 4}) rotate(18) scale(${a.s * 0.92})` : `translate(${a.x} ${a.y}) scale(${a.s})`;
  return `<g transform="${tr}"><path d="${path}" fill="${fill}" stroke="${C.dark}" stroke-width="2" stroke-linejoin="round" ${far ? 'opacity=".9"' : ""}/>${memb}</g>`;
}
function sideHorns(av, a) {
  const g = (p, f, st) => `<g transform="translate(${a.x} ${a.y}) scale(${a.s})"><path d="${p}" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/><path d="${p}" transform="translate(8 2)" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/></g>`;
  if (av.horns === "short") return g("M0 2 Q-6 -8 -14 -12 Q-8 -2 -6 6 Z", "#FFF3D6", "#D9C49A");
  if (av.horns === "curved") return g("M0 2 Q-6 -18 -26 -20 Q-12 -12 -8 6 Z", "#FFF3D6", "#D9C49A");
  if (av.horns === "crystal") return g("M0 2 L-10 -22 L-4 -16 L-2 -28 L6 2 Z", "#BDEBFF", "#5FB8E8");
  return "";
}
function sideTailTip(av, a, C, uid) {
  if (av.tail === "flame") return `<g transform="translate(${a.x} ${a.y}) rotate(${a.rot - 90})"><path d="M0 0 Q-14 -14 -4 -30 Q-2 -20 4 -20 Q2 -30 10 -38 Q16 -18 10 -6 Q6 2 0 0 Z" fill="url(#fire-${uid})"/></g>`;
  return `<g transform="translate(${a.x} ${a.y}) rotate(${a.rot})"><path d="M-2 0 L8 -8 L18 0 L8 8 Z" fill="${C.dark}"/></g>`;
}

// ---------- accessori, uguali per tutte le creature di profilo ----------
function sideFace(av, e) {
  if (av.face === "glasses") return `<circle cx="${e.x + 1}" cy="${e.y}" r="${e.r * 2}" fill="none" stroke="#2B2340" stroke-width="2.6"/><path d="M${e.x - e.r * 2 + 1} ${e.y - 1} L${e.x - e.r * 4.2} ${e.y - 3}" stroke="#2B2340" stroke-width="2.6" stroke-linecap="round"/>`;
  if (av.face === "mask") return `<rect x="${e.x - e.r * 3.6}" y="${e.y - e.r * 1.5}" width="${e.r * 6}" height="${e.r * 3}" rx="${e.r * 1.4}" fill="#2B2340"/>` +
    `<path d="M${e.x - e.r * 3.4} ${e.y} l-9 -5 M${e.x - e.r * 3.4} ${e.y + 1} l-8 6" stroke="#2B2340" stroke-width="3.5" stroke-linecap="round"/>` + sideEye(e);
  return "";
}
function sideNeck(av, n, ch) {
  let s = "";
  if (av.neck === "scarf") s += `<g transform="translate(${n.x} ${n.y}) rotate(${n.rot})"><rect x="-6" y="${-n.h / 2 - 2}" width="12" height="${n.h + 4}" rx="5" fill="#E5484D"/>` +
    `<path d="M-2 ${n.h / 2 - 2} L-12 ${n.h / 2 + 16} L-2 ${n.h / 2 + 18} L4 ${n.h / 2} Z" fill="#C23A3A"/><path d="M-6 ${-n.h / 4} l12 0 M-6 ${n.h / 6} l12 0" stroke="#fff" stroke-width="2" opacity=".6"/></g>`;
  if (av.neck === "medal") s += `<path d="M${n.x - 4} ${n.y - 4} L${ch.x} ${ch.y} L${n.x + 6} ${n.y + 2}" stroke="#4A9EF0" stroke-width="5" fill="none" stroke-linejoin="round"/>` +
    `<circle cx="${ch.x}" cy="${ch.y + 7}" r="8" fill="#F2B830" stroke="#C98F0E" stroke-width="2"/>` + star(ch.x, ch.y + 7, 4.5, "#FFF5CC");
  return s;
}
function hatAt(av, a) {     // riusa i cappelli del draghetto, agganciati alla testa
  let h = "";
  if (av.head === "wizard") h = `<path d="M70 44 Q104 -6 112 -6 Q110 10 130 42 Z" fill="#6E56CF"/><ellipse cx="100" cy="42" rx="36" ry="7" fill="#5241A8"/>` + star(100, 20, 5, "#FFD54A") + star(114, 32, 3.5, "#FFD54A");
  if (av.head === "crown") h = `<path d="M78 40 L80 18 L90 30 L100 12 L110 30 L120 18 L122 40 Z" fill="#F2B830" stroke="#C98F0E" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="30" r="3.5" fill="#E5484D"/><circle cx="86" cy="34" r="2.5" fill="#4A9EF0"/><circle cx="114" cy="34" r="2.5" fill="#4CC38A"/>`;
  return h ? `<g transform="translate(${a.x} ${a.y}) rotate(${a.rot}) scale(${a.s}) translate(-100 -42)">${h}</g>` : "";
}

function drawSpec(S_, av, C, uid, dragon) {
  let b = "";
  if (dragon && S_.shoulder) b += sideWing(av, C, S_.shoulder, true, uid);
  b += S_.far || "";
  if (dragon && av.crest === "spikes" && S_.crest) b += S_.crest.map(([x, y, nx, ny, h]) => tri(x, y, nx, ny, h, 3.5, C.dark)).join("");
  b += S_.tail || "";
  if (dragon && S_.tailTip) b += sideTailTip(av, S_.tailTip, C, uid);
  b += S_.body + (S_.near || "");
  if (dragon && S_.shoulder) b += sideWing(av, C, S_.shoulder, false, uid);
  b += S_.water || "";
  b += sideNeck(av, S_.neck, S_.chest);
  if (dragon && S_.hornBase) b += sideHorns(av, S_.hornBase);
  if (dragon && av.crest === "royal" && S_.royal) b += `<g transform="translate(${S_.royal.x} ${S_.royal.y}) rotate(${S_.royal.rot}) scale(${S_.royal.s})"><path d="M-14 4 Q-6 -20 10 -14 Q4 -4 8 4 Z" fill="#E5484D"/></g>`;
  b += S_.head + sideEye(S_.eye) + sideFace(av, S_.eye) + hatAt(av, S_.top) + (S_.front || "");
  return b;
}
function sideCreature(stage, av, C, uid) {
  return drawSpec([null, sideLizard, sideIguana, sideCroc, null, sideDragon, sideWordDragon][stage](C), av, C, uid, stage >= 5);
}

// ================= LINEA DEL GHIACCIO: corpi acquatici e serpentini =================
const frond = (x0, y0, x1, y1, cx, cy, c) => `<path d="M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}" stroke="${c}" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
  [0.35, 0.6, 0.85].map(t => { const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${c}"/>`; }).join("");
const waveD = y => { let d = `M-80 ${y}`; for (let x = -80; x < 280; x += 36) d += ` Q${x + 18} ${y - 6} ${x + 36} ${y}`; return d; };
const waterFront = (y, op = 0.55) => `<path d="${waveD(y)} L280 260 L-80 260 Z" fill="#7CC8F0" opacity="${op}"/><path d="${waveD(y)}" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8"/>`;
const floe = (x, y, w) => `<path d="M${x} ${y} l${w * .2} ${-w * .35} l${w * .5} ${-w * .1} l${w * .3} ${w * .45} Z" fill="#fff" stroke="#BFE3F7" stroke-width="1.5"/>`;
function crestAlong(P, side, w0, w1, from = 0.1, to = 0.9, step = 0.16) {   // punti per la cresta lungo una curva
  const out = []; for (let t = from; t <= to + 1e-6; t += step) { const [x, y] = bez(P, t); let [nx, ny] = bezN(P, t); if (side === "back" && nx > 0) { nx = -nx; ny = -ny; } const w = (w0 + (w1 - w0) * t) / 2; out.push([x + nx * w, y + ny * w, nx, ny, 7]); }
  return out;
}
function iceAxolotl(C) {
  const pink = "#FFA9C8";
  return {
    far: leg(86, 150, 82, 164, 6, C.dark, 1) + leg(114, 150, 120, 164, 6, C.dark, 1),
    tail: `<path d="M72 132 Q42 110 8 124 Q20 134 10 142 Q42 162 72 152 Z" fill="${C.main}" opacity=".55" stroke="${C.dark}" stroke-width="1.5"/>` + taper([[66, 142], [46, 140], [28, 142], [10, 133]], 14, 3, C.main),
    body: `<ellipse cx="96" cy="142" rx="32" ry="14" fill="${C.main}"/><ellipse cx="98" cy="149" rx="24" ry="6" fill="${C.belly}"/>` +
      `<circle cx="84" cy="136" r="2.4" fill="${C.dark}" opacity=".4"/><circle cx="100" cy="134" r="2.8" fill="${C.dark}" opacity=".4"/>`,
    near: leg(82, 152, 74, 166, 7, C.main, 1) + leg(112, 152, 122, 166, 7, C.main, 1),
    head: frond(126, 124, 108, 100, 112, 116, pink) + frond(124, 132, 100, 118, 108, 130, pink) + frond(126, 140, 104, 146, 112, 142, pink) +
      `<ellipse cx="138" cy="134" rx="23" ry="16" fill="${C.main}"/>` +
      `<path d="M126 142 Q144 152 160 138" stroke="${C.dark}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="134" cy="142" r="5" fill="${pink}" opacity=".5"/>`,
    eye: { x: 146, y: 128, r: 3.8 }, top: { x: 138, y: 119, s: 0.5, rot: 0 }, neck: { x: 120, y: 140, h: 26, rot: 0 }, chest: { x: 118, y: 152 },
  };
}
function iceNewt(C) {
  const tail = [[60, 142], [36, 146], [18, 152], [2, 140]];
  let crest = "M58 136"; for (let x = 58, k = 0; x <= 126; x += 6, k++) crest += ` L${x} ${k % 2 ? 132 : 126}`; crest += " L126 137 Z";
  let fin = ""; for (let t = 0.05; t < 0.95; t += 0.09) { const [x, y] = bez(tail, t), [nx, ny] = bezN(tail, t), w = (12 - 10 * t) / 2 + 5; fin += `${(x + nx * w).toFixed(1)},${(y + ny * w).toFixed(1)} `; }
  return {
    far: leg(78, 146, 72, 160, 6, C.dark, 1) + leg(112, 146, 120, 160, 6, C.dark, 1),
    tail: `<polyline points="${fin}" fill="none" stroke="${C.dark}" stroke-width="5" stroke-linejoin="round" opacity=".7"/>` + taper(tail, 12, 2, C.main),
    body: `<path d="${crest}" fill="${C.dark}" opacity=".75"/><ellipse cx="92" cy="142" rx="36" ry="10" fill="${C.main}"/><ellipse cx="94" cy="148" rx="28" ry="4.5" fill="${C.belly}"/>` +
      [72, 86, 100, 114].map(x => `<circle cx="${x}" cy="148" r="1.8" fill="${C.dark}"/>`).join(""),
    near: leg(76, 148, 64, 160, 6.5, C.main, 1) + leg(112, 148, 124, 160, 6.5, C.main, 1),
    head: `<ellipse cx="128" cy="138" rx="16" ry="10" fill="${C.main}"/><ellipse cx="141" cy="140" rx="10" ry="6.5" fill="${C.main}"/>` +
      `<path d="M134 145 Q144 146 150 141" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    water: waterFront(150, 0.4),
    eye: { x: 132, y: 134, r: 3.8 }, top: { x: 128, y: 128, s: 0.42, rot: 0 }, neck: { x: 116, y: 141, h: 20, rot: 0 }, chest: { x: 112, y: 148 },
  };
}
function iceSerpent(C) {
  const neck = [[122, 150], [128, 118], [150, 112], [158, 92]];
  return {
    tail: taper([[14, 150], [22, 116], [46, 116], [54, 150]], 8, 15, C.main) + tri(34, 117, 0, -1, 9, 4, C.dark),
    body: taper([[62, 150], [72, 104], [104, 104], [112, 150]], 17, 19, C.main) + tri(80, 108, -0.3, -1, 10, 4, C.dark) + tri(94, 107, 0.2, -1, 10, 4, C.dark) +
      taper(neck, 21, 15, C.main) + taper([[128, 152], [134, 120], [154, 116], [162, 98]], 7, 5, C.belly),
    water: waterFront(142, 0.6),
    head: `<path d="M152 80 L138 64 L148 70 L144 54 L156 68 L160 58 Z" fill="${C.dark}"/>` +
      `<ellipse cx="166" cy="86" rx="17" ry="12" fill="${C.main}"/><ellipse cx="181" cy="91" rx="11" ry="7" fill="${C.main}"/>` +
      `<path d="M168 96 Q180 98 191 92" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="188" cy="87" r="1.4" fill="${C.dark}"/>`,
    eye: { x: 170, y: 82, r: 4.5 }, top: { x: 164, y: 75, s: 0.45, rot: -8 }, neck: { x: 146, y: 116, h: 18, rot: -62 }, chest: { x: 150, y: 128 },
  };
}
function iceBabyDragon(C) {   // cucciolo di drago d'acqua, acciambellato
  const neck = [[120, 148], [136, 128], [124, 108], [134, 92]], tail = [[56, 150], [32, 142], [28, 116], [44, 106]];
  const t = bez(tail, 1), tn = bezN(tail, 1);
  return {
    far: leg(84, 160, 80, 172, 7, C.dark, 1),
    tail: taper(tail, 14, 4, C.main),
    body: `<ellipse cx="98" cy="152" rx="46" ry="20" fill="${C.main}"/><ellipse cx="98" cy="147" rx="26" ry="7" fill="${C.dark}" opacity=".45"/>` +
      `<path d="M58 160 Q98 178 140 160" stroke="${C.belly}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      taper(neck, 21, 16, C.main) + taper([[126, 150], [142, 130], [130, 110], [140, 96]], 7, 5, C.belly),
    near: leg(118, 158, 126, 172, 7, C.main, 1),
    head: `<ellipse cx="138" cy="84" rx="16" ry="13" fill="${C.main}"/><ellipse cx="152" cy="89" rx="11" ry="8" fill="${C.main}"/>` +
      `<path d="M158 90 Q172 88 176 100 Q178 106 172 108" stroke="${C.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      `<path d="M156 94 Q166 100 164 112" stroke="${C.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      `<path d="M124 78 L112 72 L122 84 L110 86 L124 90 Z" fill="${C.belly}" stroke="${C.dark}" stroke-width="1"/>` +
      `<path d="M144 96 Q152 99 160 95" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="160" cy="87" r="1.3" fill="${C.dark}"/>`,
    eye: { x: 141, y: 80, r: 4.6 }, top: { x: 136, y: 72, s: 0.45, rot: -4 }, neck: { x: 130, y: 114, h: 18, rot: -100 }, chest: { x: 134, y: 128 },
    hornBase: { x: 134, y: 74, s: 0.85 }, crest: crestAlong(neck, "back", 21, 16).concat([[74, 133, 0, -1, 7], [92, 132, 0, -1, 7], [110, 133, 0, -1, 7]]),
    tailTip: { x: t[0], y: t[1], rot: tn[2] }, royal: { x: 138, y: 71, s: 0.7, rot: -6 },
  };
}
function iceLeviathan(C) {
  const neck = [[100, 156], [110, 112], [140, 100], [150, 68]];
  const tail = [[12, 154], [6, 138], [2, 126], [8, 114]];
  const t = bez(tail, 1), tn = bezN(tail, 1);
  return {
    tail: taper(tail, 12, 4, C.main),
    far: taper([[24, 154], [34, 112], [78, 108], [90, 154]], 22, 28, C.main) + tri(56, 110, 0, -1, 12, 5, C.dark) + tri(40, 116, -0.4, -1, 10, 4, C.dark),
    body: `<path d="M116 132 Q92 92 64 88 Q80 102 72 110 Q88 110 88 122 Q102 120 108 142 Z" fill="${C.dark}" opacity=".9"/>` +
      taper(neck, 34, 24, C.main) + taper([[108, 158], [118, 116], [144, 104], [156, 74]], 12, 9, C.belly),
    water: waterFront(150, 0.6) + floe(18, 152, 26) + floe(170, 154, 30),
    head: `<path d="M144 50 L126 34 L138 44 L130 22 L146 40 L150 26 Z" fill="${C.dark}"/>` +
      `<ellipse cx="160" cy="58" rx="24" ry="17" fill="${C.main}"/><ellipse cx="181" cy="68" rx="16" ry="9" fill="${C.main}"/>` +
      `<path d="M168 74 L171 82 L175 74 M178 75 L181 83 L185 75" fill="#fff" stroke="#fff" stroke-width="1"/>` +
      `<path d="M160 74 Q178 77 196 68" stroke="${C.dark}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="192" cy="63" r="1.6" fill="${C.dark}"/>`,
    eye: { x: 164, y: 52, r: 5 }, top: { x: 158, y: 42, s: 0.55, rot: -8 }, neck: { x: 126, y: 108, h: 30, rot: -55 }, chest: { x: 132, y: 124 },
    hornBase: { x: 150, y: 46, s: 1.1 }, crest: crestAlong(neck, "back", 34, 24, 0.25, 0.85, 0.15),
    tailTip: { x: t[0], y: t[1], rot: tn[2] }, royal: { x: 160, y: 42, s: 0.9, rot: -8 },
  };
}
function iceWinterDragon(C) {   // drago orientale: lungo, sinuoso, vola senza ali
  const A = [[150, 84], [128, 130], [98, 152], [78, 120]], B = [[78, 120], [62, 92], [34, 96], [14, 138]];
  const t = bez(B, 1), tn = bezN(B, 1);
  let mane = ""; for (let k = 0.1; k < 0.95; k += 0.14) { const [x, y] = bez(A, k); let [nx, ny] = bezN(A, k); if (nx > 0 && k < 0.5) { nx = -nx; ny = -ny; } mane += shard(x + nx * 10, y + ny * 10, 8, Math.atan2(nx, -ny) * 180 / Math.PI); }
  for (let k = 0.15; k < 0.8; k += 0.2) { const [x, y] = bez(B, k), [nx, ny] = bezN(B, k); mane += shard(x + nx * 9, y + ny * 9, 7, Math.atan2(nx, -ny) * 180 / Math.PI); }
  const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="22" ry="9"/><ellipse cx="-12" cy="-6" rx="11" ry="9"/><ellipse cx="8" cy="-9" rx="13" ry="11"/></g>`;
  return {
    far: cloud(40, 170, 1.2) + cloud(150, 176, 1.4) + leg(126, 130, 130, 146, 7, C.dark, 1) + leg(44, 104, 38, 118, 6, C.dark, 1),
    tail: mane + taper(B, 22, 7, C.main) + taper([[78, 124], [64, 100], [38, 104], [18, 138]], 8, 3, C.belly),
    body: taper(A, 24, 22, C.main) + taper([[146, 92], [128, 134], [98, 156], [82, 126]], 9, 8, C.belly) +
      `<circle cx="168" cy="128" r="9" fill="#F4FBFF" stroke="#7CC8F0" stroke-width="2"/><circle cx="165" cy="125" r="3" fill="#fff"/>`,
    near: leg(140, 108, 158, 126, 8, C.main, 1) + leg(64, 108, 60, 124, 7, C.main, 1),
    front: cloud(104, 186, 1.3),
    head: `<path d="M150 62 Q132 56 124 70 Q136 66 140 74 Q128 76 126 88 Q140 80 150 84 Z" fill="${C.belly}" stroke="${C.dark}" stroke-width="1"/>` +
      `<ellipse cx="162" cy="66" rx="17" ry="13" fill="${C.main}"/><ellipse cx="182" cy="72" rx="15" ry="8" fill="${C.main}"/>` +
      `<path d="M192 70 Q204 70 204 82 Q204 92 196 94" stroke="${C.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      `<path d="M188 76 Q194 90 186 104" stroke="${C.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      `<path d="M170 78 Q184 82 196 76" stroke="${C.dark}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="193" cy="68" r="1.5" fill="${C.dark}"/>`,
    eye: { x: 166, y: 61, r: 4.8 }, top: { x: 160, y: 52, s: 0.5, rot: -6 }, neck: { x: 146, y: 92, h: 22, rot: -65 }, chest: { x: 140, y: 106 },
    hornBase: { x: 156, y: 55, s: 1 }, crest: crestAlong(B, "up", 22, 7, 0.1, 0.8, 0.14),
    tailTip: { x: t[0], y: t[1], rot: tn[2] }, royal: { x: 162, y: 52, s: 0.8, rot: -6 },
  };
}
const ICE_SPECIES = [null, iceAxolotl, iceNewt, iceSerpent, iceBabyDragon, iceLeviathan, iceWinterDragon];
// inquadratura: centro x, centro y, scala
const ICE_FRAME = { 1: [90, 140, 1.22], 2: [86, 140, 1.2], 3: [100, 116, 1.0], 4: [100, 128, 1.15], 5: [100, 100, 0.95], 6: [106, 108, 1.08] };

// ================= SCENARI: tenui, statici, solo nelle schermate senza domande =================
function sceneSVG(line, stage) {
  const R = (c) => `<rect x="-8" y="-14" width="216" height="214" fill="${c}"/>`;
  const sun = (x, y, r, c, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`;
  const hills = (y, c) => `<path d="M-8 ${y} Q40 ${y - 22} 90 ${y - 6} T208 ${y - 10} L208 200 L-8 200 Z" fill="${c}"/>`;
  const st = Math.max(1, stage);
  if (line === "ghiaccio") {
    if (st <= 2) return R("#EEF7FF") + hills(150, "#F7FBFF") + `<rect x="-8" y="156" width="216" height="44" fill="#D6EEFF"/><path d="M20 172 l14 6 l10 -4 M120 184 l16 -6 l12 4 M70 192 l10 -5" stroke="#B5DCF5" stroke-width="2" fill="none"/>` + snowflake(30, 20, 5) + snowflake(170, 34, 4);
    if (st === 3) return R("#EDF6FF") + `<path d="M120 140 l18 -34 l12 18 l10 -10 l16 26 Z" fill="#fff" stroke="#D3ECFA" stroke-width="2"/><path d="M10 140 l14 -20 l14 20 Z" fill="#fff" stroke="#D3ECFA" stroke-width="2"/>` + `<rect x="-8" y="138" width="216" height="62" fill="#CDEBFA"/>`;
    if (st === 4) return R("#E3F2FF") + [10, 34, 62, 96, 128, 160, 188].map((x, i) => `<path d="M${x - 8} -14 L${x} ${10 + (i % 3) * 10} L${x + 8} -14 Z" fill="#fff" opacity=".9"/>`).join("") + `<ellipse cx="100" cy="196" rx="130" ry="26" fill="#F4FAFF"/>`;
    if (st === 5) return R("#E8F0FF") + sun(160, 30, 18, "#FFE2E9", 0.8) + `<path d="M150 140 l14 -30 l10 12 l12 -6 l12 24 Z" fill="#fff" stroke="#D3ECFA" stroke-width="2"/>` + `<rect x="-8" y="140" width="216" height="60" fill="#CDEBFA"/>`;
    return R("#DCE6FA") + `<path d="M-8 40 Q40 10 100 34 T208 22 L208 56 Q150 42 100 64 T-8 70 Z" fill="#9FE6C4" opacity=".35"/><path d="M-8 60 Q60 34 110 54 T208 44 L208 74 Q150 64 100 84 T-8 88 Z" fill="#C3A8FF" opacity=".3"/>` +
      [[24, 18], [70, 8], [140, 12], [186, 30], [12, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join("");
  }
  if (st <= 2) return R("#FFF4E2") + sun(170, 22, 16, "#FFD27A", 0.6) + hills(150, "#F6E2C4") + `<rect x="-8" y="158" width="216" height="42" fill="#F1D7B0"/><ellipse cx="30" cy="160" rx="18" ry="9" fill="#E6C79C"/><ellipse cx="178" cy="164" rx="14" ry="7" fill="#E6C79C"/>`;
  if (st === 3) return R("#EAF6EE") + hills(146, "#DCEFD9") + `<rect x="-8" y="152" width="216" height="48" fill="#C6E7EF"/><path d="M-8 158 Q30 154 70 158 T150 158 T208 158" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>` + [14, 22, 30, 182, 190].map(x => `<path d="M${x} 158 Q${x - 2} 140 ${x + 2} 126" stroke="#9CCB8A" stroke-width="2.5" fill="none" stroke-linecap="round"/>`).join("");
  if (st === 4) return R("#F2E8DC") + `<path d="M-8 200 L-8 60 Q100 -40 208 60 L208 200 Z" fill="#EADBC8"/><ellipse cx="100" cy="186" rx="80" ry="16" fill="#E6D3B3"/>` + [60, 80, 110, 130].map((x, i) => `<path d="M${x} ${180 + (i % 2) * 6} l20 ${i % 2 ? -6 : 6}" stroke="#D2B98F" stroke-width="2"/>`).join("");
  if (st === 5) return R("#EAF0FF") + `<path d="M-8 150 L36 84 L70 130 L110 70 L156 136 L182 100 L208 140 L208 200 L-8 200 Z" fill="#D9E0F3"/><path d="M110 70 L100 86 L118 86 Z M36 84 L28 96 L44 96 Z" fill="#fff"/>` + `<rect x="-8" y="166" width="216" height="34" fill="#DCE8CF"/>`;
  return R("#F3EDFF") + sun(100, 60, 70, "#FFF3C4", 0.55) + [[30, 150, 1.3], [170, 160, 1.5], [100, 186, 1.6]].map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(${k})" fill="#fff"><ellipse rx="22" ry="9"/><ellipse cx="-12" cy="-6" rx="11" ry="9"/><ellipse cx="8" cy="-9" rx="13" ry="11"/></g>`).join("");
}

function creatureSVG(av, stage, size = 200, uid = "d", line = "fuoco", scene = false) {
  av = Object.assign({}, AVATAR_DEFAULT, av || {});
  const L = LINES[line] || LINES.fuoco, ice = line === "ghiaccio";
  const C = DRAGON_COLORS[L.palette || av.color] || DRAGON_COLORS.verde;
  stage = Math.max(0, Math.min(stage, FINAL_STAGE));
  let s = scene ? sceneSVG(line, stage) : "";
  if (stage === 0) return wrapSVG(s + (ice ? iceEggInner() : eggInner(C)), size, uid, L.names[0], scene);
  if (av.aura === "aurora") s += `<path d="M-6 50 Q40 10 100 40 T206 30 L206 70 Q150 50 100 76 T-6 80 Z" fill="#7BE0B0" opacity=".35"/><path d="M-6 66 Q50 34 100 60 T206 50 L206 84 Q150 70 100 92 T-6 96 Z" fill="#B18CFF" opacity=".3"/>`;
  if (av.aura === "lightning") s += [[22, 30, 1], [178, 40, -1], [30, 120, 1], [176, 126, -1]].map(([x, y, d]) => `<path d="M${x} ${y} l${8 * d} 14 l${-6 * d} 2 l${10 * d} 18 l${-14 * d} -16 l${6 * d} -2 Z" fill="#FFD54A" stroke="#F2A900" stroke-width="1.5" stroke-linejoin="round"/>`).join("");
  if (av.aura === "galaxy") s += `<circle cx="100" cy="100" r="96" fill="url(#gal-${uid})"/>` + [[30, 40, 3], [160, 30, 2.5], [180, 120, 3], [20, 130, 2], [120, 16, 2], [60, 170, 2.5], [150, 170, 2]].map(([x, y, r]) => star(x, y, r * 2, "#fff")).join("");
  // aura (dietro a tutto)
  if (stage >= 6) s += `<circle cx="100" cy="104" r="94" fill="none" stroke="#FFD54A" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity=".9"/>`;
  if (av.aura === "rainbow") ["#FF6B6B", "#FFB347", "#FFE066", "#7BD389", "#6EC1FF", "#B18CFF"].forEach((c, i) =>
    s += `<path d="M ${18 + i * 9} 172 A ${82 - i * 9} ${82 - i * 9} 0 0 1 ${182 - i * 9} 172" fill="none" stroke="${c}" stroke-width="8" opacity=".7"/>`);
  if (av.aura === "stars") s += star(24, 40, 9, "#FFD54A") + star(176, 30, 7, "#FFD54A") + star(150, 12, 5, "#FFE89A") + star(30, 100, 6, "#FFE89A") + star(184, 110, 8, "#FFD54A");
  if (av.aura === "flames") {
    const fl = (x, h) => `<path d="M${x - 10} 192 Q${x - 14} ${192 - h * .6} ${x} ${192 - h} Q${x + 2} ${192 - h * .5} ${x + 10} 192 Z" fill="url(#fire-${uid})" opacity=".85"/>`;
    s += fl(30, 60) + fl(52, 42) + fl(170, 58) + fl(148, 40) + fl(14, 34) + fl(186, 36);
  }
  if (ice) {
    const F = ICE_FRAME[stage];
    s += `<g transform="translate(100 ${stage >= 5 ? 104 : 112}) scale(${F[2]}) translate(${-F[0]} ${-F[1]})">${drawSpec(ICE_SPECIES[stage](C), av, C, uid, stage >= DRAGON_FROM)}</g>`;
  } else if (stage === 4) s += `<ellipse cx="100" cy="180" rx="44" ry="6" fill="#000" opacity=".07"/>` + chibiDragon(av, C, stage, uid);
  else {   // inquadratura per ogni creatura: centro, scala, linea del terreno, larghezza dell'ombra
    const F = { 1: [84, 146, 1.18, 168, 56], 2: [84, 140, 1.14, 170, 64], 3: [96, 150, 1.0, 173, 80], 5: [90, 120, 1.0, 175, 66], 6: [100, 106, 0.98, 179, 50] }[stage];
    s += `<g transform="translate(100 ${stage >= 5 ? 112 : 116}) scale(${F[2]}) translate(${-F[0]} ${-F[1]})"><ellipse cx="${F[0] + 4}" cy="${F[3]}" rx="${F[4]}" ry="5" fill="#000" opacity=".07"/>${sideCreature(stage, av, C, uid)}</g>`;
  }
  if (ice) s += snowflake(18, 26, 6) + snowflake(184, 64, 5) + snowflake(170, 160, 4) + snowflake(28, 150, 4.5);
  const defs = `<defs><linearGradient id="fire-${uid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF4D1A"/><stop offset=".55" stop-color="#FF9F1C"/><stop offset="1" stop-color="#FFE066"/></linearGradient>` +
    `<radialGradient id="gal-${uid}"><stop offset="0" stop-color="#6E56CF" stop-opacity=".55"/><stop offset=".7" stop-color="#2B2340" stop-opacity=".35"/><stop offset="1" stop-color="#2B2340" stop-opacity="0"/></radialGradient></defs>`;
  return wrapSVG(defs + s, size, uid, L.names[stage], scene);
}
function wrapSVG(inner, size, uid, label, scene) {
  return `<svg class="dragon${scene ? " scene" : ""}" viewBox="-8 -14 216 214" width="${size}" height="${size}" role="img" aria-label="${esc_(label)}">` +
    `<defs><clipPath id="clip-${uid}"><rect x="-8" y="-14" width="216" height="214" rx="26"/></clipPath></defs><g clip-path="url(#clip-${uid})">${inner}</g></svg>`;
}
const esc_ = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- dettagli della Linea del Ghiaccio ----------
function snowflake(x, y, r) {
  let p = ""; for (let i = 0; i < 3; i++) { const a = Math.PI / 3 * i; p += `M${(x - r * Math.cos(a)).toFixed(1)} ${(y - r * Math.sin(a)).toFixed(1)} L${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)} `; }
  return `<path d="${p}" stroke="#7CC8F0" stroke-width="1.8" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`;
}
const shard = (x, y, h, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-4 0 L0 ${-h} L4 0 Z" fill="#E6F8FF" stroke="#5FB8E8" stroke-width="1.5" stroke-linejoin="round"/><path d="M0 ${-h + 3} L0 -2" stroke="#fff" stroke-width="1.2"/></g>`;
function iceSide(stage) {      // cristalli sul dorso, diversi per ogni creatura
  const pts = { 1: [[84, 136, 7], [98, 134, 9], [110, 136, 7]], 2: [[70, 126, 8], [124, 126, 8]], 3: [[60, 140, 7], [140, 128, 8], [36, 148, 6]],
    5: [[78, 118, 10], [94, 116, 12], [108, 118, 10]], 6: [[86, 92, 10, -20], [92, 108, 9, -30], [120, 30, 9, -15]] }[stage] || [];
  return pts.map(([x, y, h, r]) => shard(x, y, h, r || 0)).join("");
}
function iceChibi() { return shard(88, 36, 12, -15) + shard(100, 32, 14) + shard(112, 36, 12, 15) + shard(150, 112, 10, 40); }
function iceEggInner() {
  return `
    <ellipse cx="100" cy="182" rx="44" ry="8" fill="#000" opacity=".08"/>
    <path d="M100 20 C 150 20 168 110 160 140 C 152 172 128 184 100 184 C 72 184 48 172 40 140 C 32 110 50 20 100 20 Z" fill="#DDF3FF" stroke="#3E9BD6" stroke-width="3"/>
    <path d="M62 92 L80 104 L74 120 L92 132 M120 60 L132 76 L126 90 M110 150 L124 140 L138 150" stroke="#7CC8F0" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M70 46 Q66 60 72 70" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>${snowflake(130, 120, 8)}${snowflake(84, 150, 5)}`;
}

function chibiDragon(av, C, stage, uid) {   // Draghetto: cucciolo seduto, vista frontale
  const sp = "dragon";
  const isDragon = sp === "dragon";
  const sc = [0, 0.74, 0.8, 0.9, 0.86, 1, 1.05][Math.min(stage, 6)];
  const fire = `url(#fire-${uid})`;

  let b = "";
  // ---- ALI (solo draghi) ----
  if (isDragon) {
    const wings = stage === 4 && av.wings !== "fire" ? (av.wings === "big" ? "big" : "small") : av.wings;
    const wingSc = stage === 4 ? 0.85 : stage >= 6 ? 1.1 : 1;
    const wingPath = wings === "small" ? "M74 112 Q46 84 34 96 Q46 104 40 118 Q56 114 70 126 Z"
      : "M72 108 Q30 50 10 70 Q26 78 18 94 Q34 92 30 110 Q46 106 46 122 Q60 114 72 128 Z";
    const memb = wings === "big" ? `<path d="M66 112 Q40 82 22 76 M60 118 Q42 98 32 104 M56 122 Q48 112 44 116" stroke="${C.main}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` : "";
    b += `<g transform="translate(100 115) scale(${wingSc}) translate(-100 -115)">${both(`<path d="${wingPath}" fill="${wings === "fire" ? fire : C.dark}" stroke="${C.dark}" stroke-width="2" stroke-linejoin="round"/>${memb}`)}</g>`;
  }

  // ---- CODA ----
  if (sp === "lizard" || sp === "iguana") {
    b += `<path d="M126 160 Q176 178 184 142 Q188 120 172 116 Q166 116 166 124" fill="none" stroke="${C.main}" stroke-width="10" stroke-linecap="round"/>`;
    if (sp === "iguana") b += [0, 1, 2, 3].map(i => `<circle cx="${146 + i * 10}" cy="${170 - i * 9}" r="3.2" fill="${C.dark}"/>`).join("");
  } else if (sp === "croc") {
    b += `<path d="M130 156 Q182 172 186 132 Q188 116 176 108" fill="none" stroke="${C.main}" stroke-width="20" stroke-linecap="round"/>`;
    b += `<path d="M150 158 l5 -11 l5 10 M166 150 l6 -10 l3 11 M178 134 l9 -6 l-1 11" fill="${C.dark}" stroke="${C.dark}" stroke-width="2" stroke-linejoin="round"/>`;
  } else {
    b += `<path d="M132 156 Q172 170 176 136 Q178 122 168 114" fill="none" stroke="${C.main}" stroke-width="15" stroke-linecap="round"/>`;
    if (av.tail === "flame") b += `<path d="M168 116 Q150 98 166 80 Q166 92 174 92 Q172 80 182 70 Q186 92 180 104 Q176 114 168 116 Z" fill="${fire}"/>`;
    else b += `<path d="M168 102 L182 116 L168 124 L156 112 Z" fill="${C.dark}"/>`;
  }

  // ---- ZAMPE E CORPO ----
  const bodyRx = sp === "lizard" ? 33 : sp === "iguana" ? 35 : 42, bodyRy = sp === "lizard" ? 38 : sp === "iguana" ? 40 : 44;
  if (sp === "lizard" || sp === "iguana") {
    b += both(`<ellipse cx="80" cy="172" rx="12" ry="7" fill="${C.dark}"/><circle cx="68" cy="175" r="3.5" fill="${C.dark}"/><circle cx="72" cy="179" r="3.5" fill="${C.dark}"/><circle cx="80" cy="180" r="3.5" fill="${C.dark}"/>`);
  } else b += both(`<ellipse cx="78" cy="172" rx="15" ry="9" fill="${C.dark}"/>`) + (sp === "croc" ? both(`<path d="M66 176 l-3 5 M72 179 l-1 5 M80 180 l1 5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`) : "");
  b += `<ellipse cx="100" cy="134" rx="${bodyRx}" ry="${bodyRy}" fill="${C.main}"/>`;
  b += `<ellipse cx="100" cy="142" rx="${bodyRx * 0.62}" ry="${bodyRy * 0.72}" fill="${C.belly}"/>`;
  if (sp === "croc") b += [0, 1, 2, 3].map(i => `<path d="M82 ${122 + i * 12} L118 ${122 + i * 12}" stroke="${C.main}" stroke-width="2" opacity=".35"/>`).join("") + `<path d="M100 112 L100 170" stroke="${C.main}" stroke-width="2" opacity=".3"/>`;
  else b += [0, 1, 2, 3].map(i => `<path d="M86 ${122 + i * 12} Q100 ${127 + i * 12} 114 ${122 + i * 12}" stroke="${C.main}" stroke-width="2" fill="none" opacity=".35"/>`).join("");
  if (sp === "lizard" || sp === "iguana") b += `<circle cx="74" cy="122" r="3.5" fill="${C.dark}" opacity=".6"/><circle cx="128" cy="140" r="4" fill="${C.dark}" opacity=".6"/><circle cx="122" cy="116" r="3" fill="${C.dark}" opacity=".6"/>`;
  const armX = 100 - bodyRx + 4;
  b += both(`<ellipse cx="${armX}" cy="130" rx="8" ry="14" fill="${C.main}" transform="rotate(25 ${armX} 130)"/>`);

  // ---- CRESTA / CORNA (draghi) ----
  if (isDragon && av.crest === "spikes") b += `<path d="M100 22 L92 40 L108 40 Z M86 30 L80 46 L94 44 Z M114 30 L120 46 L106 44 Z" fill="${C.dark}"/>`;
  if (isDragon && av.crest === "royal") b += `<path d="M100 14 Q88 24 84 42 L116 42 Q112 24 100 14 Z" fill="#E5484D"/><path d="M100 18 L100 40" stroke="#FFB4B4" stroke-width="2"/>`;
  if (sp === "iguana") b += `<path d="M100 30 L95 44 L105 44 Z M100 18 L94 34 L106 34 Z" fill="${C.dark}"/><path d="M90 40 L84 50 L95 48 Z M110 40 L116 50 L105 48 Z" fill="${C.dark}"/>`;
  if (isDragon && av.horns === "short") b += both(`<path d="M78 46 Q70 30 72 22 Q82 32 88 40 Z" fill="#FFF3D6" stroke="#D9C49A" stroke-width="2" stroke-linejoin="round"/>`);
  if (isDragon && av.horns === "curved") b += both(`<path d="M76 48 Q56 36 60 12 Q64 26 76 30 Q82 34 88 40 Z" fill="#FFF3D6" stroke="#D9C49A" stroke-width="2" stroke-linejoin="round"/>`);
  if (isDragon && av.horns === "crystal") b += both(`<path d="M76 46 L62 14 L74 22 L76 8 L88 40 Z" fill="#BDEBFF" stroke="#5FB8E8" stroke-width="2" stroke-linejoin="round"/><path d="M70 26 L76 38" stroke="#fff" stroke-width="2"/>`);

  // ---- TESTA ----
  const neckAcc = () => {
    let n = "";
    if (av.neck === "scarf") n += `<path d="M66 104 Q100 120 134 104 L134 114 Q100 130 66 114 Z" fill="#E5484D"/><path d="M118 114 L126 142 L114 140 L110 116 Z" fill="#C23A3A"/><path d="M74 108 L80 114 M90 112 L96 118 M106 112 L112 118 M122 108 L128 114" stroke="#fff" stroke-width="2" opacity=".6"/>`;
    if (av.neck === "medal") n += `<path d="M78 106 L100 128 L122 106" stroke="#4A9EF0" stroke-width="6" fill="none"/><circle cx="100" cy="132" r="10" fill="#F2B830" stroke="#C98F0E" stroke-width="2.5"/>` + star(100, 132, 5.5, "#FFF5CC");
    return n;
  };
  if (sp === "croc") {
    b += neckAcc();
    b += both(`<circle cx="85" cy="56" r="14" fill="${C.main}"/>`);                       // bozzi degli occhi
    b += `<ellipse cx="100" cy="72" rx="38" ry="30" fill="${C.main}"/>`;
    b += `<path d="M100 44 m-10 2 l4 -6 l4 6 m4 0 l4 -6 l4 6" fill="${C.dark}"/>`;          // squame
    b += `<rect x="72" y="74" width="56" height="40" rx="20" fill="${C.main}"/>`;            // muso lungo
    b += `<path d="M76 100 L80 108 L84 100 L88 108 L92 100 L96 108 L100 100 L104 108 L108 100 L112 108 L116 100 L120 108 L124 100" fill="#fff" stroke="#E7E1D3" stroke-width="1"/>`;
    b += `<path d="M76 100 Q100 104 124 100" stroke="${C.dark}" stroke-width="2.5" fill="none"/>`;
    b += `<circle cx="92" cy="80" r="3" fill="${C.dark}"/><circle cx="108" cy="80" r="3" fill="${C.dark}"/>`;
    b += `<circle cx="74" cy="90" r="5" fill="#FF8FA3" opacity=".4"/><circle cx="126" cy="90" r="5" fill="#FF8FA3" opacity=".4"/>`;
  } else {
    const hr = isDragon ? 38 : 33, hy = isDragon ? 72 : 74;
    if (sp === "iguana") b += `<path d="M90 104 Q100 132 110 104 Z" fill="${C.dark}" opacity=".85"/>`;   // giogaia
    b += `<circle cx="100" cy="${hy}" r="${hr}" fill="${C.main}"/>`;
    if (sp !== "dragon") b += `<circle cx="112" cy="54" r="3" fill="${C.dark}" opacity=".55"/><circle cx="84" cy="50" r="2.5" fill="${C.dark}" opacity=".55"/>`;
    b += `<ellipse cx="100" cy="90" rx="${isDragon ? 23 : 17}" ry="${isDragon ? 15 : 11}" fill="${C.belly}"/>`;
    b += `<ellipse cx="94" cy="${isDragon ? 86 : 88}" rx="2.2" ry="2.8" fill="${C.dark}"/><ellipse cx="106" cy="${isDragon ? 86 : 88}" rx="2.2" ry="2.8" fill="${C.dark}"/>`;
    b += `<path d="M91 96 Q100 102 109 96" stroke="${C.dark}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    b += `<circle cx="76" cy="84" r="5" fill="#FF8FA3" opacity=".45"/><circle cx="124" cy="84" r="5" fill="#FF8FA3" opacity=".45"/>`;
    b += neckAcc();
  }
  // occhi
  const ey = sp === "croc" ? 56 : 66;
  b += both(`<ellipse cx="85" cy="${ey}" rx="9" ry="10.5" fill="#fff"/><circle cx="87" cy="${ey + 1}" r="5.5" fill="#2B2340"/><circle cx="89" cy="${ey - 1.5}" r="2" fill="#fff"/>`);

  // ---- VISO ----
  if (av.face === "glasses") b += `<g transform="translate(0 ${ey - 66})"><circle cx="85" cy="66" r="13" fill="none" stroke="#2B2340" stroke-width="3"/><circle cx="115" cy="66" r="13" fill="none" stroke="#2B2340" stroke-width="3"/><path d="M98 64 Q100 61 102 64" stroke="#2B2340" stroke-width="3" fill="none"/><path d="M72 64 L64 60 M128 64 L136 60" stroke="#2B2340" stroke-width="3"/></g>`;
  if (av.face === "mask") b += `<g transform="translate(0 ${ey - 66})"><path d="M64 60 Q100 46 136 60 L134 74 Q118 80 104 70 L96 70 Q82 80 66 74 Z" fill="#2B2340"/><path d="M64 62 L52 58 M64 64 L54 70" stroke="#2B2340" stroke-width="4" stroke-linecap="round"/>` + both(`<ellipse cx="85" cy="66" rx="7" ry="8" fill="#fff"/><circle cx="87" cy="67" r="4" fill="#2B2340"/>`) + `</g>`;

  // ---- CAPPELLI ----
  const hdy = sp === "croc" ? 2 : isDragon ? 0 : 6;
  if (av.head === "wizard") b += `<g transform="translate(0 ${hdy})"><path d="M70 44 Q104 -6 112 -6 Q110 10 130 42 Z" fill="#6E56CF"/><ellipse cx="100" cy="42" rx="36" ry="7" fill="#5241A8"/>` + star(100, 20, 5, "#FFD54A") + star(114, 32, 3.5, "#FFD54A") + `</g>`;
  if (av.head === "crown") b += `<g transform="translate(0 ${hdy})"><path d="M78 40 L80 18 L90 30 L100 12 L110 30 L120 18 L122 40 Z" fill="#F2B830" stroke="#C98F0E" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="30" r="3.5" fill="#E5484D"/><circle cx="86" cy="34" r="2.5" fill="#4A9EF0"/><circle cx="114" cy="34" r="2.5" fill="#4CC38A"/></g>`;

  return `<g transform="translate(100 120) scale(${sc}) translate(-100 -120)">${b}</g>`;
}

function eggInner(C) {
  return `
    <ellipse cx="100" cy="182" rx="44" ry="8" fill="#000" opacity=".08"/>
    <path d="M100 20 C 150 20 168 110 160 140 C 152 172 128 184 100 184 C 72 184 48 172 40 140 C 32 110 50 20 100 20 Z" fill="${C.belly}" stroke="${C.dark}" stroke-width="3"/>
    <circle cx="78" cy="78" r="12" fill="${C.main}"/><circle cx="122" cy="110" r="15" fill="${C.main}"/><circle cx="84" cy="140" r="9" fill="${C.main}"/><circle cx="126" cy="60" r="7" fill="${C.main}"/>
    <path d="M70 46 Q66 60 72 70" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>`;
}

// ---------------- poteri: uno per ogni abilità di grammatica conquistata ----------------
const POWERS = {
  ort_h:    { icon: "👁️", name: "Vista dell'invisibile", d: "Vede anche le lettere che non si sentono." },
  ort_acc:  { icon: "🗡️", name: "Artigli d'accento", d: "Colpisce sempre nel punto giusto." },
  ort_apo:  { icon: "🪝", name: "Coda a uncino", d: "Aggancia le parole e le unisce." },
  ort_q:    { icon: "💧", name: "Respiro d'acqua", d: "Nuota nei fiumi e negli acquari." },
  ort_dop:  { icon: "👯", name: "Doppio colpo", d: "Colpisce due volte, come le doppie." },
  ort_cie:  { icon: "🔍", name: "Lente magica", d: "Scova ogni i nascosta." },
  ort_z:    { icon: "🦓", name: "Zampata a zeta", d: "Graffia una zeta sola, proprio dove serve." },
  gr_art:   { icon: "🛡️", name: "Scudo degli articoli", d: "Ogni parola ha la sua protezione." },
  gr_nome:  { icon: "📜", name: "Memoria dei nomi", d: "Non dimentica mai un nome." },
  gr_agg:   { icon: "🎨", name: "Scaglie cangianti", d: "Cambia aspetto come un aggettivo." },
  gr_verbo: { icon: "⚡", name: "Scatto fulmineo", d: "Pura azione, come un verbo." },
  gr_modi:  { icon: "🧭", name: "Bussola dei modi", d: "Sa sempre come muoversi." },
  gr_tempi: { icon: "⏳", name: "Viaggio nel tempo", d: "Va nel passato e nel futuro." },
  gr_cong:  { icon: "🌀", name: "Magia del se", d: "Immagina mondi possibili." },
  gr_aus:   { icon: "🤝", name: "Doppia forza", d: "Unisce due parole in un solo colpo, come i tempi composti." },
  gr_indef: { icon: "📣", name: "Voce di comando", d: "Dà ordini che tutti ascoltano." },
  gr_pron:  { icon: "🔁", name: "Eco magica", d: "Si sostituisce a chiunque." },
  log_sogg: { icon: "🎯", name: "Occhio del cacciatore", d: "Trova sempre chi compie l'azione." },
  log_ogg:  { icon: "🦾", name: "Presa possente", d: "Afferra direttamente il suo obiettivo." },
};

// rete di sicurezza: un'abilità senza potere non deve mai bloccare l'app
function powerOf(id) { return POWERS[id] || { icon: "✨", name: "Potere misterioso", d: "Ancora da scoprire." }; }

// ---------------- poteri attivi: li danno gli stadi della Linea del Ghiaccio ----------------
const PERKS = [
  { id: "regen",  stage: 1, icon: "💧", name: "Rigenerazione",        d: "Il primo errore di ogni lezione non spezza il combo." },
  { id: "breath", stage: 3, icon: "🌬️", name: "Respiro gelido",       d: "+10 secondi nella raffica finale." },
  { id: "mirror", stage: 5, icon: "🪞", name: "Specchio di ghiaccio", d: "Una volta per lezione: un aiuto su una domanda difficile." },
  { id: "winter", stage: 6, icon: "❄️", name: "Inverno eterno",       d: "Dopo un errore il combo si dimezza invece di azzerarsi." },
];

// ================= IL MOSTRO DEI REFUSI =================
const MONSTERS = [
  { n: "Refuso Gommoso",         c: "#9A6CF0", d: "#6E44C9", spikes: false, armor: false },
  { n: "Refuso Spinoso",         c: "#EF5B5B", d: "#C23A3A", spikes: true,  armor: false },
  { n: "Refuso Fangoso",         c: "#A27B52", d: "#74532F", spikes: false, armor: false },
  { n: "Gran Refuso Corazzato",  c: "#5B5A72", d: "#33324A", spikes: true,  armor: true  },
];
function monsterSVG(m, size = 180, hurt = false) {
  const words = ["tacquino", "lezzione", "perchè", "qual'è", "squola"];
  let s = `<ellipse cx="100" cy="182" rx="56" ry="7" fill="#000" opacity=".08"/>`;
  if (m.spikes) s += [40, 62, 84, 106, 128, 150].map((x, i) => `<path d="M${x} ${70 - (i % 2) * 4} l10 -26 l10 26 Z" fill="${m.d}"/>`).join("");
  s += `<path d="M38 150 Q20 90 60 64 Q100 40 140 64 Q182 90 164 150 Q160 178 132 176 L120 168 L110 178 L100 168 L90 178 L80 168 L68 176 Q42 178 38 150 Z" fill="${m.c}" stroke="${m.d}" stroke-width="3"/>`;
  s += `<circle cx="60" cy="140" r="9" fill="${m.d}" opacity=".35"/><circle cx="146" cy="128" r="6" fill="${m.d}" opacity=".35"/><circle cx="128" cy="154" r="4" fill="${m.d}" opacity=".35"/>`;   // macchie d'inchiostro
  if (m.armor) s += `<path d="M58 122 Q100 108 142 122 L138 150 Q100 162 62 150 Z" fill="#9CA3B8" stroke="#33324A" stroke-width="2.5"/><path d="M80 118 L80 156 M100 114 L100 160 M120 118 L120 156" stroke="#33324A" stroke-width="1.5" opacity=".6"/>`;
  s += hurt ? `<path d="M64 90 l16 12 M80 90 l-16 12 M122 90 l16 12 M138 90 l-16 12" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`
            : `<ellipse cx="74" cy="96" rx="14" ry="16" fill="#fff"/><ellipse cx="128" cy="96" rx="14" ry="16" fill="#fff"/><circle cx="78" cy="100" r="7" fill="#2B2340"/><circle cx="124" cy="100" r="7" fill="#2B2340"/>` +
              `<path d="M58 74 L88 84 M144 74 L114 84" stroke="${m.d}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<path d="M70 124 Q100 ${hurt ? 116 : 140} 132 124" stroke="#2B2340" stroke-width="4" fill="${hurt ? "none" : "#2B2340"}" stroke-linejoin="round"/>`;
  if (!hurt) s += `<path d="M80 128 l5 8 l5 -6 M112 130 l5 6 l5 -8" fill="#fff"/>`;
  s += words.map((w, i) => `<text x="${[12, 150, 4, 160, 70][i]}" y="${[30, 24, 66, 60, 16][i]}" font-family="Georgia,serif" font-size="13" font-style="italic" fill="${m.d}" opacity=".55" transform="rotate(${[-12, 10, -6, 8, -3][i]} ${[12, 150, 4, 160, 70][i]} ${[30, 24, 66, 60, 16][i]})">${w}</text>`).join("");
  return `<svg class="monster${hurt ? " hit" : ""}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${m.n}">${s}</svg>`;
}
