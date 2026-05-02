import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CastState,
  MediaStreamType,
  useCastDevice,
  useCastState,
  useRemoteMediaClient,
  useStreamPosition,
} from '../bridges';

import type { VideoItem } from '../types';

function getCastContentType(type: VideoItem['type']) {
  if (type === 'hls') return 'application/x-mpegurl';
  if (type === 'dash') return 'application/dash+xml';
  if (type === 'webm') return 'video/webm';
  if (type === 'ogg') return 'video/ogg';
  return 'video/mp4';
}

type Options = {
  source: VideoItem;
  /** Called when active casting starts — local player should pause */
  onCastStart?: () => void;
  /** Called when casting ends — caller can resume local at returned position (seconds) */
  onCastEnd?: (lastPositionSec: number) => void;
  /**
   * When the player unmounts:
   *  - 'keep' (default, matches YouTube/Netflix): leave the receiver playing so the
   *    user can navigate the app while their TV continues. Local app loses control.
   *  - 'stop': stop the receiver session entirely.
   */
  onUnmount?: 'keep' | 'stop';
};

/**
 * Manages Cast session lifecycle for a single video source:
 *  - Detects when a Cast device connects
 *  - Auto-loads the source onto the receiver
 *  - Pauses local playback while casting (via callback)
 *  - Tracks remote progress so the caller can resume locally on disconnect
 *  - Exposes routed control actions (play / pause / seek / setVolume / setRate)
 *    that operate on the cast session when active
 */
export function useCastSession({ source, onCastStart, onCastEnd, onUnmount = 'keep' }: Options) {
  const client = useRemoteMediaClient();
  const device = useCastDevice();
  const castState = useCastState();
  const remotePosition = useStreamPosition();

  const isCasting = castState === CastState.CONNECTED && !!client;
  const canCast = !source.drm;

  const lastLoadedSourceIdRef = useRef<string | null>(null);
  const lastRemotePositionRef = useRef<number>(0);
  const wasCastingRef = useRef<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Track the most recent remote position so we can resume local on disconnect
  useEffect(() => {
    if (typeof remotePosition === 'number' && Number.isFinite(remotePosition)) {
      lastRemotePositionRef.current = remotePosition;
    }
  }, [remotePosition]);

  // Auto-load source when:
  //   - cast session becomes active
  //   - source changes while casting
  useEffect(() => {
    if (!isCasting || !client || !canCast) return;
    if (lastLoadedSourceIdRef.current === source.id) return;

    setLoadError(null);
    const isLive = !!source.isLive;
    client
      .loadMedia({
        autoplay: true,
        mediaInfo: {
          contentUrl: source.uri,
          contentType: getCastContentType(source.type),
          streamType: isLive ? MediaStreamType.LIVE : MediaStreamType.BUFFERED,
          // Only include duration for VOD; receiver uses 'undefined' to recognize live
          streamDuration: isLive ? undefined : source.duration,
          metadata: {
            // 'generic' fits live + VOD; 'movie' assumes a fixed-length film
            type: isLive ? 'generic' : 'movie',
            title: source.title,
            subtitle: source.description ?? undefined,
            images: source.poster ? [{ url: source.poster }] : undefined,
          },
        },
      })
      .then(() => {
        lastLoadedSourceIdRef.current = source.id;
      })
      .catch((e: Error) => {
        setLoadError(e?.message ?? 'Failed to load on cast device');
      });
  }, [isCasting, client, canCast, source]);

  // Detect cast start / end transitions and notify caller
  useEffect(() => {
    if (isCasting && !wasCastingRef.current) {
      wasCastingRef.current = true;
      onCastStart?.();
    } else if (!isCasting && wasCastingRef.current) {
      wasCastingRef.current = false;
      onCastEnd?.(lastRemotePositionRef.current);
      lastLoadedSourceIdRef.current = null; // ready to reload next time
    }
  }, [isCasting, onCastStart, onCastEnd]);

  // Unmount cleanup:
  //  - reset the loaded-source guard so re-mount will re-load the receiver
  //  - optionally stop the receiver session if config demands it
  //  ('keep' is the default and matches YouTube/Netflix behaviour)
  useEffect(() => {
    return () => {
      lastLoadedSourceIdRef.current = null;
      if (onUnmount === 'stop' && client) {
        client.stop().catch(() => {});
      }
    };
  }, [client, onUnmount]);

  // Routed control actions — operate on cast session when active, return false if not handled
  const remotePlay = useCallback(async () => {
    if (!isCasting || !client) return false;
    try {
      await client.play();
      return true;
    } catch {
      return false;
    }
  }, [client, isCasting]);

  const remotePause = useCallback(async () => {
    if (!isCasting || !client) return false;
    try {
      await client.pause();
      return true;
    } catch {
      return false;
    }
  }, [client, isCasting]);

  const remoteSeek = useCallback(
    async (positionSec: number) => {
      if (!isCasting || !client) return false;
      try {
        await client.seek({ position: positionSec });
        return true;
      } catch {
        return false;
      }
    },
    [client, isCasting]
  );

  const remoteSetVolume = useCallback(
    async (v: number) => {
      if (!isCasting || !client) return false;
      try {
        await client.setStreamVolume(Math.max(0, Math.min(1, v)));
        return true;
      } catch {
        return false;
      }
    },
    [client, isCasting]
  );

  const remoteSetRate = useCallback(
    async (rate: number) => {
      if (!isCasting || !client) return false;
      try {
        await client.setPlaybackRate(rate);
        return true;
      } catch {
        return false;
      }
    },
    [client, isCasting]
  );

  const remoteStop = useCallback(async () => {
    if (!client) return;
    try {
      await client.stop();
    } catch {
      // ignore
    }
  }, [client]);

  return {
    /** True when a cast session is currently active and a client is available */
    isCasting,
    /** True when the source is allowed to cast (false for DRM) */
    canCast,
    /** State enum from the lib (NOT_CONNECTED / CONNECTING / CONNECTED / NO_DEVICES_AVAILABLE) */
    castState,
    /** Connected device — friendlyName, modelName, etc. */
    device,
    /** Current playback position on the cast device (seconds) */
    remotePosition: typeof remotePosition === 'number' ? remotePosition : 0,
    /** If loadMedia failed, the message */
    loadError,

    /** Routed actions — return true if handled by cast, false otherwise */
    remotePlay,
    remotePause,
    remoteSeek,
    remoteSetVolume,
    remoteSetRate,
    remoteStop,
  };
}
