import { readFileSync, writeFileSync } from 'node:fs';
const f = new URL('./amazon-links.json', import.meta.url);
const d = JSON.parse(readFileSync(f, 'utf8'));
const fixes = {
  'cpu-5600': { asin:'B09VCHR1VH', title:'Processore AMD Ryzen 5 5600 (6 Cores/12 Threads, 65W, AM4 Socket) con Wraith Stealth' },
  'cpu-7700': { asin:'B0C3T39N6P', title:'AMD Ryzen 7 7700 processore 3,8 GHz 32 MB L3' }
};
for (const [id, fix] of Object.entries(fixes)) {
  const x = d.find(y => y.id === id);
  x.asin = fix.asin;
  x.url = 'https://www.amazon.it/dp/' + fix.asin;
  x.title = fix.title;
  x.kind = 'product';
  x.score = 1;
  console.log('corretto', id, '->', x.url);
}
writeFileSync(f, JSON.stringify(d, null, 2));
