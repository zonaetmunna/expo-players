// Web stub — react-native-volume-manager has no web build. We expose the same
// surface our hook touches but with no-op implementations.

type Sub = { remove: () => void };

export const VolumeManager = {
  getVolume: async (): Promise<{ volume: number }> => ({ volume: 1 }),
  setVolume: async (_v: number): Promise<void> => {
    // no-op on web — page-level audio uses HTMLMediaElement.volume directly
  },
  showNativeVolumeUI: async (_config: { enabled: boolean }): Promise<void> => {
    // no-op
  },
  addVolumeListener: (_cb: (r: { volume: number }) => void): Sub => ({
    remove: () => {},
  }),
};
