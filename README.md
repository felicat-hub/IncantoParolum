# Incanto Parolum

*La scuola di magia delle parole.* Un'app per recuperare la grammatica italiana con **10 minuti al giorno**: ortografia, verbi e analisi logica, con un compagno che evolve dall'uovo al drago.

## Come si usa

Apri l'indirizzo dell'app nel browser e **installala**: così ha l'icona come un'app, si apre a schermo intero e funziona anche senza internet.

- **PC (Chrome o Edge):** clicca l'icona di installazione nella barra degli indirizzi (un monitor con la freccia), oppure menu ⋮ → *Installa Incanto Parolum*.
- **Android (Chrome):** menu ⋮ → *Aggiungi a schermata Home* / *Installa app*.
- **iPhone/iPad (Safari):** tasto Condividi → *Aggiungi alla schermata Home*.

Su iPhone è importante installarla: Safari può cancellare i dati dei siti non installati dopo alcune settimane senza uso.

## Dove stanno i dati

I progressi restano **solo sul dispositivo**: nessun account, nessun server, nessun dato inviato altrove.
Ogni dispositivo ha i suoi progressi. Per spostarli: *Area genitori → Scarica backup* su un dispositivo, poi *Carica backup da file* sull'altro.
Conviene scaricare un backup ogni tanto.

## Per chi sviluppa

- `src/content.js` — abilità, regole ed esercizi (la prima opzione è sempre quella giusta)
- `src/avatar.js` — compagni, evoluzioni, scenari, oggetti e poteri
- `src/app.js` — motore: sessioni, ripetizione dilazionata, combo, area genitori
- `src/index.src.html` — pagina e stili

Aggiornare l'app pubblicata:

```bash
cd src
node validate.js          # controlla la banca esercizi
python3 build.py --pwa    # crea dist/
cp -r dist/. ..           # copia nella radice del repository
```

Prima di pubblicare un aggiornamento, cambia `VERSION` in `src/pwa/sw.js`: così i dispositivi scaricano la versione nuova.
