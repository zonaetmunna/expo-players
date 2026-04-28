import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { AudioItem } from './types';

type Props = {
  source: AudioItem;
  autoPlay?: boolean;
  loop?: boolean;
  showLockScreenControls?: boolean;
  style?: ViewStyle;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  source,
  autoPlay = false,
  loop = false,
  showLockScreenControls = true,
  style,
}: Props) {
  const player = useAudioPlayer(source.uri, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const didAutoPlayRef = useRef(false);

  useEffect(() => {
    player.loop = loop;
  }, [player, loop]);

  useEffect(() => {
    if (!autoPlay || didAutoPlayRef.current) return;
    if (status.isLoaded) {
      didAutoPlayRef.current = true;
      player.play();
    }
  }, [autoPlay, status.isLoaded, player]);

  useEffect(() => {
    if (!showLockScreenControls) return;
    player.setActiveForLockScreen(true, {
      title: source.title,
      artist: source.artist,
      albumTitle: source.album,
      artworkUrl: source.artwork,
    });
  }, [player, source, showLockScreenControls]);

  const progress = useMemo(() => {
    if (!status.duration || status.duration <= 0) return 0;
    return Math.min(1, Math.max(0, status.currentTime / status.duration));
  }, [status.currentTime, status.duration]);

  const togglePlay = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const seekRelative = (delta: number) => {
    const target = Math.min(
      Math.max(0, status.currentTime + delta),
      Math.max(0, status.duration || 0)
    );
    player.seekTo(target);
  };

  const showSpinner = !status.isLoaded || status.isBuffering;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(status.currentTime)}</Text>
        <Text style={styles.time}>
          {source.isLive ? 'LIVE' : formatTime(status.duration)}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel="Rewind 15 seconds"
          onPress={() => seekRelative(-15)}
          style={styles.sideBtn}
          disabled={source.isLive}>
          <Text style={[styles.sideBtnText, source.isLive && styles.disabled]}>−15s</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          onPress={togglePlay}
          style={styles.playBtn}>
          {showSpinner && !status.playing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.playBtnText}>{status.playing ? '❚❚' : '▶'}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Forward 30 seconds"
          onPress={() => seekRelative(30)}
          style={styles.sideBtn}
          disabled={source.isLive}>
          <Text style={[styles.sideBtnText, source.isLive && styles.disabled]}>+30s</Text>
        </Pressable>
      </View>
      <Text style={styles.statusLine}>
        {status.playing
          ? 'Playing'
          : status.isBuffering
            ? 'Buffering…'
            : status.isLoaded
              ? 'Ready'
              : 'Loading…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 12,
    gap: 8,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#e5e5ea',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0a84ff',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: '#666',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 4,
  },
  sideBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sideBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a84ff',
  },
  disabled: {
    color: '#bbb',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statusLine: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});
