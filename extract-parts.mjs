import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./assets/data.js', import.meta.url), 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__out = { PARTS, CATEGORIES };', ctx);
const { PARTS, CATEGORIES } = ctx.__out;

writeFileSync(new URL('./parts-list.json', import.meta.url), JSON.stringify(
  PARTS.map(p => ({ id: p.id, cat: p.cat, name: p.name, short: p.short || '' })), null, 2
));
console.log('prodotti:', PARTS.length, 'categorie:', CATEGORIES.length);
