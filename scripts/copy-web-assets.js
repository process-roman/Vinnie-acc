// Copies runtime files the web build loads at startup into public/ (not committed).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  ['node_modules/sql.js/dist/sql-wasm-browser.js', 'public/sql-wasm-browser.js'],
  ['node_modules/sql.js/dist/sql-wasm-browser.wasm', 'public/sql-wasm-browser.wasm'],
];

fs.mkdirSync(path.join(root, 'public'), { recursive: true });
for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
}
