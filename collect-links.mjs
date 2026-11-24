import { createServer } from 'node:http';
import { appendFileSync, readFileSync } from 'node:fs';

const OUT = new URL('./amazon-links.jsonl', import.meta.url);
const PARTS = new URL('./parts-list.json', import.meta.url);

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/parts') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(readFileSync(PARTS));
    return;
  }
  if (req.method === 'GET' && req.url === '/partswithprice') {
    const src = readFileSync(new URL('./assets/data.js', import.meta.url), 'utf8');
    const out = [];
    const re = /\{\s*id:\s*'([^']+)'\s*,[^}]*?price:\s*(\d+)/gs;
    let m;
    while ((m = re.exec(src)) !== null) out.push({ id: m[1], price: Number(m[2]) });
    // aggiungi i nomi da parts-list
    const names = JSON.parse(readFileSync(PARTS, 'utf8'));
    const byId = new Map(names.map(x => [x.id, x.name]));
    out.forEach(x => x.name = byId.get(x.id) || x.id);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(out));
    return;
  }
  if (req.method === 'GET' && req.url === '/links') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(readFileSync(new URL('./amazon-links.json', import.meta.url)));
    return;
  }
  if (req.method === 'GET' && req.url === '/count') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(String(readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).length));
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' });
    res.end();
    return;
  }
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      for (const item of data) appendFileSync(OUT, JSON.stringify(item) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, saved: data.length }));
    } catch (e) {
      res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
      res.end(String(e));
    }
  });
}).listen(7899, '127.0.0.1', () => console.log('raccoglitore pronto su 7899'));
