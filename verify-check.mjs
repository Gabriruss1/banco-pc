import { readFileSync } from 'node:fs';

const canon = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()
  .replace(/(\d+)\s*(gb|tb|mb|mm|w|hz|mhz|mt|rpm|g)\b/g,'$1$2');
const keys = n => canon(n).split(' ').filter(t => /\d/.test(t) && t.length >= 2);

const lines = readFileSync(new URL('./amazon-links.jsonl', import.meta.url),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
const ver = new Map();
for (const x of lines) if (x.id && x.id.startsWith('verify:')) ver.set(x.id.slice(7), x);
const links = new Map(JSON.parse(readFileSync(new URL('./amazon-links.json', import.meta.url),'utf8')).map(x=>[x.id,x]));

const bad = [];
let ok = 0;
for (const [id, v] of ver) {
  const p = links.get(id);
  if (!p) continue;
  const ct = canon(v.title||'');
  const kk = keys(p.name);
  const missing = kk.filter(k => !ct.includes(k));
  // modello con suffisso X diverso: 5600 -> 5600X e' sbagliato
  // il suffisso X e' un problema solo per le CPU (5600 vs 5600X); sulle GPU
  // RX 9070 XT / 7900 XTX e' invece la denominazione corretta
  const isCpu = /^(amd ryzen|intel core|intel core ultra)/i.test(p.name);
  const variant = isCpu && kk.find(k => /^\d+$/.test(k) && ct.includes(k+'x') && !canon(p.name).includes(k+'x'));
  if (!v.title || v.title.startsWith('ERR') || v.bad || missing.length || variant) {
    bad.push({ id, name:p.name, asin:p.asin, title:(v.title||'').slice(0,95), missing, variant: variant||'' });
  } else ok++;
}
console.log('verificati:', ver.size, '| OK:', ok, '| da correggere:', bad.length);
bad.forEach(x => console.log(x.id.padEnd(20), '|', x.missing.join(',')||x.variant, '|', x.title));
