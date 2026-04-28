import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PlayerGestures } from './PlayerGestures';
import { usePlayerSnapshot } from './hooks/usePlayerSnapshot';
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
  gesturesEnabled?: boolean;
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
  gesturesEnabled = true,
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

  const snapshot = usePlayerSnapshot(player);

  const [fit, setFit] = useState<VideoContentFit>(contentFit);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setFit(contentFit);
  }, [contentFit]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Fix D: ensure 2x boost from long-press is reset on unmount
  useEffect(() => {
    return () => {
      try {
        player.playbackRate = 1;
      } catch {
        // player may be released already
      }
    };
  }, [player]);

  return (
    <View style={[styles.container, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={nativeControls}
        fullscreenOptions={{ enable: fullscreenEnabled }}
        allowsPictureInPicture={allowsPictureInPicture}
        contentFit={fit}
        onFullscreenEnter={() => setIsFullscreen(true)}
        onFullscreenExit={() => setIsFullscreen(false)}
      />
      <PlayerGestures
        player={player}
        snapshot={snapshot}
        contentFit={fit}
        onContentFitChange={setFit}
        enabled={gesturesEnabled && !isFullscreen}
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
