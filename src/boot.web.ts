// Web: CanvasKit (Skia's wasm runtime) must be loaded before any module that imports
// @shopify/react-native-skia is evaluated. canvaskit.wasm is copied to public/ by
// postinstall.

import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

export async function prepareRuntime(): Promise<void> {
  await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
}
