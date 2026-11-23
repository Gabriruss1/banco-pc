import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync(new URL('./amazon-links.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
// Le ultime N righe sono la scansione piu recente (vince la validazione severa)
const byId = new Map();
for (const x of lines) if (x.id !== 'test') byId.set(x.id, x);
const clean = [...byId.values()];
writeFileSync(new URL('./amazon-links.json', import.meta.url), JSON.stringify(clean, null, 2));

console.log('totale:', clean.length);
console.log('diretti:', clean.filter(x => x.kind === 'product').length);
console.log('ricerca:', clean.filter(x => x.kind === 'search').length);
console.log('\n--- link di ricerca ---');
clean.filter(x => x.kind === 'search').forEach(x => console.log(x.id, '|', x.name, '| score', x.score, '|', x.title.slice(0, 70)));
console.log('\n--- match deboli (score < 0.8) ---');
clean.filter(x => x.kind === 'product' && x.score < 0.8).forEach(x => console.log(x.id, '|', x.name, '| score', x.score, '|', x.title.slice(0, 80)));
console.log('\n--- duplicati ASIN ---');
const seen = new Map();
clean.filter(x => x.asin).forEach(x => seen.set(x.asin, [...(seen.get(x.asin) || []), x.id]));
[...seen].filter(([, ids]) => ids.length > 1).forEach(([a, ids]) => console.log(a, ids.join(', ')));
