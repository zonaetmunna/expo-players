// Shared skin API. Every skin is a React component that accepts these props
// and renders the controls layer. The router (CustomControls.tsx) picks one
// skin at a time based on the `skin` prop on VideoPlayer.

import type { RnvSnapshotRef } from '../hooks/useRnvPlayerSnapshot';
import type { ResizeMode } from '../resizeMode';
import type { RnvSnapshot, SpriteThumbnails } from '../types';

export type SkinId = 'default' | 'netflix' | 'youtube';

export const SKIN_OPTIONS: { key: SkinId; label: string; sub: string }[] = [
  { key: 'default', label: 'Default', sub: 'Standard player look' },
  { key: 'netflix', label: 'Netflix', sub: 'Dark, red accent, prominent' },
  { key: 'youtube', label: 'YouTube', sub: 'Red progress, minimal chrome' },
];

export type SkinProps = {
  snapshot: RnvSnapshotRef;
  state: Pick<
    RnvSnapshot,
    | 'currentTime'
    | 'duration'
    | 'isLoaded'
    | 'isPlaying'
    | 'buffering'
    | 'videoTracks'
    | 'selectedVideoTrack'
    | 'audioTracks'
    | 'selectedAudioTrack'
    | 'textTracks'
    | 'selectedTextTrack'
  >;
  title: string;
  isLive: boolean;
  hasError: boolean;
  /** Optional human-readable error message — shown by skins below the error icon. */
  errorMessage?: string | null;
  isEnded?: boolean;
  /**
   * True while IMA is rendering an ad (between CONTENT_PAUSE_REQUESTED and
   * CONTENT_RESUME_REQUESTED). Skins should hide their own chrome — IMA renders
   * its skip button / countdown / click-through natively over the surface.
   */
  isInAdBreak?: boolean;
  rate: number;
  resizeMode: ResizeMode;
  isFullscreen: boolean;
  canCast?: boolean;
  isCasting?: boolean;
  spriteThumbnails?: SpriteThumbnails;
  /** Currently active skin — shown as selected in the picker */
  skin: SkinId;
  onPlay: () => void;
  onPause: () => void;
  onReplay?: () => void;
  onSeek: (time: number) => void;
  onSetRate: (r: number) => void;
  onSelectVideoTrack: (index: number | 'auto') => void;
  onSelectAudioTrack: (index: number | null) => void;
  onSelectTextTrack: (index: number | null) => void;
  onSelectResizeMode: (mode: ResizeMode) => void;
  onSelectSkin: (id: SkinId) => void;
  onToggleFullscreen: () => void;
  onRequestPiP?: () => void;
  onRetry: () => void;
  onRequestBack?: () => void;
};
