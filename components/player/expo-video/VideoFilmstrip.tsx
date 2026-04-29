import { Image } from 'expo-image';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { VideoItem } from './types';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

type Props = {
  player: VideoPlayer;
  source: VideoItem;
  /** Number of thumbnails to generate across the duration. Default 8. */
  count?: number;
  /** Width of each thumbnail in dp. Default 120. */
  thumbWidth?: number;
};

type Cell = {
  time: number;
  thumb: VideoThumbnail | null;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoFilmstrip({ player, source, count = 8, thumbWidth = 120 }: Props) {
  const [cells, setCells] = useState<Cell[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = !supported
    ? 'Thumbnails are not supported on web'
    : source.isLive
      ? 'Live streams have no timeline'
      : source.drm
        ? 'DRM video frames cannot be sampled'
        : null;

  useEffect(() => {
    if (blocked) {
      setCells([]);
      return;
    }
    let cancelled = false;
    setError(null);

    const tryGenerate = async (attempt = 0) => {
      const duration = player.duration;
      if (!duration || duration <= 0) {
        if (attempt < 8 && !cancelled) {
          // wait for the source to load, retry briefly
          setTimeout(() => tryGenerate(attempt + 1), 500);
        }
        return;
      }
      setGenerating(true);
      try {
        const times: number[] = [];
        // sample at the midpoint of N equal slices, skipping t=0
        const step = duration / count;
        for (let i = 0; i < count; i++) {
          times.push(Math.min(duration - 0.1, step * i + step / 2));
        }
        const results = await player.generateThumbnailsAsync(times, {
          maxWidth: Math.round(thumbWidth * 2),
        });
        if (cancelled) return;
        const next = times.map((time, i) => ({ time, thumb: results[i] ?? null }));
        setCells(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to generate thumbnails');
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    };

    tryGenerate();
    return () => {
      cancelled = true;
    };
  }, [player, source, count, thumbWidth, blocked]);

  const seekTo = (t: number) => {
    try {
      player.currentTime = t;
    } catch {
      // ignore
    }
  };

  if (blocked) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Filmstrip unavailable: {blocked}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Filmstrip error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Scenes</Text>
        {generating ? <ActivityIndicator size="small" color="#0a84ff" /> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {cells.length === 0 && !generating ? (
          <View style={[styles.cell, { width: thumbWidth, height: thumbWidth * (9 / 16) }]}>
            <Text style={styles.emptyText}>Loading…</Text>
          </View>
        ) : null}
        {cells.map((c, i) => (
          <Pressable
            key={i}
            onPress={() => seekTo(c.time)}
            style={[
              styles.cell,
              { width: thumbWidth, height: thumbWidth * (9 / 16) },
            ]}>
            {c.thumb ? (
              <Image
                source={c.thumb}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.placeholder}>
                <ActivityIndicator size="small" color="#999" />
              </View>
            )}
            <View style={styles.timePill}>
              <Text style={styles.timeText}>{formatTime(c.time)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#71717a',
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  cell: {
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePill: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  empty: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 12,
    color: '#71717a',
  },
});
