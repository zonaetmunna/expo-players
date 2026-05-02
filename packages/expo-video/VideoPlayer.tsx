import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoContentFit } from 'expo-video';
import { useEffect, useState } from 'react';
import { CastButton, useRemoteMediaClient } from 'react-native-google-cast';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PlayerGestures } from './PlayerGestures';
import { VideoFilmstrip } from './VideoFilmstrip';
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
  startsPictureInPictureAutomatically?: boolean;
  contentFit?: VideoContentFit;
  gesturesEnabled?: boolean;
  showFilmstrip?: boolean;
  style?: ViewStyle;
  onPlayingChange?: (isPlaying: boolean) => void;
  onStatusChange?: (status: string) => void;
};

function getCastContentType(type: VideoItem['type']) {
  if (type === 'hls') return 'application/x-mpegurl';
  if (type === 'dash') return 'application/dash+xml';
  if (type === 'webm') return 'video/webm';
  if (type === 'ogg') return 'video/ogg';
  return 'video/mp4';
}

export function VideoPlayer({
  source,
  autoPlay = true,
  loop = false,
  muted = false,
  nativeControls = true,
  fullscreenEnabled = true,
  allowsPictureInPicture = true,
  startsPictureInPictureAutomatically = false,
  contentFit = 'contain',
  gesturesEnabled = true,
  showFilmstrip = false,
  style,
  onPlayingChange,
  onStatusChange,
}: Props) {
  const castClient = useRemoteMediaClient();
  const canCastVideo = !source.drm;
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
  const allowNativeFullscreen = fullscreenEnabled && !gesturesEnabled;
  const autoPiP = allowsPictureInPicture && startsPictureInPictureAutomatically;

  const [fit, setFit] = useState<VideoContentFit>(contentFit);

  useEffect(() => {
    setFit(contentFit);
  }, [contentFit]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!castClient || !canCastVideo) return;

    castClient
      .loadMedia({
        mediaInfo: {
          contentUrl: source.uri,
          contentType: getCastContentType(source.type),
          metadata: {
            type: 'movie',
            title: source.title,
            subtitle: source.description ?? undefined,
            images: source.poster ? [{ url: source.poster }] : undefined,
          },
          streamDuration: source.duration,
        },
      })
      .catch(() => {
        // ignore cast load failures to avoid affecting local playback
      });
  }, [canCastVideo, castClient, source]);

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
    <View style={style}>
      <View style={styles.container}>
        <PlayerGestures
          player={player}
          snapshot={snapshot}
          contentFit={fit}
          onContentFitChange={setFit}
          enabled={gesturesEnabled}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            nativeControls={nativeControls}
            fullscreenOptions={{ enable: allowNativeFullscreen }}
            allowsPictureInPicture={allowsPictureInPicture}
            startsPictureInPictureAutomatically={autoPiP}
            contentFit={fit}
          />
        </PlayerGestures>
        {canCastVideo ? (
          <View style={styles.castButtonWrap} pointerEvents="box-none">
            <CastButton style={styles.castButton} />
          </View>
        ) : null}
      </View>
      {showFilmstrip ? <VideoFilmstrip player={player} source={source} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
  },
  castButtonWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 5,
  },
  castButton: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
});
