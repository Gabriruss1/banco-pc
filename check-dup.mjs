import fs from 'node:fs';
const s = fs.readFileSync('assets/data.js','utf8');
const re = /amazon: "[^"]*", amazon: "[^"]*"/g;
const m = s.match(re);
console.log('duplicati:', m ? m.length : 0);