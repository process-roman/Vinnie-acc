// Builds the website into dist/: the landing page from site/, and the app in demo mode at /app.
// Run with: npm run build:site

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
execSync('npx expo export --platform web --output-dir dist/app', {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    VINNIE_SITE: '1',
    EXPO_PUBLIC_DEMO: 'true',
    EXPO_PUBLIC_BASE_PATH: '/app',
  },
});
fs.cpSync(path.join(root, 'site'), dist, { recursive: true });
console.log('Site built in dist/');
