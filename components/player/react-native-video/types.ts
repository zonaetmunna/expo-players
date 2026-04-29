// Independent types for the react-native-video player.
// Do NOT import from components/player/expo-video — strict separation.

export type VideoSourceType = 'mp4' | 'hls' | 'dash' | 'webm' | 'ogg';

export type VideoCategory =
  | 'progressive'
  | 'streaming'
  | 'live'
  | 'drm'
  | 'ads'
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

export type DRMScheme = 'widevine' | 'fairplay' | 'playready' | 'clearkey';

/**
 * DRM configuration for a protected stream. Maps directly to react-native-video's
 * Drm prop. Platform support is enforced at runtime in VideoPlayer:
 *   - widevine  → Android (ExoPlayer)
 *   - fairplay  → iOS / tvOS (AVPlayer)
 *   - playready → Android
 *   - clearkey  → Android (testing only, keys are plaintext)
 *
 * For multi-DRM streams (one manifest, both Widevine + FairPlay), set `multiDrm: true`
 * and provide the per-platform license servers via the platform-specific override fields
 * (consumer can swap the `type` based on Platform.OS before passing to VideoPlayer).
 */
export type VideoDRM = {
  type: DRMScheme;
  /** License server URL. Required unless `getLicense` is provided. */
  licenseServer?: string;
  /** HTTP headers attached to the license request (e.g. auth tokens). */
  headers?: Record<string, string>;
  /** Optional content/key id — required by some FairPlay deployments. */
  contentId?: string;
  /** FairPlay only — URL of the application certificate. */
  certificateUrl?: string;
  /**
   * FairPlay only — set to true when `certificateUrl` returns a base64-encoded
   * certificate (some CDNs do, some return raw DER bytes).
   */
  base64Certificate?: boolean;
  /**
   * Set true when the same manifest is wrapped in multiple DRM schemes (Widevine
   * + PlayReady on a single DASH manifest is the common case).
   */
  multiDrm?: boolean;
  /**
   * Custom license-acquisition callback. Use this when your license server needs
   * pre-/post-processing (e.g. wrapping the SPC in a JSON envelope, attaching a
   * short-lived auth token signed at request time, or proxying through your CDN).
   *
   * Returns the CKC (FairPlay) or license response body (Widevine) as a base64 string.
   */
  getLicense?: (
    spcBase64: string,
    contentId: string,
    licenseUrl: string,
    loadedLicenseUrl: string
  ) => string | Promise<string>;
};

/**
 * IMA Ads configuration — maps to react-native-video's `source.ad` (AdConfig).
 * Native IMA SDK is used on iOS + Android; web is unsupported.
 *
 * - **CSAI** (`type: 'csai'`) — client-side ad insertion via VAST/VMAP `adTagUrl`.
 *   Covers pre-roll, mid-roll, post-roll, skippable linear, and ad pods. The IMA
 *   SDK parses the response, renders ads in the same surface, and emits events
 *   through the player's `onReceiveAdEvent` (CONTENT_PAUSE_REQUESTED, COMPLETED,
 *   SKIPPED, ALL_ADS_COMPLETED, etc.).
 * - **DAI** (`type: 'ssai'`) — Google DAI server-side stitching. Requires a
 *   Google Ad Manager account and a content source/asset key. Stream is fetched
 *   from Google's DAI servers, not the original `uri`.
 *
 * Pick CSAI for ad tag URLs (most common). Pick SSAI when your content is
 * pre-stitched on Google's servers and you have a contentSourceId/videoId.
 */
export type VideoAdsCSAI = {
  type: 'csai';
  /** VAST or VMAP tag URL. VMAP supports VOD pre/mid/post-roll cuepoints. */
  adTagUrl: string;
  /** ISO 639-1 language code for the IMA UI (Skip button, countdown). */
  adLanguage?: string;
};

export type VideoAdsDAI = {
  type: 'ssai';
  streamType: 'vod' | 'live';
  format?: 'hls' | 'dash';
  /** VOD only — Ad Manager content source ID */
  contentSourceId?: string;
  /** VOD only — video ID inside the content source */
  videoId?: string;
  /** Live only — DAI live stream asset key */
  assetKey?: string;
  /** Custom ad request parameters passed through to Google */
  adTagParameters?: Record<string, string>;
  /** Fallback content URI if the DAI stream fails */
  fallbackUri?: string;
  adLanguage?: string;
};

export type VideoAds = VideoAdsCSAI | VideoAdsDAI;

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
  /** Optional IMA Ads config — pre/mid/post-roll, skippable linear, ad pods. iOS + Android only. */
  ads?: VideoAds;
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
