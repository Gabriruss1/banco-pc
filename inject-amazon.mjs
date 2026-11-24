import { readFileSync, writeFileSync } from 'node:fs';

const links = new Map(
  JSON.parse(readFileSync(new URL('./amazon-links.json', import.meta.url), 'utf8'))
    .map(x => [x.id, x.url])
);
const f = new URL('./assets/data.js', import.meta.url);
let src = readFileSync(f, 'utf8');

// 1. Rimuovi tutti i campi amazon esistenti (vecchi e nuovi)
src = src.replace(/,?\s*amazon:\s*"[^"]*"/g, '');

// 2. Inserisci il nuovo campo amazon dopo l'id
let cnt = 0;
src = src.replace(/\{ id: '([^']+)',/g, (whole, id) => {
  const url = links.get(id);
  if (!url) return whole;
  cnt++;
  return whole + ` amazon: ${JSON.stringify(url)},`;
});

if (cnt !== links.size) {
  console.warn(`Attenzione: iniettati ${cnt} link su ${links.size}`);
}
writeFileSync(f, src);
console.log('link iniettati:', cnt);