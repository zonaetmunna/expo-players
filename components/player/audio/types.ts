export type AudioSourceType = 'mp3' | 'aac' | 'flac' | 'ogg' | 'wav' | 'opus' | 'hls' | 'stream';

export type AudioItem = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  uri: string;
  type: AudioSourceType;
  duration?: number;
  isLive?: boolean;
};
