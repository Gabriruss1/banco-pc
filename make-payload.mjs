/* Costruisce il payload JSON per il deploy su CodeSandbox (template static)
   senza far esplodere PowerShell: usa node per leggere e serializzare. */
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('./banco-pc.html', import.meta.url), 'utf8');
const payload = {
  template: 'static',
  files: {
    'index.html': { content: html },
    'sandbox.config.json': { content: '{"template":"static"}' }
  }
};
writeFileSync(new URL('./deploy-payload.json', import.meta.url), JSON.stringify(payload));
console.log('payload KB:', Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024));
