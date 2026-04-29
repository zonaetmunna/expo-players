// Web stub — expo-brightness is iOS+Android only.
// The hook checks Platform.OS and returns a disabled gesture on web; this stub
// only exists to satisfy Metro's import resolution.

export async function getBrightnessAsync(): Promise<number> {
  return 1;
}
export async function setBrightnessAsync(_v: number): Promise<void> {
  // no-op
}
export async function requestPermissionsAsync(): Promise<{ granted: boolean }> {
  return { granted: false };
}
export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
} as const;
