import { readFileSync } from 'node:fs';

import fs from 'node:fs';
import vm from 'node:vm';
const src = fs.readFileSync(new URL('./assets/data.js', import.meta.url), 'utf8');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';globalThis.P=PARTS;', ctx);
const priceById = new Map(ctx.P.map(x => [x.id, x.price]));

const lines = readFileSync(new URL('./amazon-links.jsonl', import.meta.url),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
const byId = new Map();
for (const x of lines) {
  if (!x.id || x.id.startsWith('verify:') || x.id.startsWith('price:') || x.id === 'test') continue;
  byId.set(x.id, x);
}

const parsePrice = s => {
  if (!s || s === 'ERR') return null;
  const m = String(s).replace(/\s/g,'').match(/[\d.,]+/);
  if (!m) return null;
  let t = m[0];
  // Italian: 1.234,56 or 123,45
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g,'').replace(',','.');
  else if (t.includes(',')) t = t.replace(',','.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
};

const bad = [];
let ok = 0;
for (const [id, v] of byId) {
  const amz = parsePrice(v.amazonPrice);
  const cat = priceById.get(id);
  let flag = '';
  if (amz === null) flag = 'PREZZO NON TROVATO';
  else if (amz > cat * 2.5 || amz < cat * 0.4) flag = 'MISMATCH (cat €' + cat + ' vs amz €' + amz + ')';
  else ok++;
  if (flag) bad.push({ id, name:v.name, catalog:cat, amazon:amz, title:(v.amazonTitle||'').slice(0,80), flag });
}
console.log('verificati:', byId.size, '| OK:', ok, '| problemi:', bad.length);
bad.forEach(x => console.log(x.id.padEnd(22), '| cat €'+x.catalog, '| amz €'+(x.amazon??'?'), '|', x.flag, '|', x.title));
