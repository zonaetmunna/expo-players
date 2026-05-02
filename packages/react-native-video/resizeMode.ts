// rn-video uses string literals "cover" | "contain" | "stretch" | "none"
// We expose only the ones we use for pinch-to-zoom.

export type ResizeMode = 'contain' | 'cover' | 'stretch' | 'none';
