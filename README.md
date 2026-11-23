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

## Link Amazon

Ogni componente ha un campo `amazon` in `assets/data.js`. Nei 113 prodotti:
- 87 puntano alla scheda prodotto reale su Amazon.it (ASIN verificato aprendo la pagina e controllando il titolo)
- 26 puntano alla ricerca Amazon per quel componente (sono voci generiche come "Case ATX airflow" o "Cuffie gaming entry", senza un singolo modello di riferimento)

I link appaiono come "Vedi su Amazon" dentro ogni alternativa del selettore.

## Prezzi

Sono stime indicative del mercato italiano (novembre 2026), non preventivi. Modificali in `assets/data.js` alla voce `price` per aggiornare tutto il configuratore. I link Amazon non sono affiliati.

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
assets/data.js      catalogo componenti, link Amazon e build consigliate
assets/app.js       logica: budget, compatibilità, auto-build, UI
banco-pc.html       versione standalone (generata)
bundle.mjs          generatore della versione standalone
```
