import { Platform, useWindowDimensions } from 'react-native';

/** Keep native layouts independent of browser desktop presentation. */
export function useDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 1024;
}
