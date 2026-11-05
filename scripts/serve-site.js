// Serves dist/ locally the way Vercel will, with the like counter kept in memory.
// Run npm run build:site first, then: npm run site

const fs = require('fs');
const http = require('http');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const PORT = 8092;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};
let likes = 37;

function fileFor(url) {
  const clean = path.normalize(decodeURIComponent(url)).replace(/^([/\\.])+/, '');
  const candidate = path.join(dist, clean);
  if (!candidate.startsWith(dist)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (url === '/' || url === '') return path.join(dist, 'index.html');
  // The same rewrite as vercel.json: any other /app path is the single-page app.
  return url.startsWith('/app') ? path.join(dist, 'app', 'index.html') : null;
}

http
  .createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/api/likes') {
      if (req.method === 'POST') likes += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ count: likes }));
      return;
    }
    const file = fileFor(url);
    if (!file) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`Site on http://localhost:${PORT}`));
