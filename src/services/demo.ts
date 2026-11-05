// The website's demo of the app. Set at build time (scripts/build-site.js), so phone builds
// never have it.

export const isDemo = process.env.EXPO_PUBLIC_DEMO === 'true';

/** Where the app is served from: '' normally, '/app' on the website. */
export const basePath = process.env.EXPO_PUBLIC_BASE_PATH ?? '';

/** Tells the landing page the app is up, so it can stop showing its loading screen. */
export function announceDemoReady(): void {
  if (isDemo && typeof window !== 'undefined') {
    window.parent.postMessage('vinnie-ready', window.location.origin);
  }
}
