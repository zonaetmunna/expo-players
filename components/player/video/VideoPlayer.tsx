import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { VideoItem } from './types';

type Props = {
  source: VideoItem;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  nativeControls?: boolean;
  fullscreenEnabled?: boolean;
  allowsPictureInPicture?: boolean;
  contentFit?: VideoContentFit;
  style?: ViewStyle;
  onPlayingChange?: (isPlaying: boolean) => void;
  onStatusChange?: (status: string) => void;
};

export function VideoPlayer({
  source,
  autoPlay = true,
  loop = false,
  muted = false,
  nativeControls = true,
  fullscreenEnabled = true,
  allowsPictureInPicture = true,
  contentFit = 'contain',
  style,
  onPlayingChange,
  onStatusChange,
}: Props) {
  const player = useVideoPlayer(
    {
      uri: source.uri,
      drm: source.drm,
      contentType:
        source.type === 'hls'
          ? 'hls'
          : source.type === 'dash'
            ? 'dash'
            : source.type === 'mp4'
              ? 'progressive'
              : 'auto',
      metadata: {
        title: source.title,
        artwork: source.poster,
      },
    },
    (p) => {
      p.loop = loop;
      p.muted = muted;
      if (autoPlay) p.play();
    }
  );

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  return (
    <View style={[styles.container, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={nativeControls}
        fullscreenOptions={{ enable: fullscreenEnabled }}
        allowsPictureInPicture={allowsPictureInPicture}
        contentFit={contentFit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
  },
});
