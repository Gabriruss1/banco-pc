# banco.pc

Configuratore di PC da gioco in italiano: budget, componenti alternativi, controlli di compatibilità e stime di prestazioni.

**Link pubblico (GitHub Pages):** https://gabriruss1.github.io/banco-pc/
Funziona su qualsiasi browser, senza avvisi. Backup su CodeSandbox: https://9t5jmx.csb.app/

## Come si usa

- Apri `index.html` nel browser (doppio clic). Non serve installare nulla.
- Imposta il budget, poi tocca ogni voce della distinta per scegliere tra le alternative.
- `banco-pc.html` è la stessa app in un unico file: puoi allegarla a un'email o caricarla su qualsiasi hosting statico.

## Cosa controlla

- socket CPU / scheda madre
- tipo di RAM (DDR4 / DDR5)
- formato scheda madre / case
- lunghezza GPU e altezza dissipatore
- radiatore AIO supportato dal case
- wattaggio alimentatore con margine
- compatibilità dissipatore / CPU
- risoluzione monitor / potenza GPU

## Prezzi

Sono stime indicative del mercato italiano (novembre 2026), non preventivi. Modificali in `assets/data.js` alla voce `price` per aggiornare tutto il configuratore.

## Sviluppo

Nessuna dipendenza. Dopo aver modificato i file in `assets/`:

```bash
node bundle.mjs
```

per rigenerare `banco-pc.html`.

## Struttura

```
index.html          pagina dell'app
assets/styles.css   stile
assets/data.js      catalogo componenti e build consigliate
assets/app.js       logica: budget, compatibilità, auto-build, UI
banco-pc.html       versione standalone (generata)
bundle.mjs          generatore della versione standalone
```
