import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image as RNImage, StyleSheet, View } from 'react-native';

import type { SpriteCue } from './useSpriteThumbnails';

type Props = {
  cue: SpriteCue;
  /** Width of the rendered tile in dp. Height is derived from the cue aspect ratio. */
  width?: number;
};

// Module-level cache so re-mounting the bubble while scrubbing doesn't re-fetch sizes.
const sheetSizeCache = new Map<string, { width: number; height: number }>();
const inflight = new Map<string, Promise<{ width: number; height: number }>>();

function getSheetSize(uri: string): Promise<{ width: number; height: number }> {
  const cached = sheetSizeCache.get(uri);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(uri);
  if (existing) return existing;
  const p = new Promise<{ width: number; height: number }>((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err)
    );
  })
    .then((size) => {
      sheetSizeCache.set(uri, size);
      inflight.delete(uri);
      return size;
    })
    .catch((err) => {
      inflight.delete(uri);
      throw err;
    });
  inflight.set(uri, p);
  return p;
}

/**
 * Renders a single tile cropped from a sprite sheet:
 *   - Resolves sheet's intrinsic dimensions via Image.getSize (cached)
 *   - Outer view = visible tile box (width × derived height)
 *   - Inner Image = full sheet scaled so each tile fits the box, translated
 *     so the requested tile aligns with the box origin
 *
 * Cross-platform: iOS / Android / web all use the same primitives.
 */
export function SpriteThumbnail({ cue, width = 160 }: Props) {
  const [sheetSize, setSheetSize] = useState<{ width: number; height: number } | null>(
    () => sheetSizeCache.get(cue.spriteUri) ?? null
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    const cached = sheetSizeCache.get(cue.spriteUri);
    if (cached) {
      setSheetSize(cached);
      return;
    }
    setSheetSize(null);
    let cancelled = false;
    getSheetSize(cue.spriteUri)
      .then((size) => {
        if (!cancelled) setSheetSize(size);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cue.spriteUri]);

  const tileAspect = cue.w > 0 && cue.h > 0 ? cue.w / cue.h : 16 / 9;
  const height = Math.round(width / tileAspect);

  if (error || cue.w <= 0 || cue.h <= 0) {
    return <View style={[styles.container, { width, height }]} />;
  }

  if (!sheetSize) {
    return (
      <View style={[styles.container, { width, height }]}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  // Scale factor: 1 source-pixel of the cue tile's width = `scale` display pixels.
  const scale = width / cue.w;
  const scaledSheetWidth = sheetSize.width * scale;
  const scaledSheetHeight = sheetSize.height * scale;
  const offsetX = -cue.x * scale;
  const offsetY = -cue.y * scale;

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={{ uri: cue.spriteUri }}
        cachePolicy="memory-disk"
        contentFit="fill"
        style={{
          position: 'absolute',
          width: scaledSheetWidth,
          height: scaledSheetHeight,
          left: offsetX,
          top: offsetY,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
