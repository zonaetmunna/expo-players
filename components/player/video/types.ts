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
