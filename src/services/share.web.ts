// Web preview only: card images are shared from the phone app.

import { ComponentRef } from 'react';
import { View } from 'react-native';

export const canShareImages = false;

export async function shareView(_view: ComponentRef<typeof View>): Promise<boolean> {
  return false;
}
