// ============================================================
//  MISSIONE GRAMMATICA — motore dell'app v0.1
// ============================================================
"use strict";

const ALL_SKILLS = SKILLS.slice(), ALL_ITEMS = ITEMS.slice();
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const AR = Object.fromEntries(AREAS.map(a => [a.id, a]));
const IT = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const INTERVALS = [0, 1, 2, 4, 8, 16];          // giorni per scatola Leitner 0..5
const ALPHA = 0.25;                              // velocità media mobile padronanza
const MASTER_M = 0.85, MASTER_N = 8;             // soglia "abilità conquistata"
const RAFFICA_SEC = 75;

// ---------------- utilità ----------------
const $ = s => document.querySelector(s);
const app = () => $("#app");
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, "0");
function dayKey(d = new Date()) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function dayNum(d = new Date()) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
function keyToNum(k) { const [y, m, d] = k.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function levelOf(xp) { let L = 1; while (xp >= 50 * L * (L + 1)) L++; return L; }
function levelBounds(L) { return [L === 1 ? 0 : 50 * (L - 1) * L, 50 * L * (L + 1)]; }

// ---------------- stato ----------------
function freshState() {
  const skills = {};
  ALL_SKILLS.forEach(s => skills[s.id] = { m: 0, n: 0, c: 0, ever: false });
  return { v: 4, grade: "media", name: "", created: Date.now(), updatedAt: 0, diagDone: false, xp: 0, streak: 0, best: 0,
           freezes: 1, lastDay: null, sessions: 0, focus: null, skills, items: {}, days: {}, avatar: Object.assign({}, AVATAR_DEFAULT), line: "fuoco", hatchXp: 0, collection: [] };
}
let S = freshState();

// ---------------- classe: il catalogo si adatta a chi gioca ----------------
// Quarta elementare: niente modi, congiuntivo/condizionale, imperativo/participi/gerundi,
// né esercizi con termini che si fanno più avanti (relativi, partitivi, forma passiva…).
const GRADES = { media: "Scuola media", elem4: "Quarta elementare" };
const ELEM4_SKIP = new Set(["gr_modi", "gr_indef", "gr_cong"]);
const ELEM4_RX = /congiuntiv|condizional|gerundi|participi|relativ|partitiv|passiv|forma attiva|infinito passato|trapassato remoto|futuro anteriore/i;
function itemForGrade(i, g) {
  if (g !== "elem4") return true;
  return !ELEM4_SKIP.has(i.s) && !ELEM4_RX.test(i.q + " " + (i.o || []).join(" ") + " " + (i.c || []).join(" ") + " " + (i.hint || ""));
}
function applyGrade(g = S.grade || "media") {
  ITEMS.length = 0; ALL_ITEMS.forEach(i => { if (itemForGrade(i, g)) ITEMS.push(i); });
  SKILLS.length = 0; ALL_SKILLS.forEach(k => { if (g !== "elem4" || !ELEM4_SKIP.has(k.id)) SKILLS.push(k); });
}

// ---------------- profili: più bambini sullo stesso dispositivo ----------------
// Il primo profilo ("main") usa le chiavi di sempre, così i progressi esistenti non si spostano.
const PROF_KEY = "incanto-profili-v1";
const PICS = ["🍎", "🚀", "⭐", "🐱", "⚽", "🌈", "🎸", "🍕", "🌙"];
const Profiles = {
  reg: null,
  load() {
    try { this.reg = JSON.parse(localStorage.getItem(PROF_KEY) || "null"); } catch (e) { this.reg = null; }
    if (!this.reg || !Array.isArray(this.reg.list) || !this.reg.list.length) this.reg = { list: [{ id: "main", name: "" }], active: "main" };
    if (!this.reg.list.some(p => p.id === this.reg.active)) this.reg.active = this.reg.list[0].id;
    return this.reg;
  },
  save() { try { localStorage.setItem(PROF_KEY, JSON.stringify(this.reg)); } catch (e) {} },
  get active() { return this.reg ? this.reg.active : "main"; },
  many() { return !!this.reg && this.reg.list.length > 1; },
  entry(id = this.active) { return this.reg.list.find(p => p.id === id); },
  lsKey(id = this.active) { return id === "main" ? LS_KEY : LS_KEY + ":" + id; },
  docPath(id = this.active) { return id === "main" ? DOC_PATH : "progress/" + id; },
  file(id = this.active) { return id === "main" ? "progressi.json" : "progressi-" + id + ".json"; },
  readLocal(id) { try { const r = localStorage.getItem(this.lsKey(id)); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  // ricorda come appare il profilo (per la schermata «Chi gioca?»)
  touch() {
    if (!this.reg) return; const e = this.entry(); if (!e) return;
    const st = curStage();
    const meta = { name: S.name || e.name || "", grade: S.grade || "media", av: S.avatar, line: S.line, stage: st, lock: !!(S.secret && S.secret.length) };
    if (JSON.stringify(meta) !== JSON.stringify({ name: e.name, grade: e.grade, av: e.av, line: e.line, stage: e.stage, lock: e.lock })) { Object.assign(e, meta); this.save(); }
  },
  newId(name) {
    const base = (name || "profilo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 12) || "profilo";
    return base + "-" + Math.random().toString(36).slice(2, 5);
  },
};
function normalize(st) {   // aggiunge abilità nuove se la banca cresce
  const f = freshState();
  st = Object.assign(f, st);
  st.avatar = Object.assign({}, AVATAR_DEFAULT, st.avatar || {});
  if ((st.v || 1) < 2) {   // v0.3: tempi e cu/qu erano sovrastimati (solo esercizi a scelta)
    ["gr_tempi", "ort_q"].forEach(id => { const x = st.skills[id]; if (x && !x.ever) x.m = Math.min(x.m, 0.45); });
    if (st.focus && SK[st.focus] && AR[SK[st.focus].area].later) st.focus = null;
    st.v = 2;
  }
  if (st.v < 3) {   // v1.4: gli errori ancora da recuperare vengono riconosciuti anche nei progressi già esistenti
    const today = dayNum();
    Object.values(st.items || {}).forEach(it => { if (it.b <= 1 && it.c < it.n && it.lw === undefined) it.lw = today; });
    st.v = 3;
  }
  if (st.v < 4) {   // v1.9: linea del ghiaccio più lunga; si riscala la posizione per non perdere stadi né percentuale
    if (st.line === "ghiaccio" && typeof st.hatchXp === "number") { const cx = Math.max(0, st.xp - st.hatchXp); st.hatchXp = st.xp - cx * (LINES.ghiaccio.mult / 2); }
    st.v = 4;
  }
  ALL_SKILLS.forEach(s => { if (!st.skills[s.id]) st.skills[s.id] = { m: 0, n: 0, c: 0, ever: false }; });
  if (!st.grade) st.grade = "media";
  return st;
}

// ---------------- salvataggio (server + copia locale) ----------------
const LS_KEY = "missione-grammatica-v1";
const DOC_PATH = "progress/main";
const Store = {
  db: null, ref: null, writing: false, pending: false, timer: null, status: "locale",
  loadLocal() { return Profiles.readLocal(Profiles.active); },
  saveLocal() { try { localStorage.setItem(Profiles.lsKey(), JSON.stringify(S)); } catch (e) {} Profiles.touch(); },
  async connect(onRemote) {
    if (!(window.claude && typeof window.claude.use === "function")) return;
    try {
      const db = await window.claude.use("db");
      if (!db) return;
      this.db = db; this.ref = db.doc(Profiles.docPath());
      const snap = await Promise.race([this.ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000))]);
      this.status = "online";
      if (snap.exists) {
        const remote = snap.data();
        if (remote && (remote.updatedAt || 0) > (S.updatedAt || 0)) onRemote(JSON.parse(JSON.stringify(remote)));
        else if ((S.updatedAt || 0) > (remote.updatedAt || 0)) this.schedule();
      } else if (S.updatedAt) this.schedule();
    } catch (e) { this.status = "locale"; this.ref = null; }
    updateSyncBadge();
  },
  save() { S.updatedAt = Date.now(); this.saveLocal(); this.schedule(); },
  schedule() { if (!this.ref) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1200); },
  async flush() {
    if (!this.ref) return;
    if (this.writing) { this.pending = true; return; }
    this.writing = true;
    try { await this.ref.set(JSON.parse(JSON.stringify(S))); this.status = "online"; }
    catch (e) { this.status = (e && e.code === "invalid_argument") ? "sola lettura" : "locale"; if (e && e.code === "unavailable") setTimeout(() => this.schedule(), 3000); }
    this.writing = false; updateSyncBadge();
    if (this.pending) { this.pending = false; this.flush(); }
  },
};
function updateSyncBadge() { const b = $("#sync"); if (!b) return; const l = typeof Sync !== "undefined" && Sync.on() ? Sync.label() : ""; b.textContent = l || (Store.status === "online" ? "☁️ salvato" : "💾 salvato su questo dispositivo"); }

// ---------------- modello dello studente ----------------
const sk = id => S.skills[id];
const isMastered = id => sk(id).ever;
const compXp = (xp = S.xp) => Math.max(0, xp - (S.hatchXp || 0));
const curStage = (xp = S.xp) => stageOf(compXp(xp), S.line);
const curStages = () => stagesOf(S.line);
const pet = (size, uid, scene = true) => creatureSVG(S.avatar, curStage(), size, uid || "p", S.line, scene);
const iceBest = () => Math.max(S.iceBest || 0, S.line === "ghiaccio" ? curStage() : 0, (S.collection || []).some(c => c.line === "ghiaccio") ? FINAL_STAGE : 0);
const hasPerk = id => { const p = PERKS.find(x => x.id === id); return !!p && iceBest() >= p.stage; };
const canHatch = () => curStage() >= FINAL_STAGE && !!nextLine(S.line);
const todaySessions = () => (S.days[dayKey()] || {}).sess || 0;
const petName = () => S.avatar.name ? esc(S.avatar.name) : "il tuo compagno";
function isAvailable(id) {
  const s = sk(id);
  const solid = p => sk(p).ever || (sk(p).m >= 0.8 && sk(p).n >= 5);   // prerequisito "abbastanza solido"
  return s.ever || SK[id].pre.every(solid) || (s.m >= 0.8 && s.n >= 2);
}
const unseenCount = id => ITEMS.filter(i => i.s === id && !S.items[i.id]).length;
const hasNews = id => isMastered(id) && unseenCount(id) >= 5;   // abilità conquistata ma con esercizi nuovi da scoprire
const isErr = it => it && it.lw !== undefined && it.b <= 1;     // sbagliato e non ancora recuperato
const errItems = id => ITEMS.filter(i => i.s === id && isErr(S.items[i.id]));
const needsBoost = id => isMastered(id) && sk(id).m < 0.6 && errItems(id).length >= 2;   // conquistata, ma ora vacilla
// Lacuna principale dichiarata all'inizio: modi e tempi verbali. Hanno la precedenza (2 missioni su 3).
const CORE_SKILLS = ["gr_tempi", "gr_modi", "gr_aus", "gr_indef", "gr_cong"];
function suggestFocus() {
  if (S.focus && isAvailable(S.focus) && (!isMastered(S.focus) || hasNews(S.focus) || needsBoost(S.focus))) return S.focus;
  if (S.focusChosen && isMastered(S.focusChosen)) S.focusChosen = null;
  let cands = SKILLS.filter(s => isAvailable(s.id) && (!isMastered(s.id) || hasNews(s.id) || needsBoost(s.id)));
  const now = cands.filter(s => !AR[s.area].later);
  if (now.length) cands = now;
  if (!cands.length) return null;
  const core = cands.filter(s => CORE_SKILLS.includes(s.id));
  if (core.length && (S.log || []).slice(-3).filter(l => CORE_SKILLS.includes(l.f)).length < 2) {
    const p = id => needsBoost(id) ? sk(id).m - 1 : sk(id).m;
    return core.sort((a, b) => p(a.id) - p(b.id) || CORE_SKILLS.indexOf(a.id) - CORE_SKILLS.indexOf(b.id))[0].id;
  }
  // un'abilità conquistata con novità conta come "a metà strada": arriva dopo le lacune vere, ma non viene dimenticata
  const prio = id => needsBoost(id) ? sk(id).m - 1 : hasNews(id) ? 0.6 : sk(id).m;   // una base che vacilla passa davanti
  cands.sort((a, b) => prio(a.id) - prio(b.id) || SKILLS.indexOf(a) - SKILLS.indexOf(b));
  // rotazione tra le aree: sceglie l'area usata meno di recente, poi l'abilità più debole lì
  const hist = S.areaHist || (S.lastArea ? [S.lastArea] : []);
  const lastUse = a => hist.lastIndexOf(a);
  const best = cands.slice().sort((a, b) => lastUse(a.area) - lastUse(b.area))[0];
  return best.id;
}
// ---------- livelli di difficoltà: 1 base · 2 medio · 3 sfida ----------
const LV3 = new Set("h2 apo9 q9 dp6 dp14 dp15 dp29 dp32 cie7 cie10 cie17 cie19 cie22 cie23 z11 z12 z17 nom10 agg10 vb2 vb14 vb16 vb21 vb23 vb25 vb26 vb35 tp6 tp10 tp18 tp19 tp28 tp38 tp46 tp60 tp66 tp67 md20 md25 md30 md31 cg7 cg9 cg20 cg21 cg35 cg38 cg41 cg42 cg43 cg44 cg50 cg58 aus8 aus9 aus18 ind2 ind21 ind22 ind29 ind32 ind33 sg2 sg5 sg9 co2 co7 co8 pr8 pr9".split(" "));
function lvl(i) {
  if (i.lv) return i.lv;
  if (LV3.has(i.id)) return 3;
  if (i.t === "type") return 2;
  if (i.t === "pick") return (i.c || []).length <= 4 ? 1 : 2;
  return (i.o || []).length <= 2 ? 1 : 2;
}
const hardItems = id => ITEMS.filter(i => i.s === id && lvl(i) === 3);
const hardNeed = id => Math.min(2, hardItems(id).length);
const hardDone = id => hardItems(id).filter(i => S.items[i.id] && S.items[i.id].c > 0).length;
const hardOk = id => hardDone(id) >= hardNeed(id);
const hardMissing = id => Math.max(0, hardNeed(id) - hardDone(id));
const MIN_DISTINCT = 8;   // per conquistare un'abilità: almeno 8 esercizi diversi indovinati
const distinctDone = id => ITEMS.filter(i => i.s === id && S.items[i.id] && S.items[i.id].c > 0).length;
const distinctNeed = id => Math.min(MIN_DISTINCT, ITEMS.filter(i => i.s === id).length);
const distinctMissing = id => Math.max(0, distinctNeed(id) - distinctDone(id));
const SFIDA_XP = 5;   // una sfida giusta vale 15 XP invece di 10
function itemState(id) { return S.items[id] || (S.items[id] = { b: 0, due: 0, n: 0, c: 0 }); }

function record(item, ok, phase) {
  const today = dayNum(), it = itemState(item.id), s = sk(item.s);
  it.n++; if (ok) it.c++; else it.lw = today;   // lw = giorno dell'ultimo errore
  if (phase === "diag") { it.b = ok ? 2 : 1; it.due = today + (ok ? 2 : 1); }
  else { it.b = ok ? Math.min(5, it.b + 1) : 1; it.due = today + INTERVALS[it.b]; }
  s.n++; if (ok) s.c++;
  let newlyMastered = false;
  if (phase !== "diag") {
    s.m += ALPHA * ((ok ? 1 : 0) - s.m);
    if (!s.ever && s.m >= MASTER_M && s.n >= MASTER_N && hardOk(item.s) && !distinctMissing(item.s)) { s.ever = true; newlyMastered = true; }
  }
  const k = dayKey(); const d = S.days[k] || (S.days[k] = { xp: 0, ok: 0, tot: 0, sess: 0 });
  d.tot++; if (ok) d.ok++;
  // la prima sessione del giorno vale XP pieni, le successive metà: premia la costanza, non le abbuffate
  const factor = SESS && SESS.mode === "session" ? (SESS.factor || 1) : 1;
  const gain = ok ? Math.round((phase === "diag" ? 5 : 10 + (lvl(item) === 3 ? SFIDA_XP : 0)) * factor) : 0;   // nella raffica il bonus arriva dal combo
  S.xp += gain; d.xp += gain;
  return { gain, newlyMastered };
}

// ---------- combo: risposte giuste di fila ----------
// +1 per ogni risposta giusta, +2 se l'esercizio è da scrivere; un errore azzera (senza togliere XP).
function comboMult(c, phase) { return c >= 10 ? 2 : c >= 5 ? 1.5 : 1; }   // v1.9: combo meno generoso
function applyCombo(item, ok, phase, res) {
  if (!SESS || SESS.mode !== "session") return { mult: 1, bonus: 0, broke: 0 };
  const before = SESS.combo || 0;
  if (item.t === "type") { SESS.tTot = (SESS.tTot || 0) + 1; if (ok) SESS.tOk = (SESS.tOk || 0) + 1; }
  if (!ok) {
    SESS.perkLog = SESS.perkLog || [];
    if (before > 0 && hasPerk("regen") && !SESS.regenUsed) { SESS.regenUsed = true; SESS.perkLog.push("regen"); return { mult: 1, bonus: 0, broke: 0, saved: true }; }
    const keep = before > 1 && hasPerk("winter") ? Math.floor(before / 2) : 0;
    SESS.combo = keep; if (keep) SESS.perkLog.push("winter");
    return { mult: 1, bonus: 0, broke: keep ? 0 : before, halved: keep };
  }
  SESS.combo = before + (item.t === "type" ? 2 : 1);
  SESS.bestCombo = Math.max(SESS.bestCombo || 0, SESS.combo);
  const mult = comboMult(SESS.combo, phase), bonus = Math.round(res.gain * (mult - 1));
  if (bonus) { S.xp += bonus; SESS.xp += bonus; const d = S.days[dayKey()]; if (d) d.xp += bonus; }
  return { mult, bonus, broke: 0, up: comboMult(before, phase) < mult };
}
const comboPill = () => SESS && SESS.mode === "session" ? `<div class="pill combo ${(SESS.combo || 0) >= 3 ? "hot" : ""}" id="combo">🔥 <b>${SESS.combo || 0}</b>${comboMult(SESS.combo || 0, SESS.phases[SESS.pi] && SESS.phases[SESS.pi].key) > 1 ? ` ×${comboMult(SESS.combo, SESS.phases[SESS.pi].key)}` : ""}</div>` : "";
function finishDay() {  // aggiorna la serie di giorni (streak)
  const today = dayNum();
  if (S.lastDay === null) S.streak = 1;
  else {
    const last = keyToNum(S.lastDay);
    if (last === today) return { kept: true, usedFreeze: 0 };
    const gap = today - last - 1;
    if (gap === 0) S.streak++;
    else if (gap <= S.freezes) { S.freezes -= gap; S.streak++; S.lastDay = dayKey(); S.best = Math.max(S.best, S.streak); return { usedFreeze: gap }; }
    else S.streak = 1;
  }
  let weekly = false;
  if (S.streak % 7 === 0) { S.freezes = Math.min(2, S.freezes + 1); S.xp += 100; weekly = true; }
  S.lastDay = dayKey(); S.best = Math.max(S.best, S.streak);
  return { usedFreeze: 0, weekly };
}

// ---------------- costruzione della sessione ----------------
// ---------- bilanciamento della difficoltà (obiettivo ≈ 85% di risposte giuste) ----------
const TARGET_LOW = 0.70, TARGET_HIGH = 0.95, MAX_BOOSTS = 2;
const strongSkill = id => !AR[SK[id].area].later && isAvailable(id) && (isMastered(id) || sk(id).m >= 0.8);
function easyPool(used) {   // esercizi a scelta di abilità che padroneggia
  const pool = ITEMS.filter(i => i.t !== "type" && !used.has(i.id) && strongSkill(i.s));
  const known = pool.filter(i => S.items[i.id] && S.items[i.id].b >= 2);
  return shuffle(known.length >= 2 ? known : pool);
}
function buildSession() {
  const today = dayNum();
  const due = ITEMS.filter(i => S.items[i.id] && S.items[i.id].due <= today && isAvailable(i.s));
  const focus = suggestFocus();
  const fresh = shuffle(ITEMS.filter(i => !S.items[i.id] && isMastered(i.s) && i.s !== focus && strongSkill(i.s))).slice(0, 2);
  const errs = shuffle(due.filter(i => isErr(S.items[i.id]))), others = shuffle(due.filter(i => !isErr(S.items[i.id])));
  const review = interleave(errs.concat(others).slice(0, 6).concat(fresh));
  const used = new Set(review.map(i => i.id));
  const warm = interleave(easyPool(new Set([...used, ...ITEMS.filter(i => i.s === focus).map(i => i.id)]))).slice(0, 2);
  warm.forEach(i => used.add(i.id));
  const phases = [];
  if (warm.length) phases.push({ key: "riscaldamento", label: "🌤️ Riscaldamento", items: warm });
  if (review.length) phases.push({ key: "ripasso", label: "🔁 Ripasso", items: review });
  if (focus) {
    S.focus = focus;
    const pool = ITEMS.filter(i => i.s === focus && !used.has(i.id));
    const unseen = pool.filter(i => !S.items[i.id]);
    const seen = pool.filter(i => S.items[i.id]).sort((a, b) => S.items[a.id].b - S.items[b.id].b || S.items[a.id].due - S.items[b.id].due);
    // prima si riconosce (scelta), poi si scrive: almeno 2-3 esercizi da scrivere quando ci sono
    const boost = needsBoost(focus);
    // livello bersaglio: chi parte da zero vede prima gli esercizi base, chi è quasi pronto le sfide
    const m = sk(focus).m, target = m < 0.4 ? 1 : m < 0.7 ? 2 : 3;
    const byLv = arr => arr.map((i, k) => [i, k]).sort((a, b) => Math.abs(lvl(a[0]) - target) - Math.abs(lvl(b[0]) - target) || a[1] - b[1]).map(x => x[0]);
    unseen.splice(0, unseen.length, ...byLv(unseen));
    if (!isMastered(focus) && m >= 0.7 && !hardOk(focus)) {   // è pronta, ma mancano le sfide: le mette davanti
      const ch = pool.filter(i => lvl(i) === 3 && !(S.items[i.id] && S.items[i.id].c > 0));
      const chSet = new Set(ch.map(i => i.id));
      const rest = unseen.filter(i => !chSet.has(i.id));
      unseen.splice(0, unseen.length, ...ch, ...rest);
      seen.splice(0, seen.length, ...seen.filter(i => !chSet.has(i.id)));
    }
    const ordered = boost ? seen.filter(i => isErr(S.items[i.id])).concat(unseen, seen.filter(i => !isErr(S.items[i.id]))) : unseen.concat(seen);
    const typedAll = ordered.filter(i => i.t === "type"), restAll = ordered.filter(i => i.t !== "type");
    let typed = typedAll.slice(0, 3), rest = restAll.slice(0, 5 - typed.length);
    if (typed.length + rest.length < 5) typed = typedAll.slice(0, 5 - rest.length);
    let pick = rest.concat(typed).slice(0, 5);
    if (boost) {   // nel rinforzo si parte dagli errori, poi si completa con il resto
      const e = ordered.filter(i => isErr(S.items[i.id])).slice(0, 4);
      pick = e.concat(pick.filter(i => !e.includes(i))).slice(0, 5);
    }
    pick.forEach(i => used.add(i.id));
    phases.push({ key: "nuovo", label: (boost ? "🔁 Rinforzo: " : "🧭 Missione: ") + SK[focus].name, skill: focus, items: pick, lessonShown: false });
  }
  const duelNow = duelReady() && todaySessions() === 0;
  phases.push(duelNow ? { key: "duello", label: "⚔️ Duello" } : { key: "raffica", label: "⚡ Raffica finale" });
  return { mode: "session", phases, pi: 0, qi: 0, retried: new Set(), ok: 0, tot: 0, xp: 0, mastered: [], start: Date.now(), focus,
           factor: todaySessions() === 0 ? 1 : todaySessions() === 1 ? 0.5 : 0.25,
           used, boosts: 0, lastAdjust: -10, adjust: [],
           xpBefore: S.xp, availBefore: SKILLS.filter(s => isAvailable(s.id)).map(s => s.id) };
}
// Prima di ogni domanda: se sta sbagliando troppo, inserisce un esercizio facile e
// trasforma il prossimo "da scrivere" in uno "a scelta"; se va benissimo, alza il livello.
function balance(ph) {
  if (SESS.mode !== "session" || SESS.tot < 4 || SESS.tot - SESS.lastAdjust < 3) return;
  if (ph.key !== "ripasso" && ph.key !== "nuovo") return;
  const acc = SESS.ok / SESS.tot, rest = ph.items.slice(SESS.qi);
  if (acc < TARGET_LOW && SESS.boosts < MAX_BOOSTS) {
    let changed = false;
    const easy = easyPool(SESS.used)[0];
    if (easy) { ph.items.splice(SESS.qi, 0, easy); SESS.used.add(easy.id); changed = true; }
    if (ph.key === "nuovo") {
      const k = ph.items.findIndex((i, j) => j > SESS.qi && i.t === "type");
      const alt = ITEMS.find(i => i.s === ph.skill && i.t !== "type" && !SESS.used.has(i.id));
      if (k > 0 && alt) { ph.items[k] = alt; SESS.used.add(alt.id); changed = true; }
    }
    SESS.lastAdjust = SESS.tot;
    if (changed) { SESS.boosts++; SESS.adjust.push("giu"); }
  } else if (acc > TARGET_HIGH && SESS.tot >= 5 && ph.key === "nuovo") {
    const k = ph.items.findIndex((i, j) => j >= SESS.qi && i.t !== "type");
    const alt = ITEMS.find(i => i.s === ph.skill && i.t === "type" && !SESS.used.has(i.id));
    if (k >= 0 && alt) { ph.items[k] = alt; SESS.used.add(alt.id); SESS.lastAdjust = SESS.tot; SESS.adjust.push("su"); }
  }
}
function interleaveTypes(a, b) {   // alterna scelta e scrittura: prima si riconosce, poi si scrive
  const out = []; while (a.length || b.length) { if (a.length) out.push(a.shift()); if (b.length) out.push(b.shift()); } return out;
}
function interleave(arr) {   // evita due esercizi consecutivi della stessa abilità
  const out = [], rest = arr.slice();
  while (rest.length) {
    const prev = out.length ? out[out.length - 1].s : null;
    let k = rest.findIndex(i => i.s !== prev); if (k < 0) k = 0;
    out.push(rest.splice(k, 1)[0]);
  }
  return out;
}
// Raffica: mazzo pesato. Più spazio a errori recenti, esercizi medi/sfida e novità;
// poco spazio a quelli ormai saputi; niente ripetizioni dall'ultima raffica; ~1 su 5 facile, per il ritmo.
const RAFFICA_DECK = 40;
function rafficaWeight(i) {
  const it = S.items[i.id], L = lvl(i);
  let w = L === 3 ? 1.1 : L === 2 ? 1.3 : 1;
  if (!it) return w * (isMastered(i.s) ? 1.5 : 1);   // mai visto
  if (isErr(it)) return w * 4;                       // sbagliato e non ancora recuperato
  if (it.b >= 4) return w * 0.25;                    // indovinato più volte di fila: lo sa
  if (it.b === 3) return w * 0.6;
  return w * 1.5;
}
function weightedPick(arr, n) {
  const a = arr.map(i => ({ i, k: Math.pow(Math.random(), 1 / Math.max(0.01, rafficaWeight(i))) }));   // estrazione pesata senza reinserimento
  return a.sort((x, y) => y.k - x.k).slice(0, n).map(x => x.i);
}
function rafficaPool(sess) {
  const quick = i => i.t !== "type";
  let cand = ITEMS.filter(i => quick(i) && isAvailable(i.s));
  if (cand.length < 4) cand = ITEMS.filter(quick);
  const recent = new Set(S.lastRaffica || []);
  const fresh = cand.filter(i => !recent.has(i.id));
  if (fresh.length >= 30) cand = fresh;
  const errs = shuffle(cand.filter(i => isErr(S.items[i.id]))).slice(0, 6);   // gli errori da recuperare entrano sempre
  const errSet = new Set(errs.map(i => i.id)); cand = cand.filter(i => !errSet.has(i.id));
  const easy = cand.filter(i => lvl(i) === 1), hard = cand.filter(i => lvl(i) > 1);
  const nEasy = Math.min(easy.length, Math.round(RAFFICA_DECK / 5));
  const E = weightedPick(easy, nEasy), H = shuffle(errs.concat(weightedPick(hard, RAFFICA_DECK - nEasy - errs.length))).slice(0, RAFFICA_DECK - E.length);
  const deck = [];   // un facile ogni 5, il resto pesato
  while (E.length || H.length) { for (let k = 0; k < 4 && H.length; k++) deck.push(H.shift()); if (E.length) deck.push(E.shift()); }
  return interleave(deck);
}

// ---------------- schermate ----------------
let SESS = null;
function header(extra = "") {
  const L = levelOf(S.xp), [lo, hi] = levelBounds(L);
  return `<header class="top">
    ${Profiles.many() ? `<button class="pill who" id="who" type="button" title="Cambia giocatore">👤 <b>${esc(S.name || "?")}</b> ⇄</button>` : ""}
    <div class="pill">🔥 <b>${S.streak}</b></div>
    <div class="pill">⭐ <b>${S.xp}</b> XP</div>
    <div class="pill lv">Liv. <b>${L}</b><span class="mini"><i style="width:${Math.round((S.xp - lo) / (hi - lo) * 100)}%"></i></span></div>
    ${extra}
  </header>`;
}

function renderOnboarding() {
  app().innerHTML = `<section class="card center hero">
    <div class="wob petbox">${creatureSVG(S.avatar, 0, 150)}</div>
    <h1>Incanto Parolum</h1><p class="motto">la scuola di magia delle parole</p>
    <p>Ogni giorno <b>10 minuti</b>. Ogni risposta giusta fa crescere il tuo compagno misterioso. Che cosa uscirà dall'uovo?</p>
    <label class="lbl">Come ti chiami?</label>
    <input id="nm" class="inp" maxlength="20" placeholder="Il tuo nome" autocomplete="off" value="${esc(S.name || "")}">
    <p class="muted">Prima facciamo una <b>prova di partenza</b>: ${ITEMS.filter(i => i.d && !AR[SK[i.s].area].later).length} domande veloci per capire da dove iniziare. Non è un compito in classe: niente voti!</p>
    <button class="btn primary" id="go">Iniziamo! 🚀</button>
    <p><button class="btn ghost small" id="restore">🔄 Ho già dei progressi su un altro dispositivo</button></p>
  </section>`;
  $("#restore").onclick = renderParentGate;
  const go = () => { S.name = ($("#nm").value || "").trim() || "Esploratore"; Store.save(); startDiagnostic(); };
  $("#go").onclick = go; $("#nm").onkeydown = e => { if (e.key === "Enter") go(); };
  $("#nm").focus();
}

function startDiagnostic() {
  const byArea = AREAS.filter(a => !a.later).map(a => shuffle(ITEMS.filter(i => i.d && SK[i.s].area === a.id)));
  const items = []; let k = 0;
  while (byArea.some(x => x.length)) { const b = byArea[k % byArea.length]; if (b.length) items.push(b.shift()); k++; }
  SESS = { mode: "diag", phases: [{ key: "diag", label: "🧪 Prova di partenza", items }], pi: 0, qi: 0, retried: new Set(), ok: 0, tot: 0, xp: 0, mastered: [], start: Date.now(), diagRes: {} };
  next();
}

function finishDiagnostic() {
  SKILLS.forEach(s => {
    const r = SESS.diagRes[s.id] || { ok: 0, tot: 0 };
    const x = sk(s.id);
    x.m = r.tot === 0 ? 0 : r.ok === r.tot ? 0.8 : r.ok > 0 ? 0.45 : 0.15;
  });
  S.diagDone = true; S.sessions++;
  const d = S.days[dayKey()] || (S.days[dayKey()] = { xp: 0, ok: 0, tot: 0, sess: 0 }); d.sess++;
  finishDay(); Store.save(); Sync.push("prova di partenza");
  const rows = AREAS.filter(a => !a.later).map(a => {
    const list = SKILLS.filter(s => s.area === a.id).map(s => {
      const r = SESS.diagRes[s.id] || { ok: 0, tot: 0 };
      const lab = r.ok === r.tot ? "<span class='tag ok'>forte 💪</span>" : r.ok > 0 ? "<span class='tag mid'>da allenare</span>" : "<span class='tag lo'>da costruire</span>";
      return `<li>${s.icon} ${esc(s.name)} ${lab}</li>`;
    }).join("");
    return `<div class="diag-area" style="--c:${a.color};--s:${a.soft}"><h3>${a.name}</h3><ul>${list}</ul></div>`;
  }).join("");
  app().innerHTML = header() + `<section class="card center">
    <div class="wob petbox">${pet(150)}</div>
    <h2>Prova completata, ${esc(S.name)}!</h2>
    <p>Hai risposto bene a <b>${SESS.ok} su ${SESS.tot}</b>. Ecco la tua mappa di partenza:</p>
    <div class="diag-grid">${rows}</div>
    <p class="muted">L'uovo ha sentito le tue risposte… Torna domani per la prima missione vera, oppure inizia subito!</p>
    <div class="row"><button class="btn" id="home">Vai alla base</button><button class="btn primary" id="sess">Prima missione ▶</button></div>
  </section>`;
  $("#home").onclick = renderHome; $("#sess").onclick = startSession;
}

function renderHome() {
  if (Sync.on()) Sync.push("modifiche");
  SESS = null;
  const si = curStage(), STG = curStages(), st = STG[si], nxt = STG[si + 1], cx = compXp();
  const doneToday = S.lastDay === dayKey();
  const focus = suggestFocus();
  const dueN = ITEMS.filter(i => S.items[i.id] && S.items[i.id].due <= dayNum() && isAvailable(i.s)).length;
  const mastered = SKILLS.filter(s => isMastered(s.id)).length;
  const prog = nxt ? Math.max(0, Math.min(100, Math.round((cx - st.xp) / (nxt.xp - st.xp) * 100))) : 100;
  const newItems = newSince(S.avatar.seenLevel || 1, levelOf(S.xp)).length;
  const powers = SKILLS.filter(s => isMastered(s.id));
  const energy = todaySessions() === 0 ? `<div class="pill energy full" title="La prima missione del giorno vale XP pieni">⚡ Carica piena</div>` : `<div class="pill energy" title="La seconda missione di oggi vale metà XP, le successive un quarto">${todaySessions() === 1 ? "🔋 Mezza carica" : "🪫 Carica bassa"}</div>`;
  app().innerHTML = header(`<div class="pill">🧊 ${S.freezes}</div>${energy}`) + `
  <section class="card center pet">
    <div class="float petbox">${pet(190)}</div>
    <h2>${S.avatar.name ? esc(S.avatar.name) + " · " : ""}${esc(st.n)}</h2>
    ${nxt ? `<div class="bar"><i style="width:${prog}%"></i></div><p class="muted">Ancora <b>${nxt.xp - cx} XP</b> e si evolverà in… <b>???</b></p>`
          : canHatch() ? `<button class="btn primary hatch" id="hatch">🥚 Hai trovato un uovo misterioso!</button>` : `<p class="muted">Forma finale raggiunta! 🏆</p>`}
    <div class="powers">${powers.length ? powers.map(s => `<span class="pw" title="${esc(powerOf(s.id).name)}: ${esc(powerOf(s.id).d)}">${powerOf(s.id).icon}</span>`).join("") : ""}<span class="pw-n">${powers.length}/${SKILLS.length} poteri</span></div>
    <button class="btn" id="shop">🛠️ Tana del drago${newItems ? ` <span class="badge">${newItems} nuovi!</span>` : ""}</button>
  </section>
  ${duelReady() ? `<section class="card duel-banner"><div>${monsterSVG(weekMonster(), 64)}</div><div><b>⚔️ ${esc(weekMonster().n)} ti sfida!</b><br><small>${todaySessions() === 0 ? "Lo affronterai alla fine della lezione di oggi, al posto della raffica." : "Lo affronterai alla fine della prima lezione di domani."}</small></div></section>` : ""}
  <section class="card">
    <p class="hi">Ciao <b>${esc(S.name)}</b>! ${doneToday ? "Missione di oggi completata ✅ Se vuoi, puoi fare un'altra lezione di ripasso." : S.streak > 0 ? `La tua serie è a <b>${S.streak}</b> ${S.streak === 1 ? "giorno" : "giorni"}: non spezzarla! 🔥` : "Pronto per la missione di oggi?"}</p>
    <div class="mission">
      <div><small>Prossima missione</small><b>${focus ? SK[focus].icon + " " + esc(SK[focus].name) : "Ripasso generale"}</b></div>
      <div><small>Ripassi in attesa</small><b>${dueN}</b></div>
      <div><small>Abilità conquistate</small><b>${mastered} / ${SKILLS.length}</b></div>
    </div>
    <button class="btn primary big" id="start">${doneToday ? "Un'altra lezione ▶" : "Inizia la missione di oggi ▶"}</button>
    <div class="row"><button class="btn" id="map">🗺️ Mappa</button><button class="btn ghost" id="par">👤 Area genitori</button></div>
  </section>
  <p class="foot"><span id="sync"></span> · v2.1</p>`;
  $("#start").onclick = startSession; $("#shop").onclick = () => renderDen(); if ($("#hatch")) $("#hatch").onclick = renderHatch; $("#map").onclick = renderMap; $("#par").onclick = renderParentGate;
  updateSyncBadge();
}

// v1.9.1: «Torna alla base» anche in alto (resta visibile scorrendo): Nicola non deve scendere fino in fondo
const backTop = () => `<div class="back-top-wrap"><button class="btn back-top" type="button">← Torna alla base</button></div>`;
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("#who") && !SESS) { renderWho(); return; }
  if (!e.target.closest || !e.target.closest(".back-top")) return;
  const b = document.querySelector("#back") || document.querySelector("#home"); if (b) b.click();
});
function renderMap() {
  const focus = suggestFocus();
  const cols = AREAS.map(a => {
    const nodes = SKILLS.filter(s => s.area === a.id).map(s => {
      const x = sk(s.id), av = isAvailable(s.id), ms = isMastered(s.id);
      const pct = Math.round(Math.min(x.m, ms ? 1 : x.m) * 100);
      const cls = ms ? "done" : av ? "open" : "locked";
      const news = hasNews(s.id), weak = needsBoost(s.id);
      const badge = s.id === focus ? "🎯" : weak ? "🔁" : news ? "✨" : ms ? "⭐" : av ? "▶" : "🔒";
      const req = !av ? `<small>Prima: ${s.pre.map(p => SK[p].name).join(", ")}</small>` : weak ? `<small class="news">🔁 da rinforzare</small>` : !ms && x.m >= 0.7 && (hardMissing(s.id) || distinctMissing(s.id)) ? `<span class="bar thin"><i style="width:${pct}%"></i></span><small class="news">${[hardMissing(s.id) ? `🔥 mancano ${hardMissing(s.id)} ${hardMissing(s.id) === 1 ? "sfida" : "sfide"}` : "", distinctMissing(s.id) ? `🧩 ${distinctMissing(s.id)} esercizi nuovi da superare` : ""].filter(Boolean).join(" · ")}</small>` : news ? `<small class="news">✨ ${unseenCount(s.id)} esercizi nuovi</small>` : `<span class="bar thin"><i style="width:${pct}%"></i></span>`;
      return `<button class="node ${cls} ${s.id === focus ? "focus" : ""}" data-id="${s.id}" ${av ? "" : "disabled"}>
        <span class="ni">${s.icon}</span><span class="nt"><b>${esc(s.name)}</b>${req}</span><span class="nb">${badge}</span></button>`;
    }).join("");
    return `<div class="col" style="--c:${a.color};--s:${a.soft}"><h3>${a.name}</h3>${a.later ? `<p class="later">👀 Anteprima: la farai in classe più avanti. Puoi provarla quando vuoi!</p>` : ""}${nodes}</div>`;
  }).join("");
  app().innerHTML = header() + `<section class="card">${backTop()}
    <h2>🗺️ La mappa delle abilità</h2>
    <p class="muted">Tocca un'abilità aperta per sceglierla come prossima missione. ⭐ = conquistata · ✨ = conquistata, ma con esercizi nuovi · 🔁 = conquistata, ma da rinforzare · 🔥 = per conquistarla servono le sfide · 🎯 = missione attuale · 🔒 = si apre dopo.</p>
    <div class="map">${cols}</div>
    <button class="btn" id="back">← Torna alla base</button>
  </section><div id="toast"></div>`;
  document.querySelectorAll(".node.open, .node.done").forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (isMastered(id) && !hasNews(id) && !needsBoost(id)) { toast("Questa l'hai già conquistata! ⭐ La ripasserai ogni tanto."); return; }
    S.focus = id; S.focusChosen = id; Store.save(); renderMap(); toast("Missione scelta: " + SK[id].name + " 🎯");
  });
  $("#back").onclick = renderHome;
}
function toast(msg) { const t = $("#toast"); if (!t) return; t.textContent = msg; t.className = "show"; clearTimeout(t._h); t._h = setTimeout(() => t.className = "", 2200); }

// ---------------- flusso esercizi ----------------
function startSession() { SESS = buildSession(); next(); }

function next() {
  const ph = SESS.phases[SESS.pi];
  if (!ph) return SESS.mode === "diag" ? finishDiagnostic() : finishSession();
  if (ph.key === "raffica") return rafficaIntro();
  if (ph.key === "duello") return duelIntro();
  if (ph.key === "nuovo" && !ph.lessonShown) return showLesson(ph);
  if (SESS.qi >= ph.items.length) { SESS.pi++; SESS.qi = 0; return next(); }
  balance(ph);
  showQuestion(ph.items[SESS.qi], ph);
}

function sessHeader(ph, frac) {
  const total = SESS.phases.length;
  return `<header class="top sess">
    <button class="x" id="quit" title="Esci">✕</button>
    <div class="phase">${ph.label}${SESS.mode === "session" ? ` <small>· fase ${SESS.pi + 1}/${total}</small>` : ""}</div>
    ${comboPill()}<div class="pill">⭐ ${S.xp}</div>
  </header><div class="bar prog"><i style="width:${Math.round(frac * 100)}%"></i></div>`;
}
function bindQuit() { $("#quit").onclick = () => { keyHandler = null; Store.save(); SESS = null; boot(); }; }

function showLesson(ph) {
  const s = SK[ph.skill], a = AR[s.area];
  app().innerHTML = sessHeader(ph, 0) + `<section class="card lesson" style="--c:${a.color};--s:${a.soft}">
    <div class="lesson-h"><span class="ni">${s.icon}</span><div><small>${a.name}</small><h2>${esc(s.name)}</h2></div></div>
    <div class="rule"><span class="formula">📜 Formula</span>${s.rule}</div>
    <ul class="ex">${s.ex.map(e => `<li>${e}</li>`).join("")}</ul>
    ${Object.entries(TRAPS).filter(([k, t]) => t.s.includes(s.id)).map(([k, t]) => `<div class="trap">⚠️ <b>Trappola: ${t.t}</b><br>${t.d}</div>`).join("")}
    <button class="btn primary big" id="ok">Ho capito, mettimi alla prova! ▶</button>
  </section>`;
  bindQuit();
  const go = () => { ph.lessonShown = true; next(); };
  $("#ok").onclick = go; keyHandler = e => { if (e.key === "Enter") go(); };
}

const canSpeak = (() => { try { return "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function"; } catch (e) { return false; } })();
function speak(text) {
  if (!canSpeak) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "it-IT"; u.rate = 0.8;
    const v = speechSynthesis.getVoices().find(v => /^it/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
const normAns = s => String(s).toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim().replace(/[.!?,;:]+$/, "");
function renderItemBody(item) {
  if (item.t === "type") {
    const q = esc(item.q).replace("___", `<span class="blank">&nbsp;?&nbsp;</span>`);
    return `<p class="q cloze">${q}</p>
      ${item.hint || !S.items[item.id] ? `<p class="hint">💡 ${item.hint ? esc(item.hint) : ""}${!S.items[item.id] ? `${item.hint ? " · " : ""}inizia con «${esc(item.a[0][0])}»` : ""}</p>` : ""}
      <div class="typebox">
        ${item.say && canSpeak ? `<button class="btn say" id="say" title="Ascolta">🔊 Ascolta</button>` : ""}
        <input id="ans" class="inp ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Scrivi qui…">
        <button class="btn primary" id="check">Controlla</button>
      </div>
      <div class="accents">${["à", "è", "é", "ì", "ò", "ù", "'"].map(c => `<button class="acc" data-c="${c}">${c}</button>`).join("")}</div>`;
  }
  if (item.t === "pick") {
    return `<p class="q">${esc(item.q)}</p><div class="chunks">${item.c.map((c, i) => `<button class="chunk" data-i="${i}">${esc(c)}</button>`).join("")}</div>`;
  }
  const opts = shuffle(item.o);
  const q = item.t === "cloze" ? esc(item.q).replace("___", `<span class="blank">&nbsp;?&nbsp;</span>`) : esc(item.q);
  return `<p class="q ${item.t === "cloze" ? "cloze" : ""}">${q}</p>
    <div class="opts">${opts.map((o, i) => `<button class="opt" data-v="${esc(o)}"><kbd>${i + 1}</kbd>${esc(o)}</button>`).join("")}</div>`;
}

let keyHandler = null;
document.addEventListener("keydown", e => { if (keyHandler) keyHandler(e); });

function showQuestion(item, ph) {
  const s = SK[item.s], a = AR[s.area];
  const frac = ph.items.length ? SESS.qi / ph.items.length : 0;
  app().innerHTML = sessHeader(ph, frac) + `<section class="card qcard" style="--c:${a.color};--s:${a.soft}">
    <div class="qtag">${s.icon} ${esc(s.name)}</div>${lvl(item) === 3 ? `<span class="qtag sfida">🔥 Sfida</span>` : ""}
    ${renderItemBody(item)}
    ${mirrorOk(item, ph) ? `<button class="btn perk" id="mirror">🪞 Specchio di ghiaccio <small>(1 per lezione)</small></button>` : ""}
    <div id="fb"></div>
  </section>`;
  bindQuit();
  if ($("#mirror")) $("#mirror").onclick = () => {
    SESS.mirrorUsed = true; (SESS.perkLog = SESS.perkLog || []).push("mirror"); $("#mirror").remove();
    if (item.t === "type") { const n = Math.max(2, Math.ceil(item.a[0].length / 3)); const h = document.querySelector(".hint");
      const txt = `🪞 inizia con «${esc(item.a[0].slice(0, n))}»`; if (h) h.innerHTML += " · " + txt; else $("#ans").insertAdjacentHTML("beforebegin", `<p class="hint">${txt}</p>`); $("#ans").focus(); return; }
    const sel = item.t === "pick" ? [...document.querySelectorAll(".chunk")].filter(b => Number(b.dataset.i) !== item.a) : [...document.querySelectorAll(".opt")].filter(b => b.dataset.v !== item.o[0]);
    const w = sel[Math.floor(Math.random() * sel.length)]; if (w) { w.disabled = true; w.classList.add("gone"); }
  };
  let answered = false;
  const answer = (ok, el, typed) => {
    if (answered) return; answered = true;
    SESS.tot++; if (ok) SESS.ok++;
    if (SESS.mode === "diag") { const r = SESS.diagRes[item.s] || (SESS.diagRes[item.s] = { ok: 0, tot: 0 }); r.tot++; if (ok) r.ok++; }
    const res = record(item, ok, ph.key);
    SESS.xp += res.gain;
    const cb = applyCombo(item, ok, ph.key, res);
    if ($("#combo")) $("#combo").outerHTML = comboPill();
    if (res.newlyMastered) SESS.mastered.push(item.s);
    if (!ok && ((ph.key === "nuovo" && item.s === ph.skill) || ph.key === "ripasso" || ph.key === "riscaldamento") && !SESS.retried.has(item.id)) { SESS.retried.add(item.id); ph.items.push(item); }
    markAnswer(item, ok, el);
    Store.save();
    const fb = $("#fb");
    fb.className = "fb " + (ok ? "good" : "bad");
    fb.innerHTML = `<div class="fb-t">${ok ? pickPraise() + ` <span class="gain">+${res.gain + cb.bonus} XP</span>${cb.mult > 1 ? ` <span class="cmb">combo ×${cb.mult}</span>` : ""}` : "Non proprio…"}</div>
      ${cb.broke >= 3 ? `<p class="soft">🔥 Serie da ${cb.broke} interrotta: ripartiamo, ce la fai! 💪</p>` : ""}
      ${cb.saved ? `<p class="soft">💧 <b>Rigenerazione</b>: il tuo compagno ha salvato il combo!</p>` : ""}
      ${cb.halved ? `<p class="soft">❄️ <b>Inverno eterno</b>: il combo scende a ${cb.halved} invece di azzerarsi.</p>` : ""}
      ${ok ? (SESS.mode === "diag" ? "" : `<p>${item.x}</p>`) : errorFeedback(item, typed, SESS.mode === "diag")}
      ${res.newlyMastered ? `<p class="mastered">✨ Incantesimo appreso: <b>${esc(s.name)}</b>! Nel Grimorio: ${powerOf(item.s).icon} <b>${esc(powerOf(item.s).name)}</b></p>` : ""}
      <button class="btn ${ok ? "primary" : "warn"}" id="cont">Continua ▶</button>`;
    const go = () => { SESS.qi++; next(); };
    $("#cont").onclick = go;
    if (!ok && SESS.mode !== "diag") armContinue(item, go);
    else { $("#cont").focus(); keyHandler = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }; }
  };
  wireAnswers(item, answer);
}

function wireAnswers(item, answer) {
  if (item.t === "type") {
    const inp = $("#ans");
    const submit = () => { const v = inp.value; if (!v.trim()) { inp.focus(); return; } inp.disabled = true; answer(item.a.some(a => normAns(a) === normAns(v)), inp, v); };
    $("#check").onclick = submit;
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); } };
    document.querySelectorAll(".acc").forEach(b => b.onclick = () => { const p = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, p) + b.dataset.c + inp.value.slice(inp.selectionEnd ?? p); inp.focus(); inp.setSelectionRange(p + 1, p + 1); });
    if ($("#say")) $("#say").onclick = () => { speak(item.say); inp.focus(); };
    keyHandler = null; setTimeout(() => inp.focus(), 50);
    return;
  }
  if (item.t === "pick") {
    document.querySelectorAll(".chunk").forEach(b => b.onclick = () => answer(Number(b.dataset.i) === item.a, b));
    keyHandler = e => { const n = Number(e.key); if (n >= 1 && n <= item.c.length) document.querySelectorAll(".chunk")[n - 1].click(); };
  } else {
    const bs = document.querySelectorAll(".opt");
    bs.forEach(b => b.onclick = () => answer(b.dataset.v === item.o[0], b));
    keyHandler = e => { const n = Number(e.key); if (n >= 1 && n <= bs.length) bs[n - 1].click(); };
  }
}
function correctText(item) { return item.t === "pick" ? item.c[item.a] : item.t === "type" ? item.a[0] : item.o[0]; }
function markAnswer(item, ok, el) {
  if (item.t === "type") {
    const inp = $("#ans"); if (inp) inp.classList.add(ok ? "right" : "wrong");
    document.querySelectorAll(".acc, #check").forEach(b => b.disabled = true);
    const bl = document.querySelector(".blank"); if (bl) { bl.textContent = item.a[0]; bl.classList.add(ok ? "right" : "fixed"); }
    return;
  }
  document.querySelectorAll(".opt, .chunk").forEach(b => {
    b.disabled = true;
    const right = item.t === "pick" ? Number(b.dataset.i) === item.a : b.dataset.v === item.o[0];
    if (right) b.classList.add("right");
  });
  if (!ok && el) el.classList.add("wrong");
  const bl = document.querySelector(".blank"); if (bl) { bl.textContent = item.o[0]; bl.classList.add(ok ? "right" : "fixed"); }
}
const PRAISE = ["Esatto!", "Perfetto!", "Grande!", "Bravo!", "Giusto!", "Ottimo!", "Così si fa!"];
const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

// ---------------- raffica a tempo ----------------
function rafficaIntro() {
  const ph = SESS.phases[SESS.pi];
  app().innerHTML = sessHeader(ph, 0) + `<section class="card center">
    <div class="big-emoji">⚡</div><h2>Raffica finale!</h2>
    <p>Hai <b>${rafficaDur()} secondi</b>${hasPerk("breath") ? " (🌬️ +10 dal Respiro gelido)" : ""}. Ogni risposta giusta vale <b>10 XP</b>, e con il <b>combo</b> fino a ×2. Non sbagliare per non spezzare la serie!</p>
    <button class="btn primary big" id="go">Via! ⏱️</button></section>`;
  bindQuit();
  $("#go").onclick = startRaffica; keyHandler = e => { if (e.key === "Enter") startRaffica(); };
}
function startRaffica() {
  const ph = SESS.phases[SESS.pi];
  const pool = rafficaPool(SESS);
  let deck = pool.slice(), last = null, ended = false, busy = false;
  const t0 = Date.now(), DUR = rafficaDur(); SESS.rOk = 0; SESS.rTot = 0; if (hasPerk("breath")) (SESS.perkLog = SESS.perkLog || []).push("breath");
  SESS.rSeen = [];
  const draw = () => { if (!deck.length) deck = rafficaPool(SESS); let it = deck.shift(); if (it === last && deck.length) { deck.push(it); it = deck.shift(); } last = it; SESS.rSeen.push(it.id); return it; };
  const mySess = SESS;
  const tick = setInterval(() => {
    if (SESS !== mySess) { clearInterval(tick); return; }
    const left = Math.max(0, DUR - (Date.now() - t0) / 1000);
    const bar = $(".timer i"); if (bar) bar.style.width = (left / DUR * 100) + "%";
    const tx = $(".timer b"); if (tx) tx.textContent = Math.ceil(left) + "s";
    if (left <= 0) { ended = true; clearInterval(tick); if (!busy) endRaffica(); }
  }, 200);
  const show = () => {
    if (SESS !== mySess) return;
    if (ended) return endRaffica();
    const item = draw(), s = SK[item.s], a = AR[s.area];
    app().innerHTML = `<header class="top sess"><div class="phase">${ph.label}</div>${comboPill()}<div class="pill">✅ ${SESS.rOk}</div></header>
      <div class="timer"><i></i><b>${DUR}s</b></div>
      <section class="card qcard raffica" style="--c:${a.color};--s:${a.soft}"><div class="qtag">${s.icon} ${esc(s.name)}</div>${renderItemBody(item)}<div id="fb"></div></section>`;
    let done = false;
    wireAnswers(item, (ok, el) => {
      if (done) return; done = true; busy = true;
      SESS.tot++; SESS.rTot++; if (ok) { SESS.ok++; SESS.rOk++; }
      const res = record(item, ok, "raffica"); SESS.xp += res.gain; if (res.newlyMastered) SESS.mastered.push(item.s);
      const cb = applyCombo(item, ok, "raffica", res);
      if ($("#combo")) $("#combo").outerHTML = comboPill();
      if (cb.up) { const f = document.createElement("div"); f.className = "combo-pop"; f.textContent = "COMBO ×" + cb.mult + "!"; document.body.appendChild(f); setTimeout(() => f.remove(), 1100); }
      markAnswer(item, ok, el); Store.save();
      $("#fb").className = "fb mini-fb " + (ok ? "good" : "bad");
      $("#fb").innerHTML = ok ? `+${res.gain + cb.bonus} XP${cb.mult > 1 ? ` <span class="cmb">×${cb.mult}</span>` : ""}` : `Era: <b>${esc(correctText(item))}</b>`;
      setTimeout(() => { busy = false; show(); }, ok ? 650 : 1700);
    });
  };
  show();
}
const rafficaDur = () => RAFFICA_SEC + (hasPerk("breath") ? 10 : 0);
function endRaffica() { if (!SESS || SESS._rEnded) return; SESS._rEnded = true; S.lastRaffica = [...new Set(SESS.rSeen || [])].slice(-60); Store.save(); keyHandler = null; SESS.pi++; SESS.qi = 0; next(); }

// ---------------- fine sessione ----------------
function finishSession() {
  keyHandler = null;
  const stBefore = curStage(SESS.xpBefore), lvBefore = levelOf(SESS.xpBefore), bestBefore = S.best || 0;
  const done = Math.round(20 * (SESS.factor || 1));
  S.xp += done; SESS.xp += done;  // bonus completamento
  const d = S.days[dayKey()] || (S.days[dayKey()] = { xp: 0, ok: 0, tot: 0, sess: 0 }); d.sess++; d.xp += done;
  const already = S.lastDay === dayKey();
  const sr = finishDay(); S.sessions++;
  const bc = SESS.bestCombo || 0, newRecord = bc >= 5 && bc > (S.bestCombo || 0);
  if (bc > (S.bestCombo || 0)) S.bestCombo = bc;
  S.log = (S.log || []).concat([{ d: dayKey(), f: SESS.focus, ok: SESS.ok, tot: SESS.tot, r: SESS.rOk || 0, adj: SESS.adjust.join(","), c: bc, tOk: SESS.tOk || 0, tTot: SESS.tTot || 0, pk: (SESS.perkLog || []).join(","),
    min: Math.min(90, Math.round((Date.now() - SESS.start) / 6000) / 10),
    rd: (SESS.dwell || []).length ? Math.round(SESS.dwell.reduce((a, b) => a + b, 0) / SESS.dwell.length / 100) / 10 : null }]).slice(-60);
  const iceBefore = iceBest();
  if (SESS.focus) { S.lastArea = SK[SESS.focus].area; S.areaHist = (S.areaHist || []).concat([S.lastArea]).slice(-6); if (S.focusChosen !== SESS.focus) S.focus = null; }
  Store.save();
  if (sr && sr.weekly) SESS.xp += 100;
  const stAfter = curStage(), evolved = stAfter > stBefore;
  setTimeout(() => Sync.push("lezione"), 0);
  S.iceBest = iceBest(); const newPerks = PERKS.filter(p => p.stage > iceBefore && p.stage <= S.iceBest);
  const streakItems = []; AVATAR_CATALOG.forEach(c => c.items.forEach(i => { if (i.streak && i.streak > bestBefore && i.streak <= S.best) streakItems.push(i); }));
  const unlocked = SKILLS.filter(s => isAvailable(s.id) && !SESS.availBefore.includes(s.id));
  const mins = Math.max(1, Math.round((Date.now() - SESS.start) / 60000));
  const st = curStages()[stAfter], lvAfter = levelOf(S.xp);
  const newItems = []; for (let l = lvBefore + 1; l <= lvAfter; l++) newItems.push(...unlockedAt(l));
  const newPowers = [...new Set(SESS.mastered)];
  app().innerHTML = header() + `<section class="card center">${backTop()}
    ${evolved ? `<div class="evo"><span class="fade-out">${creatureSVG(S.avatar, stBefore, 170, "o", S.line, true)}</span><span class="pop">${creatureSVG(S.avatar, stAfter, 170, "n", S.line, true)}</span></div><h2>${petName()[0].toUpperCase() + petName().slice(1)} si è evoluto!</h2><p>Ora è: <b>${esc(st.n)}</b> 🎉</p>`
              : `<div class="float petbox">${pet(170)}</div><h2>Missione completata!</h2>`}
    ${lvAfter > lvBefore ? `<div class="levelup"><b>🆙 Livello ${lvAfter}!</b>${newItems.length ? `<p>Hai sbloccato: ${newItems.map(i => `<b>${esc(i.name)}</b> <small>(${esc(i.label)})</small>`).join(", ")}</p>` : ""}</div>` : ""}
    ${newPerks.length ? `<div class="levelup perk-up">${newPerks.map(p => `<p>${p.icon} Nuovo potere attivo: <b>${esc(p.name)}</b> <small>— ${esc(p.d)}</small></p>`).join("")}</div>` : ""}
    ${newPowers.length ? `<div class="levelup pw-up">${newPowers.map(id => `<p>${powerOf(id).icon} Nuovo potere: <b>${esc(powerOf(id).name)}</b> <small>— ${esc(powerOf(id).d)}</small></p>`).join("")}</div>` : ""}
    <div class="stats">
      <div><b>+${SESS.xp}</b><small>XP</small></div>
      <div><b>${SESS.ok}/${SESS.tot}</b><small>giuste</small></div>
      <div><b>🔥 ${bc}</b><small>${newRecord ? "🏅 nuovo record combo!" : "miglior combo"}</small></div>
      <div><b>🔥 ${S.streak}</b><small>${already ? "serie (già fatta oggi)" : "giorni di fila"}</small></div>
    </div>
    ${SESS.duelResult ? `<p class="note">${SESS.duelResult === "win" ? "🏆 Duello vinto! Il trofeo è nella tua Collezione." : "💨 Il mostro è scappato: lo ritroverai la settimana prossima."}</p>` : ""}
    ${sr && sr.weekly ? `<div class="levelup"><b>🎁 ${S.streak} giorni di fila!</b><p>Premio della settimana: <b>+100 XP</b> e un ghiacciolo 🧊</p></div>` : ""}
    ${streakItems.length ? `<div class="levelup pw-up"><b>🔥 Premio della costanza!</b><p>Sbloccato: ${streakItems.map(i => `<b>${esc(i.name)}</b>`).join(", ")} — si ottiene solo con la serie di giorni!</p></div>` : ""}
    ${SESS.factor < 1 ? `<p class="note">🔋 ${petName()[0].toUpperCase() + petName().slice(1)} è un po' stanco: ${SESS.factor < 0.5 ? "questa missione extra valeva un quarto degli XP" : "la seconda missione di oggi vale metà XP"}. Domani la prima missione torna a carica piena ⚡</p>` : ""}
    ${stAfter >= FINAL_STAGE && canHatch() ? `<button class="btn primary big" id="hatch2">🥚 Hai trovato un uovo misterioso!</button>` : ""}
    ${sr && sr.usedFreeze ? `<p class="note">🧊 Hai usato ${sr.usedFreeze} ${sr.usedFreeze === 1 ? "ghiacciolo" : "ghiaccioli"} per salvare la serie!</p>` : ""}
    ${newPowers.length ? `<p class="mastered">✨ Incantesimi appresi: ${newPowers.map(id => esc(SK[id].name)).join(", ")}</p>` : ""}
    ${unlocked.length ? `<p class="note">🔓 Nuove abilità aperte: ${unlocked.map(s => esc(s.name)).join(", ")}</p>` : ""}
    <p class="muted">Tempo: circa ${mins} min. Ci vediamo domani!</p>
    ${newItems.length ? `<button class="btn big" id="den">🛠️ Prova i nuovi oggetti</button>` : ""}
    <button class="btn primary big" id="home">Torna alla base</button></section>`;
  $("#home").onclick = renderHome; if ($("#den")) $("#den").onclick = () => renderDen(); if ($("#hatch2")) $("#hatch2").onclick = renderHatch;
  SESS = null;
}

// ---------------- area genitori ----------------
function renderParentGate() {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  app().innerHTML = `<section class="card center"><h2>👤 Area genitori</h2><p>Per entrare: quanto fa <b>${a} × ${b}</b>?</p>
    <input id="pg" class="inp" inputmode="numeric" autocomplete="off"><div class="row"><button class="btn" id="back">← Indietro</button><button class="btn primary" id="ok">Entra</button></div></section>`;
  const go = () => { if (Number($("#pg").value) === a * b) renderParent(); else { $("#pg").value = ""; $("#pg").placeholder = "Riprova"; } };
  $("#ok").onclick = go; $("#pg").onkeydown = e => { if (e.key === "Enter") go(); }; $("#back").onclick = boot; $("#pg").focus();
}

function renderParent() {
  WHO_OPEN = false;
  const today = dayNum();
  const cal = []; for (let i = 27; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); const k = dayKey(dt); const d = S.days[k]; cal.push(`<span class="dday ${d && d.sess ? "on" : ""}" title="${k}${d ? `: ${d.ok}/${d.tot} giuste, ${d.xp} XP` : ""}"></span>`); }
  const activeDays = Object.values(S.days).filter(d => d.sess).length;
  const last7 = Object.entries(S.days).filter(([k, d]) => today - keyToNum(k) < 7 && d.sess).length;
  const totals = Object.values(S.days).reduce((acc, d) => (acc.ok += d.ok, acc.tot += d.tot, acc), { ok: 0, tot: 0 });
  const rows = SKILLS.map(s => {
    const x = sk(s.id), acc = x.n ? Math.round(x.c / x.n * 100) : null;
    const items = ITEMS.filter(i => i.s === s.id), seen = items.filter(i => S.items[i.id]).length;
    const state = x.ever ? "⭐ conquistata" : isAvailable(s.id) ? (x.n ? "in corso" : "aperta") : "🔒 bloccata";
    return `<tr><td>${s.icon} ${esc(s.name)}<br><small>${AR[s.area].name}</small></td><td><span class="bar thin"><i style="width:${Math.round(x.m * 100)}%"></i></span> ${Math.round(x.m * 100)}%</td><td>${acc === null ? "–" : acc + "%"} <small>(${x.n})</small></td><td>${seen}/${items.length}</td><td>${hardDone(s.id)}/${hardItems(s.id).length}</td><td>${state}</td></tr>`;
  }).join("");
  app().innerHTML = `<section class="card">${backTop()}
    <h2>👤 Area genitori</h2>
    <div class="stats left">
      <div><b>${activeDays}</b><small>giorni attivi</small></div>
      <div><b>${last7}/7</b><small>ultimi 7 giorni</small></div>
      <div><b>${totals.tot ? Math.round(totals.ok / totals.tot * 100) : 0}%</b><small>risposte giuste</small></div>
      <div><b>${S.best} · 🔥${S.bestCombo || 0}</b><small>serie giorni · combo record</small></div>
    </div>
    <h3>Ultime 4 settimane</h3><div class="cal">${cal.join("")}</div>
    <h3>Ultime sessioni <small class="muted">(obiettivo: circa 85% di risposte giuste)</small></h3>
    ${(S.log || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Giorno</th><th>Missione</th><th>Giuste</th><th>Adattamenti</th></tr></thead><tbody>${(S.log || []).slice(-8).reverse().map(l => {
      const pc = l.tot ? Math.round(l.ok / l.tot * 100) : 0, col = pc < 70 ? "var(--bad)" : pc > 95 ? "var(--pri)" : "var(--ok)";
      const adj = (l.adj || "").split(",").filter(Boolean);
      return `<tr><td>${l.d.split("-").reverse().slice(0, 2).join("/")}</td><td>${l.f && SK[l.f] ? SK[l.f].icon + " " + esc(SK[l.f].name) : "–"}</td><td><b style="color:${col}">${pc}%</b> <small>(${l.ok}/${l.tot})${l.tTot ? `<br>scritte: ${l.tOk}/${l.tTot}` : ""}${l.c ? ` · combo ${l.c}` : ""}${l.min != null ? `<br>🕒 ${String(l.min).replace(".", ",")} min` : ""}${l.rd != null ? `<br>⏱ ${l.rd}s sugli errori` : ""}</small></td><td><small>${adj.length ? adj.map(a => a === "giu" ? "↓ facilitato" : "↑ più difficile").join(", ") : "–"}${(l.pk || "").split(",").filter(x => x && x !== "breath").map(x => x === "mirror" ? " · 🪞 aiuto usato" : x === "regen" ? " · 💧 combo salvato" : " · ❄️ combo dimezzato").join("")}</small></td></tr>`; }).join("")}</tbody></table></div>`
      : `<p class="muted">Ancora nessuna sessione registrata con questa versione.</p>`}
    <h3>⚔️ Duelli</h3>
    ${duelsHTML()}
    <h3>Da ripassare <small class="muted">(sbagliati di recente e non ancora recuperati)</small></h3>
    ${recentErrorsHTML()}
    <h3>Abilità</h3>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Abilità</th><th>Padronanza</th><th>Accuratezza (tentativi)</th><th>Esercizi visti</th><th>Sfide superate</th><th>Stato</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted">La <b>padronanza</b> è una media mobile che dà più peso alle risposte recenti; un'abilità è «conquistata» quando supera l'85% dopo almeno 8 tentativi. Salvataggio: <span id="sync"></span>.</p>
    ${profilesPanel()}
    <h3>Nome nell'app</h3>
    <div class="row left"><input id="nick" class="inp" maxlength="20" value="${esc(S.name || "")}"><button class="btn" id="nicksave">Salva</button></div>
    <p class="muted">Se sincronizzi i progressi in rete, è meglio usare un soprannome invece del nome vero.</p>
    ${IS_STANDALONE ? syncPanel() : ""}
    <h3>Backup</h3>
    <div class="row">${IS_STANDALONE ? `<button class="btn" id="dl">💾 Scarica backup</button><label class="btn" for="upl">📂 Carica backup da file</label><input type="file" id="upl" accept=".json,application/json" hidden>` : ""}<button class="btn" id="copy">📋 Copia backup</button><button class="btn" id="imp">📥 Ripristina da backup</button><button class="btn warn" id="reset">🗑️ Azzera tutto</button></div>
    <div id="pbox"></div>
    <button class="btn" id="back">← Torna alla base</button>
  </section>`;
  updateSyncBadge();
  $("#back").onclick = boot;
  $("#nicksave").onclick = () => { S.name = $("#nick").value.trim() || S.name; Store.save(); $("#pbox").innerHTML = "<p class='note'>Nome aggiornato ✅</p>"; };
  if (IS_STANDALONE) wireSyncPanel();
  wireProfilesPanel();
  $("#copy").onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); $("#pbox").innerHTML = "<p class='note'>Backup copiato negli appunti ✅</p>"; } catch (e) { $("#pbox").innerHTML = `<p class="muted">Copia manualmente:</p><textarea class="inp ta" readonly>${esc(JSON.stringify(S))}</textarea>`; } };
  if ($("#dl")) $("#dl").onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "incanto-parolum-backup-" + dayKey() + ".json";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  if ($("#upl")) $("#upl").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const st = JSON.parse(r.result); if (!st.skills) throw 0; S = normalize(st); applyGrade(S.grade); Store.save(); renderParent(); $("#pbox").innerHTML = "<p class='note'>Progressi caricati ✅</p>"; }
      catch (_) { $("#pbox").innerHTML = "<p class='note bad'>Questo file non è un backup valido.</p>"; } };
    r.readAsText(f);
  };
  $("#imp").onclick = () => {
    $("#pbox").innerHTML = `<textarea class="inp ta" id="ta" placeholder="Incolla qui il backup"></textarea><button class="btn primary" id="doimp">Ripristina</button>`;
    $("#doimp").onclick = () => { try { const st = JSON.parse($("#ta").value); if (!st.skills) throw 0; S = normalize(st); applyGrade(S.grade); Store.save(); renderParent(); } catch (e) { $("#pbox").insertAdjacentHTML("beforeend", "<p class='note bad'>Backup non valido.</p>"); } };
  };
  $("#reset").onclick = () => {
    $("#pbox").innerHTML = `<p class="note bad">Sicuro? Si perdono tutti i progressi di <b>${esc(S.name || "questo profilo")}</b> su questo dispositivo${Sync.on() ? " e la sincronizzazione viene scollegata (i progressi in rete restano)" : ""}.</p><button class="btn warn" id="yes">Sì, azzera</button>`;
    $("#yes").onclick = () => { Sync.saveCfg(null); const g = S.grade, n = S.name; S = freshState(); S.grade = g; S.name = n; applyGrade(g); Store.save(); Sync.pushedAt = 0; boot(); };
  };
}


// ---------------- sincronizzazione con un repository GitHub privato ----------------
// I progressi viaggiano in un file JSON del repository dei dati. La chiave (fine-grained token,
// solo "Contents" su quel repository) resta salvata su questo dispositivo, mai nel codice.
const SYNC_KEY = "incanto-sync-v1";
// Quale versione vince tra due dispositivi: quella con PIÙ PROGRESSI (gli XP non calano mai);
// la data di modifica decide solo a parità. Così un profilo vuoto non sovrascrive mai uno vero.
function progressScore(st) { return st && st.skills ? (st.xp || 0) * 10 + (st.sessions || 0) + (st.diagDone ? 1 : 0) : -1; }
function remoteWins(r, l) {
  if (!r || !r.skills) return false;
  const a = progressScore(r), b = progressScore(l);
  return a !== b ? a > b : (r.updatedAt || 0) > (l.updatedAt || 0);
}
const Sync = {
  cfg: null, status: "", lastOk: 0, busy: false, pushedAt: 0,
  load() { try { this.cfg = JSON.parse(localStorage.getItem(SYNC_KEY) || "null"); } catch (e) { this.cfg = null; } return this.cfg; },
  saveCfg(c) { this.cfg = c; try { c ? localStorage.setItem(SYNC_KEY, JSON.stringify(c)) : localStorage.removeItem(SYNC_KEY); } catch (e) {} },
  on() { return IS_STANDALONE && !!(this.cfg && this.cfg.token && this.cfg.owner && this.cfg.repo); },
  url(file = Profiles.file()) { const c = this.cfg; return `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${file}`; },
  // trova in rete i profili creati su altri dispositivi (file progressi-*.json) e li aggiunge qui
  async discover() {
    if (!this.on()) return false;
    let r; try { r = await fetch(`https://api.github.com/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}/contents/?t=${Date.now()}`, { headers: this.headers(), cache: "no-store" }); } catch (e) { return false; }
    if (!r.ok) return false;
    let added = false;
    let list = []; try { list = await r.json(); } catch (e) {}
    if (!Array.isArray(list)) return false;
    for (const f of list) {
      const m = /^progressi-([a-z0-9-]+)\.json$/.exec(f.name || ""); if (!m) continue;
      const id = m[1]; if (Profiles.entry(id)) continue;
      try {
        const rr = await fetch(this.url(f.name) + "?t=" + Date.now(), { headers: this.headers(), cache: "no-store" }); if (!rr.ok) continue;
        const data = JSON.parse(this.b64dec((await rr.json()).content)); if (!data || !data.skills) continue;
        localStorage.setItem(Profiles.lsKey(id), JSON.stringify(data));
        Profiles.reg.list.push({ id, name: data.name || "", grade: data.grade || "media", av: data.avatar, line: data.line || "fuoco", stage: 0, lock: !!(data.secret && data.secret.length) });
        added = true;
      } catch (e) {}
    }
    if (added) Profiles.save();
    return added;
  },
  headers() { return { "Authorization": "Bearer " + this.cfg.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }; },
  b64enc(str) { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); },
  b64dec(b64) { const bin = atob(b64.replace(/\s/g, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); },
  explain(code) {
    return code === 401 ? "chiave non valida o scaduta" : code === 403 ? "la chiave non ha il permesso di scrivere (serve Contents: Read and write)"
      : code === 404 ? "repository non trovato o non accessibile con questa chiave" : code === 0 ? "nessuna connessione a internet" : "errore " + code;
  },
  async get() {    // → { data, sha } oppure { data: null, sha: null } se il file non esiste ancora
    let r; try { r = await fetch(this.url() + "?t=" + Date.now(), { headers: this.headers(), cache: "no-store" }); } catch (e) { throw { code: 0 }; }
    if (r.status === 404) {
      let rr; try { rr = await fetch(`https://api.github.com/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}`, { headers: this.headers() }); } catch (e) { throw { code: 0 }; }
      if (!rr.ok) throw { code: rr.status };
      return { data: null, sha: null };
    }
    if (!r.ok) throw { code: r.status };
    const j = await r.json();
    return { data: JSON.parse(this.b64dec(j.content)), sha: j.sha };
  },
  async put(sha, why) {
    const body = { message: `Progressi aggiornati — ${dayKey()} ${new Date().toTimeString().slice(0, 5)} (${why})`, content: this.b64enc(JSON.stringify(S, null, 1)) };
    if (sha) body.sha = sha;
    let r; try { r = await fetch(this.url(), { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, this.headers()), body: JSON.stringify(body) }); } catch (e) { throw { code: 0 }; }
    if (!r.ok) throw { code: r.status };
  },
  // scarica: se in rete c'è una versione più recente, la usa
  async pull() {
    if (!this.on() || this.busy) return false;
    this.busy = true;
    try {
      const { data } = await this.get();
      this.ok();
      if (remoteWins(data, S)) { S = normalize(data); applyGrade(S.grade); Store.saveLocal(); this.pushedAt = S.updatedAt; return true; }
      if (!data || progressScore(S) > progressScore(data)) { this.busy = false; await this.push("primo salvataggio"); }
      return false;
    } catch (e) { this.fail(e); return false; } finally { this.busy = false; }
  },
  // carica: salva i progressi, ma non sovrascrive mai una versione più recente arrivata da un altro dispositivo
  async push(why = "lezione") {
    if (!this.on() || this.busy) return;
    if ((S.updatedAt || 0) <= this.pushedAt) return;
    this.busy = true;
    try {
      const { data, sha } = await this.get();
      if (remoteWins(data, S)) {   // l'altro dispositivo è più avanti: prendo la sua versione
        S = normalize(data); applyGrade(S.grade); Store.saveLocal(); this.pushedAt = S.updatedAt; this.ok(); if (!SESS && !WHO_OPEN) boot(); return;
      }
      await this.put(sha, why); this.pushedAt = S.updatedAt; this.ok();
    } catch (e) { this.fail(e); } finally { this.busy = false; updateSyncBadge(); }
  },
  ok() { this.status = "ok"; this.lastOk = Date.now(); this.err = ""; updateSyncBadge(); },
  fail(e) { this.status = "err"; this.err = this.explain(e && e.code !== undefined ? e.code : -1); updateSyncBadge(); },
  label() {
    if (!this.on()) return "";
    if (this.status === "ok") return "☁️ sincronizzato " + new Date(this.lastOk).toTimeString().slice(0, 5);
    if (this.status === "err") return "⚠️ sincronizzazione: " + this.err;
    return "☁️ sincronizzazione…";
  },
};

// ---------------- avvio ----------------
const IS_STANDALONE = !(window.claude && typeof window.claude.use === "function");
function boot() { keyHandler = null; if (!S.diagDone) renderOnboarding(); else renderHome(); }
// (l'avvio è in fondo al file, dopo che tutto è stato definito)

// ---------------- tana del drago: personalizzazione e poteri ----------------
function renderDen(tab) {
  tab = typeof tab === "string" ? tab : "look";
  const lv = levelOf(S.xp), si = curStage(), isDragon = si >= DRAGON_FROM, STG = curStages();
  const fresh = new Set(newSince(S.avatar.seenLevel || 1, lv).map(i => i.slot + ":" + i.id));
  const nx = nextUnlock(lv);
  const slots = AVATAR_CATALOG.map(c => {
    const chips = c.items.map(i => {
      const locked = i.trophy ? (S.trophies || []).length < i.trophy : i.streak ? (S.best || 0) < i.streak : i.lv > lv, on = S.avatar[c.slot] === i.id, isNew = fresh.has(c.slot + ":" + i.id);
      return `<button class="chip ${on ? "on" : ""} ${locked ? "lock" : ""}" data-slot="${c.slot}" data-id="${i.id}" ${locked ? "disabled" : ""}>
        ${locked ? "🔒 " : i.trophy ? "🏆 " : i.streak ? "🔥 " : ""}${esc(i.name)}${locked ? ` <small>${i.trophy ? i.trophy + (i.trophy === 1 ? " trofeo" : " trofei") : i.streak ? i.streak + " giorni di fila" : "Liv. " + i.lv}</small>` : ""}${isNew ? ' <span class="badge">nuovo</span>' : ""}</button>`;
    }).join("");
    const note = c.slot === "wings" && S.line === "ghiaccio" ? `<small class="muted"> · i compagni della Linea del Ghiaccio volano senza ali</small>` : c.dragon && !isDragon ? `<small class="muted"> · si vedrà quando diventa ${esc(STG[DRAGON_FROM].n)}</small>` : c.slot === "color" && LINES[S.line].palette ? `<small class="muted"> · il compagno di ${esc(LINES[S.line].name)} ha il suo colore</small>` : "";
    return `<div class="slot"><h4>${c.label}${note}</h4><div class="chips">${chips}</div></div>`;
  }).join("");
  const powers = SKILLS.map(s => {
    const P = powerOf(s.id), got = isMastered(s.id);
    return `<div class="power ${got ? "got" : ""}"><span class="pi">${got ? P.icon : "❔"}</span><div><b>${got ? esc(P.name) : "Potere nascosto"}</b>
      <small>${got ? esc(P.d) : `Conquista «${esc(s.name)}» per scoprirlo`}</small></div></div>`;
  }).join("");
  const evo = STG.map((st, i) => `<div class="evo-step ${i <= si ? "got" : ""} ${i === si ? "cur" : ""}">
      ${i <= si ? creatureSVG(S.avatar, i, 70, "e" + i, S.line) : `<div class="q-mark">?</div>`}<small>${i <= si ? esc(st.n) : st.xp + " XP"}</small></div>`).join("");
  const coll = (S.collection || []).map((c, i) => `<div class="coll-item">${creatureSVG(c.avatar, FINAL_STAGE, 110, "c" + i, c.line)}<b>${esc(c.name || LINES[c.line].names[FINAL_STAGE])}</b><small>${LINES[c.line].icon} ${esc(LINES[c.line].names[FINAL_STAGE])} · ${c.d.split("-").reverse().join("/")}</small></div>`).join("")
    + `<div class="coll-item cur">${pet(110, "ccur", false)}<b>${esc(S.avatar.name || STG[si].n)}</b><small>${LINES[S.line].icon} in crescita: ${esc(STG[si].n)}</small></div>`
    + LINE_ORDER.slice(LINE_ORDER.indexOf(S.line) + 1).map(() => `<div class="coll-item"><div class="q-mark big">?</div><b>???</b><small>Uovo ancora da trovare</small></div>`).join("");

  app().innerHTML = header() + `<section class="card">${backTop()}
    <div class="den">
      <div class="den-pet"><div class="float">${pet(220, "den")}</div>
        <label class="lbl">Nome del tuo compagno</label>
        <input id="pname" class="inp" maxlength="18" placeholder="Dagli un nome!" value="${esc(S.avatar.name || "")}" autocomplete="off">
        <p class="muted">${esc(STG[si].n)} · Livello ${lv}${nx ? `<br>Prossimo sblocco al livello ${nx.lv}: <b>???</b>` : ""}</p>
      </div>
      <div class="den-side">
        <div class="tabs"><button class="tab ${tab === "look" ? "on" : ""}" data-t="look">🎨 Aspetto</button><button class="tab ${tab === "pow" ? "on" : ""}" data-t="pow">✨ Poteri</button><button class="tab ${tab === "evo" ? "on" : ""}" data-t="evo">🧬 Evoluzione</button><button class="tab ${tab === "coll" ? "on" : ""}" data-t="coll">🏆 Collezione</button></div>
        ${tab === "look" ? slots : tab === "pow" ? `${perksHTML()}<h4 class="sub">📖 Il Grimorio</h4><p class="muted">Ogni incantesimo che apprendi (⭐ sulla mappa) scrive una pagina del Grimorio e dà un potere al tuo compagno.</p><div class="powers-grid">${powers}</div>`
          : tab === "evo" ? `<p class="muted">${LINES[S.line].icon} ${esc(LINES[S.line].name)}. Ogni risposta giusta lo fa crescere. Chi sarà il prossimo?</p><div class="evo-line">${evo}</div>`
          : `<p class="muted">Quando il tuo compagno raggiunge la forma finale, entra nella collezione e trovi un nuovo uovo di un'altra specie.</p><div class="coll">${coll}</div>
            <h4 class="sub">🏆 Trofei dei duelli</h4>${(S.trophies || []).length ? `<div class="coll">${S.trophies.map(t => `<div class="coll-item">${monsterSVG(MONSTERS.find(m => m.n === t.n) || MONSTERS[0], 90, true)}<b>${esc(t.n)}</b><small>sconfitto il ${t.d.split("-").reverse().join("/")}</small></div>`).join("")}</div>` : `<p class="muted">Ancora nessun trofeo: sconfiggi il mostro della settimana!</p>`}`}
      </div>
    </div>
    <button class="btn" id="back">← Torna alla base</button>
  </section>`;
  // segna come visti gli oggetti nuovi
  if ((S.avatar.seenLevel || 1) < lv) { S.avatar.seenLevel = lv; Store.save(); }
  document.querySelectorAll(".chip:not(.lock)").forEach(b => b.onclick = () => { S.avatar[b.dataset.slot] = b.dataset.id; Store.save(); renderDen(tab); });
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => renderDen(b.dataset.t));
  const nm = $("#pname"); let t; nm.oninput = () => { S.avatar.name = nm.value.trim(); clearTimeout(t); t = setTimeout(() => Store.save(), 600); };
  $("#back").onclick = () => { S.avatar.name = nm.value.trim(); Store.save(); renderHome(); };
}

window.addEventListener("error", e => {
  try { Store.save(); } catch (_) {}
  if (document.querySelector("#oops")) return;
  const d = document.createElement("div"); d.id = "oops";
  d.innerHTML = `<div class="oops-card"><div style="font-size:2.5rem">🛠️</div><h2>Ops, qualcosa si è inceppato</h2><p>I tuoi progressi sono salvati.</p><button class="btn primary" id="oops-go">Torna alla base</button></div>`;
  document.body.appendChild(d);
  document.querySelector("#oops-go").onclick = () => { d.remove(); keyHandler = null; SESS = null; try { boot(); } catch (_) { location.reload(); } };
});

// ---------------- nuovo uovo: il compagno finale entra nella collezione ----------------
function renderHatch() {
  const nl = nextLine(S.line); if (!nl) return renderHome();
  const oldName = S.avatar.name || LINES[S.line].names[FINAL_STAGE];
  app().innerHTML = header() + `<section class="card center">
    <div class="hatch-row"><div>${pet(150, "h1")}<small>${esc(oldName)}</small></div><div class="arrow">➜</div><div class="wob">${creatureSVG(S.avatar, 0, 150, "h2", nl, true)}<small>???</small></div></div>
    <h2>${esc(oldName)} entra nella tua collezione! 🏆</h2>
    <p>Ha raggiunto la forma finale. Mentre volava ha trovato per te un <b>${esc(LINES[nl].names[0].toLowerCase())}</b>…</p>
    <p class="muted">Il nuovo compagno appartiene alla <b>${LINES[nl].icon} ${esc(LINES[nl].name)}</b>: crescerà più lentamente, vivrà in un mondo tutto nuovo e, crescendo, ti darà <b>poteri che si usano durante le lezioni</b>. I tuoi livelli, gli oggetti e i poteri restano tutti.</p>
    <button class="btn primary big" id="ok">Prendi l'uovo 🥚</button>
    <button class="btn ghost" id="later">Più tardi</button></section>`;
  $("#later").onclick = renderHome;
  $("#ok").onclick = () => {
    S.collection = (S.collection || []).concat([{ line: S.line, name: S.avatar.name || "", avatar: Object.assign({}, S.avatar), d: dayKey() }]);
    S.line = nl; S.hatchXp = S.xp; S.avatar.name = "";
    Store.save(); renderDen("look"); toast && toast("Dai un nome al tuo nuovo compagno!");
  };
}

function perksHTML() {
  return `<h4 class="sub">Poteri del compagno <small class="muted">(si usano durante le lezioni)</small></h4><div class="powers-grid">${PERKS.map(p => {
    const got = hasPerk(p.id);
    return `<div class="power ${got ? "got" : ""}"><span class="pi">${got ? p.icon : "🔒"}</span><div><b>${esc(p.name)}</b><small>${got ? esc(p.d) : `Si sblocca con: ${esc(LINES.ghiaccio.names[p.stage])} ${LINES.ghiaccio.icon}`}</small></div></div>`;
  }).join("")}</div>`;
}

// lo Specchio aiuta solo dove non regala la risposta: in missione, con almeno 3 scelte o da scrivere
function mirrorOk(item, ph) {
  if (!SESS || SESS.mode !== "session" || ph.key !== "nuovo" || SESS.mirrorUsed || !hasPerk("mirror")) return false;
  return item.t === "type" || (item.o && item.o.length >= 3) || (item.c && item.c.length >= 3);
}

function syncPanel() {
  const c = Sync.cfg || {};
  const on = Sync.on();
  return `<h3>☁️ Sincronizzazione</h3>
    <p class="muted">Salva i progressi in un repository GitHub <b>privato</b>, così PC e telefono restano allineati e nulla va perso.</p>
    <div class="syncbox">
      <label>Proprietario <input id="sy-owner" class="inp" value="${esc(c.owner || "felicat-hub")}" autocomplete="off"></label>
      <label>Repository dei dati <input id="sy-repo" class="inp" value="${esc(c.repo || "IncantoParolum-dati")}" autocomplete="off"></label>
      <label>Chiave (fine-grained token) <input id="sy-token" class="inp" type="password" placeholder="${on ? "•••••• chiave salvata" : "github_pat_…"}" autocomplete="off"></label>
    </div>
    <div class="row left"><button class="btn primary" id="sy-save">${on ? "Aggiorna e prova" : "Collega e prova"}</button>${on ? `<button class="btn" id="sy-now">Sincronizza ora</button><button class="btn ghost" id="sy-off">Scollega</button>` : ""}</div>
    <p class="muted" id="sy-status">${on ? esc(Sync.label() || "Collegato.") : "Non collegato: i progressi restano solo su questo dispositivo."}</p>`;
}
function wireSyncPanel() {
  const st = m => { const e = $("#sy-status"); if (e) e.textContent = m; };
  $("#sy-save").onclick = async () => {
    const prev = Sync.cfg || {};
    const cfg = { owner: $("#sy-owner").value.trim(), repo: $("#sy-repo").value.trim(), token: $("#sy-token").value.trim() || prev.token || "", };
    if (!cfg.owner || !cfg.repo || !cfg.token) { st("Compila proprietario, repository e chiave."); return; }
    Sync.saveCfg(cfg); Sync.pushedAt = 0; st("Provo il collegamento…");
    try {
      const { data } = await Sync.get(); Sync.ok();
      if (remoteWins(data, S)) {
        st(`Collegato ✅ In rete ci sono progressi più recenti (${esc(data.name || "")}, ${data.xp || 0} XP): li ho caricati.`);
        S = normalize(data); applyGrade(S.grade); Store.saveLocal(); Sync.pushedAt = S.updatedAt;
      } else if (data && data.skills && progressScore(data) === progressScore(S)) { Sync.pushedAt = S.updatedAt; st("Collegato ✅ I progressi in rete e su questo dispositivo sono già allineati."); }
      else { S.updatedAt = Math.max(S.updatedAt || 0, Date.now()); Store.saveLocal(); await Sync.push("collegamento"); st(Sync.status === "ok" ? `Collegato ✅ Progressi di questo dispositivo (${S.xp} XP) salvati in rete.` : "⚠️ " + Sync.err); }
      const before = Profiles.reg.list.length;
      if (await Sync.discover().catch(() => false)) $("#sy-status").insertAdjacentHTML("beforeend", `<br>👨‍👩‍👦 Trovati in rete altri giocatori: ${Profiles.reg.list.slice(before).map(e => "<b>" + esc(e.name || "?") + "</b>").join(", ")}. Li trovi nella schermata «Chi gioca?».`);
    } catch (e) { Sync.fail(e); st("⚠️ Non riesco a collegarmi: " + Sync.err + "."); }
  };
  if ($("#sy-now")) $("#sy-now").onclick = async () => { st("Sincronizzo…"); const changed = await Sync.pull(); if (!changed) { Sync.pushedAt = 0; await Sync.push("manuale"); } st(Sync.status === "ok" ? "✅ " + Sync.label() : "⚠️ " + Sync.err); };
  if ($("#sy-off")) $("#sy-off").onclick = () => { Sync.saveCfg(null); renderParent(); };
}

function recentErrorsHTML() {
  const today = dayNum();
  const list = ITEMS.filter(i => { const it = S.items[i.id]; return isErr(it) && today - it.lw <= 21; })
    .sort((a, b) => S.items[b.id].lw - S.items[a.id].lw);
  if (!list.length) return `<p class="muted">Nessun errore in sospeso 👍</p>`;
  const bySkill = {};
  list.forEach(i => (bySkill[i.s] = bySkill[i.s] || []).push(i));
  return `<div class="errs">${Object.entries(bySkill).map(([sid, its]) => `<div><b>${SK[sid].icon} ${esc(SK[sid].name)}</b>${needsBoost(sid) ? ' <span class="tag mid">da rinforzare</span>' : ""}<br>${its.map(i => `<span class="errw" title="${esc(i.q)}">${esc(correctText(i))}</span>`).join(" ")}</div>`).join("")}</div>
    <p class="muted">Tornano per primi nei prossimi ripassi; quando li risponde giusti, escono dall'elenco.</p>`;
}

// ======================= IL DUELLO DELLA SETTIMANA =======================
// Ripasso misto delle abilità conquistate, travestito da combattimento.
// Per far variare gli incantesimi: mano di 3 pescata a favore dei più deboli, ricarica di 2 turni,
// punti deboli (×2) sulle abilità da allenare, corazza (½) su quelle più usate, catena di 3 diversi.
const DUEL = { HP: 150, HEARTS: 5, BASE: 15, COOLDOWN: 2, CHAIN: 10, MIN_SPELLS: 3 };
function weekKey(d = new Date()) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return dayKey(x); }   // lunedì della settimana
const spells = () => SKILLS.filter(s => isMastered(s.id));
const duelReady = () => spells().length >= DUEL.MIN_SPELLS && (S.duel || {}).week !== weekKey();
function weekMonster() { const n = Math.floor(keyToNum(weekKey()) / 7); return MONSTERS[((n % MONSTERS.length) + MONSTERS.length) % MONSTERS.length]; }

function setupDuel() {
  const sp = spells().map(s => s.id);
  const use = S.duelUse || {};
  // corazza: l'incantesimo più usato nei duelli passati (al primo duello: quello più padroneggiato)
  const byUse = sp.slice().sort((a, b) => (use[b] || 0) - (use[a] || 0) || sk(b).m - sk(a).m);
  const resist = [byUse[0]];
  // punti deboli: le abilità conquistate dove serve più allenamento
  const weak = sp.filter(id => !resist.includes(id))
    .sort((a, b) => (needsBoost(b) - needsBoost(a)) || (errItems(b).length - errItems(a).length) || (sk(a).m - sk(b).m)).slice(0, 2);
  return { monster: weekMonster(), hp: DUEL.HP, hearts: DUEL.HEARTS, turn: 0, last: [], cool: {}, used: {}, offered: {}, okBy: {}, weak, resist, seen: new Set(), log: [] };
}
function spellPower(id, D) {
  let m = D.weak.includes(id) ? 2 : D.resist.includes(id) || (D.used[id] || 0) >= 3 ? 0.5 : 1;
  const instab = Math.min(1.3, 1 + (1 - sk(id).m) * 0.5);   // meno è solida, più è potente (ma rischiosa)
  return { mult: m, instab };
}
function drawHand(D) {
  let pool = spells().map(s => s.id).filter(id => !(D.cool[id] > 0));
  if (pool.length === 0) pool = spells().map(s => s.id);
  const w = id => 1 + 3 * (1 - sk(id).m) + (errItems(id).length ? 2 : 0) + (D.weak.includes(id) ? 3 : 0) - (D.resist.includes(id) ? 0.5 : 0);
  const hand = [];
  while (hand.length < 3 && pool.length) {
    const tot = pool.reduce((a, id) => a + w(id), 0); let r = Math.random() * tot, k = 0;
    for (; k < pool.length - 1; k++) { r -= w(pool[k]); if (r <= 0) break; }
    hand.push(pool.splice(k, 1)[0]);
  }
  hand.forEach(id => D.offered[id] = (D.offered[id] || 0) + 1);
  return hand;
}
function duelItem(id, D) {
  const its = ITEMS.filter(i => i.s === id && !D.seen.has(i.id));
  const err = its.filter(i => isErr(S.items[i.id])), seen = its.filter(i => S.items[i.id] && !isErr(S.items[i.id])).sort((a, b) => S.items[a.id].b - S.items[b.id].b), unseen = its.filter(i => !S.items[i.id]);
  const pick = shuffle(err)[0] || seen[0] || shuffle(unseen)[0] || shuffle(ITEMS.filter(i => i.s === id))[0];
  D.seen.add(pick.id); return pick;
}
const spellTag = (id, D) => { const p = spellPower(id, D); return p.mult === 2 ? `<span class="stag weak">💥 punto debole ×2</span>` : p.mult === 0.5 ? `<span class="stag res">🛡️ corazza ½</span>` : p.instab >= 1.12 ? `<span class="stag ins">⚡ instabile</span>` : `<span class="stag">affidabile</span>`; };

function duelIntro() {
  keyHandler = null;
  const D = SESS.duel = setupDuel(), M = D.monster;
  app().innerHTML = `<header class="top sess"><div class="phase">⚔️ Duello della settimana</div></header>
  <section class="card center duel">
    <div class="duel-row"><div>${pet(140, "dp", false)}</div><div class="vs">VS</div><div>${monsterSVG(M, 150)}</div></div>
    <h2>${esc(M.n)} ti sfida!</h2>
    <p>Ha rubato le parole del regno e le ha riempite di errori. Usa gli incantesimi del tuo Grimorio per sconfiggerlo!</p>
    <div class="duel-rules">
      <p>💥 <b>Teme:</b> ${D.weak.map(id => `${powerOf(id).icon} ${esc(powerOf(id).name)}`).join(", ") || "–"}</p>
      <p>🛡️ <b>Corazzato contro:</b> ${D.resist.map(id => `${powerOf(id).icon} ${esc(powerOf(id).name)}`).join(", ")}</p>
      <p class="muted">A ogni turno scegli 1 incantesimo tra 3. Dopo averlo usato si ricarica per 2 turni. Tre incantesimi diversi di fila = <b>Catena!</b> Nessuna fretta: pensa bene.</p>
    </div>
    <button class="btn primary big" id="fight">Al duello! ⚔️</button>
  </section>`;
  $("#fight").onclick = duelTurn;
}
function duelHeader(D, hurt) {
  const pct = Math.max(0, D.hp) / DUEL.HP * 100;
  return `<header class="top sess"><div class="phase">⚔️ ${esc(D.monster.n)}</div><div class="pill">${"❤️".repeat(D.hearts)}${"🤍".repeat(DUEL.HEARTS - D.hearts)}</div></header>
    <div class="duel-hud"><div class="mini-pet">${pet(70, "dh" + D.turn, false)}</div>
      <div class="hpwrap"><div class="hpbar"><i style="width:${pct}%"></i></div><small>${Math.max(0, Math.round(D.hp))} / ${DUEL.HP}</small></div>
      <div class="mini-mon">${monsterSVG(D.monster, 80, hurt)}</div></div>`;
}
function duelTurn() {
  const D = SESS.duel; if (!D) return;
  if (D.hp <= 0 || D.hearts <= 0) return duelEnd();
  Object.keys(D.cool).forEach(k => D.cool[k] = Math.max(0, D.cool[k] - 1));
  const hand = drawHand(D);
  const chainReady = D.last.length >= 2 && D.last[D.last.length - 1] !== D.last[D.last.length - 2];
  app().innerHTML = duelHeader(D) + `<section class="card">
    <h3 class="center">Scegli l'incantesimo da lanciare</h3>
    <div class="hand">${hand.map(id => { const P = powerOf(id), d = spellPower(id, D), next = chainReady && !D.last.slice(-2).includes(id);
      return `<button class="spell" data-id="${id}"><span class="si">${P.icon}</span><b>${esc(P.name)}</b><small>${esc(SK[id].name)}</small>${spellTag(id, D)}${next ? `<span class="stag chain">⛓️ Catena!</span>` : ""}</button>`; }).join("")}</div>
  </section>`;
  document.querySelectorAll(".spell").forEach(b => b.onclick = () => duelCast(b.dataset.id));
}
function duelCast(id) {
  const D = SESS.duel, item = duelItem(id, D), P = powerOf(id), s = SK[id], a = AR[s.area];
  D.turn++;
  app().innerHTML = duelHeader(D) + `<section class="card qcard" style="--c:${a.color};--s:${a.soft}">
    <div class="qtag">${P.icon} ${esc(P.name)} · ${esc(s.name)}</div>${renderItemBody(item)}<div id="fb"></div></section>`;
  let done = false;
  wireAnswers(item, (ok, el, typed) => {
    if (done) return; done = true;
    const res = record(item, ok, "duello"); SESS.xp += res.gain; SESS.tot++; if (ok) SESS.ok++;
    if (res.newlyMastered) SESS.mastered.push(item.s);
    markAnswer(item, ok, el); Store.save();
    D.used[id] = (D.used[id] || 0) + 1; D.cool[id] = DUEL.COOLDOWN + 1;
    const ob = D.okBy[id] || (D.okBy[id] = [0, 0]); ob[1]++; if (ok) ob[0]++;
    let msg;
    if (ok) {
      const p = spellPower(id, D);
      const chain = D.last.length >= 2 && new Set([D.last[D.last.length - 2], D.last[D.last.length - 1], id]).size === 3;
      const dmg = Math.round(DUEL.BASE * p.mult * p.instab) + (chain ? DUEL.CHAIN : 0);
      D.hp -= dmg;
      msg = `<div class="fb-t">${P.icon} Colpito! <span class="dmg">−${dmg}</span></div>
        ${p.mult === 2 ? "<p>💥 Punto debole! Danno doppio.</p>" : p.mult === 0.5 ? "<p>🛡️ Il mostro si è difeso con la corazza: danno dimezzato. Prova un altro incantesimo!</p>" : ""}
        ${chain ? "<p>⛓️ <b>Catena di incantesimi!</b> +10 di danno.</p>" : ""}${(D.used[id] === 3 && !D.resist.includes(id)) ? "<p>👀 Il mostro si sta abituando a questo incantesimo…</p>" : ""}`;
    } else {
      D.hearts--;
      msg = `<div class="fb-t">Il mostro contrattacca! 💢</div>${errorFeedback(item, typed, false)}`;
    }
    D.last.push(id); D.log.push([id, ok ? 1 : 0]);
    const fb = $("#fb"); fb.className = "fb " + (ok ? "good" : "bad");
    fb.innerHTML = msg + `<button class="btn ${ok ? "primary" : "warn"}" id="cont">${D.hp <= 0 ? "Finisci il mostro! ✨" : D.hearts <= 0 ? "Continua" : "Prossimo turno ▶"}</button>`;
    if (ok) { const m = document.querySelector(".mini-mon"); if (m) m.innerHTML = monsterSVG(D.monster, 80, true); }
    $(".hpbar i").style.width = Math.max(0, D.hp) / DUEL.HP * 100 + "%";
    const hpTxt = document.querySelector(".hpwrap small"); if (hpTxt) hpTxt.textContent = Math.max(0, Math.round(D.hp)) + " / " + DUEL.HP;
    const go = () => duelTurn(); $("#cont").onclick = go;
    if (!ok) armContinue(item, go);
    else { $("#cont").focus(); keyHandler = e => { if (e.key === "Enter") { e.preventDefault(); go(); } }; }
  });
}
function duelEnd() {
  keyHandler = null;
  const D = SESS.duel, win = D.hp <= 0, M = D.monster;
  S.duel = { week: weekKey(), result: win ? "win" : "flee" };
  S.duelUse = S.duelUse || {}; Object.entries(D.used).forEach(([k, v]) => S.duelUse[k] = (S.duelUse[k] || 0) + v);
  const trophiesBefore = (S.trophies || []).length;
  if (win) { S.trophies = (S.trophies || []).concat([{ n: M.n, c: M.c, d: dayKey() }]); S.xp += 50; SESS.xp += 50; }
  S.duelLog = (S.duelLog || []).concat([{ d: dayKey(), m: M.n, win, turns: D.turn, hearts: D.hearts, used: D.used, offered: D.offered, ok: D.okBy, weak: D.weak, resist: D.resist }]).slice(-20);
  Store.save();
  const newItems = []; AVATAR_CATALOG.forEach(c => c.items.forEach(i => { if (i.trophy && i.trophy > trophiesBefore && i.trophy <= (S.trophies || []).length) newItems.push(i); }));
  SESS.duelResult = win ? "win" : "flee";
  app().innerHTML = `<header class="top sess"><div class="phase">⚔️ Duello della settimana</div></header><section class="card center duel">
    ${win ? `<div class="duel-row"><div class="float">${pet(150, "dw", true)}</div><div>${monsterSVG(M, 110, true)}</div></div>
      <h2>Hai sconfitto il ${esc(M.n)}! 🏆</h2><p>Le parole del regno sono salve. Hai vinto un <b>trofeo</b> e <b>+50 XP</b>.</p>`
          : `<div class="duel-row"><div>${pet(140, "dl", false)}</div><div class="wob">${monsterSVG(M, 130)}</div></div>
      <h2>Il ${esc(M.n)} è scappato!</h2><p>Non hai perso niente: tornerà la settimana prossima, e tu sarai più forte.</p>`}
    ${newItems.length ? `<div class="levelup"><b>🎁 Premio del duellante!</b><p>Sbloccato: ${newItems.map(i => `<b>${esc(i.name)}</b>`).join(", ")}</p></div>` : ""}
    <p class="muted">Incantesimi lanciati: ${Object.entries(D.used).map(([k, v]) => `${powerOf(k).icon}×${v}`).join(" ")}</p>
    <button class="btn primary big" id="cont">Continua ▶</button></section>`;
  $("#cont").onclick = () => { SESS.pi++; SESS.qi = 0; next(); };
}

function duelsHTML() {
  const L = (S.duelLog || []).slice(-6).reverse();
  if (!L.length) return `<p class="muted">${spells().length >= DUEL.MIN_SPELLS ? "Il primo duello arriverà alla fine di una delle prossime lezioni." : `I duelli iniziano quando ha conquistato almeno ${DUEL.MIN_SPELLS} abilità.`}</p>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Giorno</th><th>Esito</th><th>Incantesimi scelti (giuste/lanci)</th><th>Offerti ma mai scelti</th></tr></thead><tbody>${L.map(l => {
    const usedTxt = Object.entries(l.ok || {}).map(([k, [c, n]]) => `${powerOf(k).icon} ${esc(SK[k] ? SK[k].name : k)} <b>${c}/${n}</b>${(l.weak || []).includes(k) ? " 💥" : (l.resist || []).includes(k) ? " 🛡️" : ""}`).join("<br>");
    const avoided = Object.keys(l.offered || {}).filter(k => !(l.used || {})[k]).map(k => `${powerOf(k).icon} ${esc(SK[k] ? SK[k].name : k)}`).join("<br>") || "–";
    return `<tr><td>${l.d.split("-").reverse().slice(0, 2).join("/")}</td><td>${l.win ? "🏆 vinto" : "💨 scappato"}<br><small>${l.turns} turni</small></td><td><small>${usedTxt}</small></td><td><small>${avoided}</small></td></tr>`; }).join("")}</tbody></table></div>
    <p class="muted">💥 = punto debole del mostro (abilità da allenare) · 🛡️ = corazza (incantesimo più usato). Se un incantesimo compare spesso tra gli "offerti ma mai scelti", Nicola lo sta evitando.</p>`;
}

// ---------------- avvio (in fondo, così ogni parte dell'app è già definita) ----------------
// ---------------- «Chi gioca?» ----------------
let WHO_OPEN = false;
const PARENT_OPEN = () => !!document.querySelector("#nicksave");
const gradeLabel = g => GRADES[g] || GRADES.media;
function whoCard(e) {
  const av = Object.assign({}, AVATAR_DEFAULT, e.av || {});
  return `<button class="who-card ${e.id === Profiles.active ? "on" : ""}" data-id="${esc(e.id)}" type="button">
    <span class="who-pet">${creatureSVG(av, e.stage || 0, 96, "w" + e.id.replace(/[^a-z0-9]/gi, ""), e.line || "fuoco", false)}</span>
    <b>${esc(e.name || "Nuovo giocatore")}</b><small>${e.lock ? "🔒 " : ""}${esc(gradeLabel(e.grade))}</small></button>`;
}
async function renderWho() {
  if (SESS) return;
  WHO_OPEN = true; keyHandler = null;
  app().innerHTML = `<section class="card center hero">
    <h1>Incanto Parolum</h1><p class="motto">Chi gioca oggi?</p>
    <div class="who-grid">${Profiles.reg.list.map(whoCard).join("")}</div>
    <p><button class="btn ghost small" id="pgate" type="button">👤 Area genitori</button></p>
  </section>`;
  document.querySelectorAll(".who-card").forEach(b => b.onclick = () => askSecret(b.dataset.id));
  $("#pgate").onclick = renderParentGate;
}
function askSecret(id) {
  const st = id === Profiles.active ? S : Profiles.readLocal(id);
  const secret = st && Array.isArray(st.secret) && st.secret.length === 3 ? st.secret : null;
  if (!secret) return switchProfile(id);
  const e = Profiles.entry(id); let seq = [], fails = 0;
  const draw = msg => {
    app().innerHTML = `<section class="card center">
      <h2>${esc(e.name || "")}, tocca il tuo disegno segreto</h2>
      <p class="muted">${msg || "Le 3 figure, nell'ordine giusto."}</p>
      <div class="secret-dots">${[0, 1, 2].map(k => `<span class="${k < seq.length ? "on" : ""}"></span>`).join("")}</div>
      <div class="pics">${PICS.map((p, k) => `<button class="pic" data-k="${k}" type="button">${p}</button>`).join("")}</div>
      <button class="btn" id="back" type="button">← Chi gioca?</button></section>`;
    $("#back").onclick = renderWho;
    document.querySelectorAll(".pic").forEach(b => b.onclick = () => {
      seq.push(+b.dataset.k);
      if (seq.length < 3) return draw(msg);
      if (seq.every((v, k) => v === secret[k])) return switchProfile(id);
      fails++; seq = [];
      draw(fails >= 3 ? "Non è quello giusto. Se l'hai dimenticato, chiedi a un genitore: può cambiarlo dall'Area genitori." : "Non è quello giusto, riprova!");
      const c = document.querySelector(".pics"); if (c) { c.classList.add("shake"); setTimeout(() => c.classList.remove("shake"), 500); }
    });
  };
  draw();
}
async function switchProfile(id) {
  if (id !== Profiles.active) {
    if (Sync.on()) { try { await Sync.push("cambio giocatore"); } catch (e) {} }
    Store.saveLocal();
    Profiles.reg.active = id; Profiles.save();
    loadProfileState(); Sync.pushedAt = 0; Sync.status = "";
    if (Store.db) { Store.ref = null; Store.connect(onLabRemote); }
  }
  WHO_OPEN = false; boot();
  if (Sync.on()) Sync.pull().then(changed => { if (changed) { applyGrade(S.grade); if (!SESS && !WHO_OPEN) boot(); } });
}

// ---------------- area genitori: gestione dei profili ----------------
function secretPicker(cur) {
  return `<div class="pics small" id="sp">${PICS.map((p, k) => `<button class="pic" data-k="${k}" type="button">${p}</button>`).join("")}</div>
    <p class="muted">Scelti: <span id="spv">${(cur || []).map(k => PICS[k]).join(" ") || "—"}</span> <button class="btn ghost small" id="spclr" type="button">Ricomincia</button></p>`;
}
function wireSecretPicker(onChange) {
  let seq = [];
  const show = () => { $("#spv").textContent = seq.map(k => PICS[k]).join(" ") || "—"; onChange(seq.length === 3 ? seq.slice() : null); };
  document.querySelectorAll("#sp .pic").forEach(b => b.onclick = () => { if (seq.length >= 3) seq = []; seq.push(+b.dataset.k); show(); });
  $("#spclr").onclick = () => { seq = []; show(); };
}
function profilesPanel() {
  const rows = Profiles.reg.list.map(e => `<tr><td><b>${esc(e.name || "—")}</b>${e.id === Profiles.active ? " <small>(attivo)</small>" : ""}</td><td>${esc(gradeLabel(e.grade))}</td><td>${e.lock ? "🔒 sì" : "no"}</td>
    <td>${e.id === Profiles.active ? "" : `<button class="btn small" data-act="use" data-id="${esc(e.id)}" type="button">Apri</button> <button class="btn small warn" data-act="del" data-id="${esc(e.id)}" type="button">Togli</button>`}</td></tr>`).join("");
  return `<h3>👨‍👩‍👦 Profili</h3>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Giocatore</th><th>Classe</th><th>Disegno segreto</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted">Quello che vedi in questa pagina riguarda il profilo attivo: <b>${esc(S.name || "—")}</b>.</p>
    <div class="row left">
      <label class="lbl">Classe di ${esc(S.name || "questo profilo")}</label>
      <select id="pgrade" class="inp">${Object.entries(GRADES).map(([k, v]) => `<option value="${k}" ${S.grade === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      <button class="btn" id="pgsave" type="button">Salva classe</button>
    </div>
    <details class="sub"><summary>🔒 Disegno segreto di ${esc(S.name || "questo profilo")}</summary>
      <p class="muted">Tre figure da toccare in ordine per entrare nel proprio profilo. Serve a non giocare per sbaglio sul profilo dell'altro, non è una protezione forte.</p>
      ${secretPicker(S.secret)}
      <div class="row left"><button class="btn primary" id="spsave" type="button" disabled>Salva disegno</button>${S.secret ? `<button class="btn" id="spoff" type="button">Togli il disegno</button>` : ""}</div>
    </details>
    <details class="sub"><summary>➕ Aggiungi un giocatore</summary>
      <label class="lbl">Nome o soprannome</label><input id="npname" class="inp" maxlength="20" autocomplete="off">
      <label class="lbl">Classe</label><select id="npgrade" class="inp">${Object.entries(GRADES).map(([k, v]) => `<option value="${k}" ${k === "elem4" ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label class="lbl">Disegno segreto (facoltativo): tocca 3 figure</label>
      <div id="npsec">${secretPicker(null)}</div>
      <button class="btn primary" id="npgo" type="button">Crea e inizia la prova di partenza</button>
    </details>
    <div id="prbox"></div>`;
}
function wireProfilesPanel() {
  const box = msg => { $("#prbox").innerHTML = msg; };
  $("#pgsave").onclick = () => { S.grade = $("#pgrade").value; applyGrade(S.grade); Store.save(); renderParent(); $("#prbox").innerHTML = "<p class='note'>Classe aggiornata ✅</p>"; };
  let newSecret = null, mySecret = null;
  // due selettori nella stessa pagina: li collego uno per volta
  const pickers = document.querySelectorAll("#sp");
  pickers[0].id = "sp1"; pickers[1].id = "sp2";
  const spv = document.querySelectorAll("#spv"), clr = document.querySelectorAll("#spclr");
  [[pickers[0], spv[0], clr[0], v => { mySecret = v; $("#spsave").disabled = !v; }], [pickers[1], spv[1], clr[1], v => { newSecret = v; }]].forEach(([pk, view, c, cb]) => {
    let seq = []; const show = () => { view.textContent = seq.map(k => PICS[k]).join(" ") || "—"; cb(seq.length === 3 ? seq.slice() : null); };
    pk.querySelectorAll(".pic").forEach(b => b.onclick = () => { if (seq.length >= 3) seq = []; seq.push(+b.dataset.k); show(); });
    c.onclick = () => { seq = []; show(); };
  });
  $("#spsave").onclick = () => { if (!mySecret) return; S.secret = mySecret; Store.save(); renderParent(); $("#prbox").innerHTML = "<p class='note'>Disegno segreto salvato ✅</p>"; };
  if ($("#spoff")) $("#spoff").onclick = () => { delete S.secret; Store.save(); renderParent(); $("#prbox").innerHTML = "<p class='note'>Disegno tolto.</p>"; };
  document.querySelectorAll("[data-act=use]").forEach(b => b.onclick = () => switchProfile(b.dataset.id));
  document.querySelectorAll("[data-act=del]").forEach(b => b.onclick = () => {
    const e = Profiles.entry(b.dataset.id);
    box(`<p class="note bad">Togliere <b>${esc(e.name || "questo profilo")}</b> da questo dispositivo? ${Sync.on() ? "Il file dei suoi progressi in rete resta e, se lo ricolleghi, torna." : "I suoi progressi su questo dispositivo vanno persi."}</p><button class="btn warn" id="delyes" type="button">Sì, togli</button>`);
    $("#delyes").onclick = () => { try { localStorage.removeItem(Profiles.lsKey(e.id)); } catch (_) {} Profiles.reg.list = Profiles.reg.list.filter(x => x.id !== e.id); Profiles.save(); renderParent(); };
  });
  $("#npgo").onclick = async () => {
    const name = $("#npname").value.trim(); if (!name) { box("<p class='note bad'>Scrivi un nome o un soprannome.</p>"); return; }
    const grade = $("#npgrade").value, id = Profiles.newId(name);
    if (Sync.on()) { try { await Sync.push("cambio giocatore"); } catch (_) {} }
    Store.saveLocal();
    Profiles.reg.list.push({ id, name, grade, stage: 0, line: "fuoco", lock: !!newSecret }); Profiles.reg.active = id; Profiles.save();
    S = freshState(); S.name = name; S.grade = grade; if (newSecret) S.secret = newSecret; applyGrade(grade);
    Sync.pushedAt = 0; Store.save(); if (Store.db) { Store.ref = null; Store.connect(onLabRemote); }
    WHO_OPEN = false; renderOnboarding();
  };
}

function loadProfileState() {
  const local = Store.loadLocal();
  S = local ? normalize(local) : freshState();
  if (!local && Profiles.entry() && Profiles.entry().grade) S.grade = Profiles.entry().grade;
  applyGrade(S.grade);
}
const onLabRemote = remote => { S = normalize(remote); applyGrade(S.grade); Store.saveLocal(); if (!SESS) boot(); };
function syncAfterLoad() {
  if (!(IS_STANDALONE && Sync.load())) return;
  Sync.pull().then(changed => { if (changed) applyGrade(S.grade); if (changed && !SESS && !WHO_OPEN) boot(); })
    .then(() => Sync.discover()).then(added => { if (added && !SESS && Profiles.many() && !WHO_OPEN && !PARENT_OPEN()) renderWho(); });
}
(function init() {
  Profiles.load(); loadProfileState(); Profiles.touch();
  if (Profiles.many()) renderWho(); else boot();
  syncAfterLoad();
  // quando l'app va in secondo piano o si chiude, salva in rete se c'è qualcosa di nuovo
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && !SESS) Sync.push("chiusura"); });
  Store.connect(onLabRemote);
})();

// ---------------- dopo un errore: la spiegazione va letta ----------------
// Evidenzia le lettere sbagliate, mostra la spiegazione in evidenza, tiene fermo il pulsante qualche
// secondo e, negli esercizi da scrivere, chiede di ricopiare la forma giusta prima di andare avanti.
const READ_MS = 3000;
function diffMarks(a, b) {   // quali lettere di a e di b fanno parte della parte comune (LCS)
  const A = a.toLowerCase(), B = b.toLowerCase(), n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ma = new Array(n).fill(false), mb = new Array(m).fill(false); let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { ma[i] = mb[j] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return [ma, mb];
}
function diffHTML(typed, right) {
  const [ma, mb] = diffMarks(typed, right);
  const t = [...typed].map((c, i) => ma[i] ? esc(c) : `<span class="dx">${esc(c)}</span>`).join("");
  const r = [...right].map((c, i) => mb[i] ? esc(c) : `<span class="di">${esc(c)}</span>`).join("");
  return `<div class="diff"><div><small>Hai scritto</small><span class="dw">${t || "—"}</span></div><div class="arrow">→</div><div><small>Giusto</small><span class="dr">${r}</span></div></div>`;
}
function errorFeedback(item, typed, diag) {
  const right = correctText(item);
  const top = typed !== undefined && item.t === "type" ? diffHTML(typed.trim(), right) : `<p>Risposta giusta: <b class="right-ans">${esc(right)}</b></p>`;
  if (diag) return top;
  const tr = TRAP_OF[item.id] && TRAPS[TRAP_OF[item.id]];
  return top + `<div class="why">💡 ${item.x}</div>` + (tr ? `<div class="trap">🧪 <b>${tr.t}</b><br>${tr.d}</div>` : "") +
    (item.t === "type" ? `<div class="retype"><label for="fix">✍️ Riscrivila giusta per continuare:</label><input id="fix" class="inp" autocomplete="off" autocapitalize="off" spellcheck="false"><span id="fixok"></span></div>` : "");
}
function armContinue(item, go) {
  const b = $("#cont"), fix = $("#fix"), t0 = Date.now();
  let timeOk = false, fixOk = !fix;
  b.disabled = true; keyHandler = null;
  const label = () => { b.textContent = !timeOk ? `Leggi la spiegazione… ${Math.max(1, Math.ceil((READ_MS - (Date.now() - t0)) / 1000))}` : !fixOk ? "Riscrivi la parola qui sopra ✍️" : "Ho capito ▶"; };
  const enable = () => {
    label();
    if (timeOk && fixOk) {
      b.disabled = false; b.focus();
      keyHandler = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); done(); } };
    }
  };
  const done = () => { if (b.disabled) return; (SESS.dwell = SESS.dwell || []).push(Date.now() - t0); keyHandler = null; go(); };
  b.onclick = done;
  const tick = setInterval(() => { if (!document.body.contains(b)) return clearInterval(tick); timeOk = Date.now() - t0 >= READ_MS; enable(); if (timeOk) clearInterval(tick); }, 250);
  label();
  if (fix) {
    setTimeout(() => fix.focus(), 50);
    fix.oninput = () => {
      fixOk = item.a.some(a => normAns(a) === normAns(fix.value));
      fix.classList.toggle("right", fixOk); $("#fixok").textContent = fixOk ? "✅" : "";
      enable();
    };
    fix.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!b.disabled) done(); } };
  }
}
