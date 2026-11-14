// Controllo automatico della banca esercizi
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/content.js", "utf8").replace(/^const /gm, "var "));
eval(fs.readFileSync(__dirname + "/avatar.js", "utf8").replace(/^const /gm, "var ").replace(/^"use strict";/m, ""));
const errs = [], ids = new Set(), skillIds = new Set(SKILLS.map(s => s.id));
SKILLS.forEach(s => s.pre.forEach(p => { if (!skillIds.has(p)) errs.push(`${s.id}: prerequisito ${p} inesistente`); }));
ITEMS.forEach(i => {
  if (ids.has(i.id)) errs.push("id duplicato " + i.id); ids.add(i.id);
  if (!skillIds.has(i.s)) errs.push(i.id + ": abilità " + i.s);
  if (!i.x) errs.push(i.id + ": manca spiegazione");
  if (i.t === "pick") { if (!Array.isArray(i.c) || i.a < 0 || i.a >= i.c.length) errs.push(i.id + ": pick non valido"); }
  else if (i.t === "mc" || i.t === "cloze") {
    if (!Array.isArray(i.o) || i.o.length < 2) errs.push(i.id + ": opzioni");
    if (new Set(i.o).size !== i.o.length) errs.push(i.id + ": opzioni duplicate");
    if (i.t === "cloze" && (i.q.match(/___/g) || []).length !== 1) errs.push(i.id + ": cloze senza un solo ___");
  } else if (i.t === "type") {
    if (!Array.isArray(i.a) || !i.a.length) errs.push(i.id + ": risposte mancanti");
    if ((i.q.match(/___/g) || []).length !== 1) errs.push(i.id + ": type senza un solo ___");
  } else errs.push(i.id + ": tipo " + i.t);
});
// controlli di coerenza aggiuntivi (v2.3.1)
const seenQ = new Map();
ITEMS.forEach(i => {
  if (!i.x || i.x.trim().length < 8) errs.push(i.id + ": manca la spiegazione");
  if (i.o) {
    const low = i.o.map(o => o.trim().toLowerCase());
    if (new Set(low).size !== low.length) errs.push(i.id + ": opzioni duplicate");
    if (low.some(o => !o)) errs.push(i.id + ": opzione vuota");
  }
  if (i.t === "type" && i.a.some(a => a !== a.trim())) errs.push(i.id + ": risposta con spazi");
  if (i.lv && ![1, 2, 3].includes(i.lv)) errs.push(i.id + ": livello non valido");
  if (/\ba me mi\b/i.test(i.q) && !/errore/i.test(i.q)) errs.push(i.id + ": «a me mi» fuori da un esercizio sull'errore");
  const key = i.s + "|" + i.q + "|" + (i.o || i.c || i.a || []).join("|");
  if (seenQ.has(key)) errs.push(i.id + ": doppione di " + seenQ.get(key)); else seenQ.set(key, i.id);
});
SKILLS.forEach(s => {
  const n = ITEMS.filter(i => i.s === s.id).length, d = ITEMS.filter(i => i.s === s.id && i.d).length;
  if (!POWERS[s.id]) errs.push(`${s.id}: manca il potere`);
  if (d !== 2) errs.push(`${s.id}: ${d} domande diagnostiche (attese 2)`);
  console.log(s.id.padEnd(10), n, "esercizi");
});
console.log("Totale:", ITEMS.length, "esercizi,", SKILLS.length, "abilità");
console.log(errs.length ? "ERRORI:\n" + errs.join("\n") : "Nessun errore ✔");
process.exit(errs.length ? 1 : 0);
