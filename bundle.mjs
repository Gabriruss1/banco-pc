/* Crea banco-pc.html: un unico file autonomo con CSS e JS inline.
   Utile per allegarlo a un'email o aprirlo senza server. */
import { readFileSync, writeFileSync } from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

let html = read('./index.html');
const css = read('./assets/styles.css');
const data = read('./assets/data.js');
const app = read('./assets/app.js');

html = html.replace(
  '<link rel="stylesheet" href="assets/styles.css">',
  () => `<style>\n${css}\n</style>`
);
html = html.replace(
  '<script src="assets/data.js"></script>',
  () => `<script>\n${data}\n</script>`
);
html = html.replace(
  '<script src="assets/app.js"></script>',
  () => `<script>\n${app}\n</script>`
);

if (html.includes('assets/')) {
  console.warn('Attenzione: restano riferimenti ad assets/.');
}

writeFileSync(new URL('./banco-pc.html', import.meta.url), html);
console.log('Creato banco-pc.html (' + Math.round(html.length / 1024) + ' KB)');
