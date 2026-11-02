// Entry point. On web, CanvasKit (Skia's wasm runtime) must be loaded before any
// module that imports @shopify/react-native-skia is evaluated, so the router is
// required only after it resolves.
/* eslint-disable @typescript-eslint/no-require-imports -- load order matters here, so these can't be static imports */
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() =>
    require('expo-router/entry'),
  );
} else {
  require('expo-router/entry');
}
