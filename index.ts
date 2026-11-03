// Entry point. Some platforms need a runtime loaded before the app's modules are
// evaluated (web: Skia's CanvasKit wasm), so the router is required only after
// `prepareRuntime` resolves. It lives in src/boot.ts / src/boot.web.ts so the web
// loader is never bundled for phones.
/* eslint-disable @typescript-eslint/no-require-imports -- load order matters here, so this can't be a static import */
import { prepareRuntime } from './src/boot';

prepareRuntime().then(() => require('expo-router/entry'));
