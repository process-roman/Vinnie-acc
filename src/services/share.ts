// Shares a rendered card as a PNG through the system share sheet (blueprint 7.3).
// Nothing is ever shared automatically.

import * as Sharing from 'expo-sharing';
import { ComponentRef } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export const canShareImages = true;

export async function shareView(view: ComponentRef<typeof View>): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Vinnie' });
  return true;
}
