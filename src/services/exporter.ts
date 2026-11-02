// Export on devices: writes the file to the cache and opens the share sheet, so you
// choose where it goes (Files, email, Drive...). Web uses exporter.web.ts.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportFile(name: string, text: string, mimeType: string): Promise<boolean> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  return true;
}
