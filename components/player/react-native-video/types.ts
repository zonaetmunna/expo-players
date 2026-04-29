// Independent types for the react-native-video player.
// Do NOT import from components/player/expo-video — strict separation.

export type VideoSourceType = 'mp4' | 'hls' | 'dash' | 'webm' | 'ogg';

export type VideoCategory =
  | 'progressive'
  | 'streaming'
  | 'live'
  | 'drm'
  | 'codec-test'
  | 'edge-case';

export type VideoCodec = 'h264' | 'h265' | 'vp9' | 'vp8' | 'av1' | 'theora';
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'vorbis' | 'ac3' | 'eac3';
export type VideoResolution = '480p' | '720p' | '1080p' | '4k' | '8k' | 'vertical' | '360';
export type VideoHDR = 'hdr10' | 'dolby-vision' | 'hlg';

export type PlatformSupport = {
  supported: boolean;
  minVersion?: string;
  browsers?: string[];
  note?: string;
};

export type VideoPlatforms = {
  ios: PlatformSupport;
  android: PlatformSupport;
  web: PlatformSupport;
};

export type VideoDRM = {
  type: 'widevine' | 'fairplay' | 'playready' | 'clearkey';
  licenseServer: string;
  headers?: Record<string, string>;
  contentId?: string;
  certificateUrl?: string;
};

export type SideLoadedSubtitle = {
  uri: string;
  title: string;
  language: string;
  type: 'srt' | 'ttml' | 'vtt';
};

/**
 * YouTube-style sprite thumbnail config — a single sprite-sheet image plus a WebVTT
 * cues file mapping timestamps to tile coordinates.
 * Industry-standard pattern used by Netflix, YouTube, JW Player, Mux, Bitmovin.
 */
export type SpriteThumbnails = {
  /** URL to the WebVTT cues file (e.g. https://.../thumbs.vtt) */
  vttUri: string;
  /**
   * Optional fallback sprite sheet URL. When set, used if the VTT cues
   * reference relative image paths that can't be resolved to absolute URLs.
   */
  spriteUri?: string;
};

export type VideoItem = {
  id: string;
  title: string;
  description?: string;
  poster?: string;
  uri: string;
  type: VideoSourceType;
  duration?: number;
  drm?: VideoDRM;
  isLive?: boolean;
  /** Optional side-loaded subtitle URLs — rn-video supports these natively (expo-video does not). */
  subtitles?: SideLoadedSubtitle[];
  /** Optional sprite-sheet thumbnails for YouTube-style scrubber preview. */
  spriteThumbnails?: SpriteThumbnails;

  category: VideoCategory;
  codecVideo?: VideoCodec;
  codecAudio?: AudioCodec;
  resolution?: VideoResolution;
  hdr?: VideoHDR;

  platforms: VideoPlatforms;
  restrictions?: string[];
  knownIssues?: string[];
  source?: string;
  license?: string;
};

/** Reactive snapshot of the rn-video player state, mirrored into a JS ref. */
export type RnvSnapshot = {
  currentTime: number;
  duration: number;
  volume: number;
  buffering: boolean;
  isLoaded: boolean;
  isPlaying: boolean;
  videoTracks: Array<{ index: number; width?: number; height?: number; bitrate?: number }>;
  selectedVideoTrack: number | 'auto';
  audioTracks: Array<{ index: number; title?: string; language?: string }>;
  selectedAudioTrack: number | null;
  textTracks: Array<{ index: number; title?: string; language?: string }>;
  selectedTextTrack: number | null;
};
