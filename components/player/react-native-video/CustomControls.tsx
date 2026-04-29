import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { CastButton } from './bridges';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useColorScheme } from '@/lib/useColorScheme';

import { SpriteThumbnail } from './SpriteThumbnail';
import { useControlsAutoHide } from './hooks/useControlsAutoHide';
import type { RnvSnapshotRef } from './hooks/useRnvPlayerSnapshot';
import { useSpriteThumbnails } from './hooks/useSpriteThumbnails';
import type { RnvSnapshot, SpriteThumbnails } from './types';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
/** Responsive sprite bubble sizing — keeps bubble proportional on phones AND tablets */
const SPRITE_BUBBLE_MIN = 96;
const SPRITE_BUBBLE_MAX = 200;
const SPRITE_BUBBLE_RATIO = 0.42; // ~42% of slider width

function computeSpriteBubbleWidth(sliderWidth: number) {
  if (sliderWidth <= 0) return SPRITE_BUBBLE_MIN;
  return Math.round(
    Math.max(SPRITE_BUBBLE_MIN, Math.min(SPRITE_BUBBLE_MAX, sliderWidth * SPRITE_BUBBLE_RATIO))
  );
}

type Props = {
  snapshot: RnvSnapshotRef;
  state: Pick<
    RnvSnapshot,
    | 'currentTime'
    | 'duration'
    | 'isLoaded'
    | 'isPlaying'
    | 'buffering'
    | 'videoTracks'
    | 'selectedVideoTrack'
    | 'audioTracks'
    | 'selectedAudioTrack'
    | 'textTracks'
    | 'selectedTextTrack'
  >;
  title: string;
  isLive: boolean;
  hasError: boolean;
  isEnded?: boolean;
  rate: number;
  isFullscreen: boolean;
  canCast?: boolean;
  isCasting?: boolean;
  spriteThumbnails?: SpriteThumbnails;
  onPlay: () => void;
  onPause: () => void;
  onReplay?: () => void;
  onSeek: (time: number) => void;
  onSetRate: (r: number) => void;
  onSelectVideoTrack: (index: number | 'auto') => void;
  onSelectAudioTrack: (index: number | null) => void;
  onSelectTextTrack: (index: number | null) => void;
  onToggleFullscreen: () => void;
  onRequestPiP?: () => void;
  onRetry: () => void;
  onRequestBack?: () => void;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function trackLabel(t: { width?: number; height?: number; bitrate?: number }) {
  if (t.height) return `${t.height}p`;
  if (t.bitrate) return `${Math.round(t.bitrate / 1000)} kbps`;
  return 'Track';
}

export function CustomControls({
  snapshot,
  state,
  title,
  isLive,
  hasError,
  isEnded = false,
  rate,
  isFullscreen,
  canCast = false,
  isCasting = false,
  spriteThumbnails,
  onPlay,
  onPause,
  onReplay,
  onSeek,
  onSetRate,
  onSelectVideoTrack,
  onSelectAudioTrack,
  onSelectTextTrack,
  onToggleFullscreen,
  onRequestPiP,
  onRetry,
  onRequestBack,
}: Props) {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  // Holds the requested seek target while the player is still settling.
  // While set, the slider stays at this value (not state.currentTime) so the
  // thumb doesn't jump back-and-forth during the buffer/decode round-trip.
  const [seekPending, setSeekPending] = useState<number | null>(null);

  const sprites = useSpriteThumbnails(spriteThumbnails);
  const spriteCue = sprites.ready && scrubbing ? sprites.getCueAt(scrubValue) : null;

  const onSliderLayout = (e: LayoutChangeEvent) => {
    setSliderWidth(e.nativeEvent.layout.width);
  };

  // Debounced single-tap: defer toggling controls long enough that a double-tap
  // (handled by the gesture layer for ±10s seek) cancels it. Without this,
  // every double-tap flashes the controls visible from its first tap.
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTapLayerPress = () => {
    if (tapTimerRef.current) {
      // Second tap within window — assume it's a double-tap, do nothing
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      autoHide.toggle();
    }, 280);
  };
  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  // When user starts a cast session, auto-close the settings sheet so the native
  // device picker has clean stacking — avoids the modal-on-modal layering issue.
  useEffect(() => {
    if (isCasting && settingsOpen) {
      setSettingsOpen(false);
    }
  }, [isCasting, settingsOpen]);

  const showLoading = !state.isLoaded && !hasError;
  // Pin controls only when there's an active interaction (scrubbing, settings open)
  // or a blocking state (loading, error). Paused playback no longer pins — matches
  // YouTube/Netflix where controls auto-hide even when paused, and stay out of the
  // way during double-tap seeks etc.
  const pinned = scrubbing || settingsOpen || showLoading || hasError;
  const autoHide = useControlsAutoHide({ pinned });
  const visible = autoHide.visible;

  // Live streams: rn-video reports duration as Infinity or a huge number — clamp for slider
  const safeDuration =
    isLive || !Number.isFinite(state.duration) || state.duration <= 0
      ? 1
      : state.duration;

  // Clear `seekPending` once playback's currentTime has caught up to the
  // requested position (within 0.7s tolerance, accounting for keyframe snapping).
  useEffect(() => {
    if (seekPending == null) return;
    if (Math.abs(state.currentTime - seekPending) < 0.7) {
      setSeekPending(null);
    }
  }, [state.currentTime, seekPending]);

  // Safety net: if the player never reaches the seek target (e.g. stalled),
  // release the lock after 5 seconds so the slider can follow currentTime again.
  // Also clear `scrubbing` defensively in case onSlidingComplete didn't fire
  // (rare on Android when finger leaves slider rect).
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (seekPending == null) return;
    seekTimeoutRef.current = setTimeout(() => {
      setSeekPending(null);
      setScrubbing(false);
    }, 5000);
    return () => {
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
    };
  }, [seekPending]);

  const togglePlay = () => {
    autoHide.show();
    if (isEnded && onReplay) {
      onReplay();
      return;
    }
    if (state.isPlaying) onPause();
    else onPlay();
  };

  const seekRelative = (delta: number) => {
    autoHide.show();
    if (isLive || !state.isLoaded || !state.duration) return;
    const target = Math.max(
      0,
      Math.min(state.duration, snapshot.current.currentTime + delta)
    );
    setSeekPending(target);
    onSeek(target);
  };

  const onScrubStart = () => {
    setScrubbing(true);
    setScrubValue(state.currentTime);
    autoHide.show();
  };

  // Throttle slider value updates — slider can fire 60×/s on Android, but the
  // sprite bubble + time display only need ~20Hz. Reduces re-render cost ~3×.
  const lastScrubUpdateRef = useRef(0);
  const onScrubChange = (value: number) => {
    const now = Date.now();
    if (now - lastScrubUpdateRef.current < 50) return;
    lastScrubUpdateRef.current = now;
    setScrubValue(value);
  };

  const onScrubComplete = (value: number) => {
    const target = Math.max(0, Math.min(state.duration || value, value));
    setSeekPending(target);
    onSeek(target);
    setScrubbing(false);
    autoHide.show();
  };

  // Slider value: while user holds the thumb → live finger position.
  // After release while waiting for playback to settle → seek target (no jump-back).
  // Otherwise → playback's currentTime.
  const sliderValue = scrubbing
    ? scrubValue
    : seekPending != null
      ? seekPending
      : state.currentTime;

  const duration = safeDuration;

  return (
    <>
      {/* Tap area to toggle controls — debounced so double-taps don't flash controls */}
      <Pressable style={styles.tapLayer} onPress={handleTapLayerPress} />

      {/* Loading spinner */}
      {showLoading ? (
        <View pointerEvents="none" style={styles.centerOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : null}

      {/* Buffering indicator removed — the center play button already shows a spinner
          during seek/buffer states (see togglePlay button below). */}

      {/* Error UI */}
      {hasError ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="warning" size={32} color="#fff" />
          <Text style={styles.errorText}>Playback failed</Text>
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Controls layer */}
      {visible ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(200)}
          style={styles.layer}
          pointerEvents="box-none">
          {/* Top bar */}
          <View style={styles.topBar} pointerEvents="box-none">
            {onRequestBack ? (
              <Pressable onPress={onRequestBack} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
            ) : (
              <View style={styles.iconBtn} />
            )}
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {isLive ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.topRight}>
              {onRequestPiP && Platform.OS !== 'web' ? (
                <Pressable
                  onPress={onRequestPiP}
                  hitSlop={8}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Picture in picture">
                  <Ionicons name="albums-outline" size={20} color="#fff" />
                </Pressable>
              ) : null}
              {canCast ? (
                <View style={styles.iconBtn}>
                  <CastButton style={styles.castButton} />
                </View>
              ) : null}
              <Pressable
                onPress={() => {
                  setSettingsOpen(true);
                  autoHide.show();
                }}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Player settings">
                <Ionicons name="settings-sharp" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Center play/pause + side seek */}
          <View style={styles.centerRow} pointerEvents="box-none">
            <Pressable
              onPress={() => seekRelative(-10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              accessibilityRole="button"
              accessibilityLabel="Seek backward 10 seconds"
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-back" size={26} color="#fff" />
            </Pressable>
            <Pressable
              onPress={togglePlay}
              hitSlop={12}
              style={styles.playBtn}
              disabled={!state.isLoaded}
              accessibilityRole="button"
              accessibilityLabel={
                seekPending != null
                  ? 'Seeking'
                  : state.buffering
                    ? 'Buffering'
                    : isEnded
                      ? 'Replay'
                      : state.isPlaying
                        ? 'Pause'
                        : 'Play'
              }>
              {seekPending != null || state.buffering ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name={isEnded ? 'refresh' : state.isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#fff"
                />
              )}
            </Pressable>
            <Pressable
              onPress={() => seekRelative(10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              accessibilityRole="button"
              accessibilityLabel="Seek forward 10 seconds"
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-forward" size={26} color="#fff" />
            </Pressable>
          </View>

          {/* Bottom bar */}
          <View style={styles.bottomBar} pointerEvents="box-none">
            <Text style={styles.timeText}>
              {isLive ? 'LIVE' : formatTime(sliderValue)}
            </Text>
            <View style={styles.sliderWrap} onLayout={onSliderLayout}>
              {/* Sprite-sheet thumbnail bubble above the slider thumb during scrubbing */}
              {spriteCue && sliderWidth > 0
                ? (() => {
                    const bubbleWidth = computeSpriteBubbleWidth(sliderWidth);
                    return (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.spriteBubble,
                          {
                            left: Math.max(
                              0,
                              Math.min(
                                sliderWidth - bubbleWidth,
                                (scrubValue / Math.max(1, duration)) * sliderWidth -
                                  bubbleWidth / 2
                              )
                            ),
                          },
                        ]}>
                        <SpriteThumbnail cue={spriteCue} width={bubbleWidth} />
                        <Text style={styles.spriteTime}>{formatTime(scrubValue)}</Text>
                      </View>
                    );
                  })()
                : null}
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(1, duration)}
                value={sliderValue}
                minimumTrackTintColor="#0a84ff"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#0a84ff"
                disabled={isLive || !state.isLoaded}
                onSlidingStart={onScrubStart}
                onValueChange={onScrubChange}
                onSlidingComplete={onScrubComplete}
              />
            </View>
            <Text style={styles.timeText}>
              {isLive ? '' : formatTime(Math.max(0, duration - sliderValue))}
            </Text>
            <Pressable onPress={onToggleFullscreen} hitSlop={8} style={styles.iconBtn}>
              <Ionicons
                name={isFullscreen ? 'contract' : 'expand'}
                size={20}
                color="#fff"
              />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* Settings sheet */}
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rate={rate}
        onSelectRate={onSetRate}
        videoTracks={state.videoTracks}
        selectedVideoTrack={state.selectedVideoTrack}
        onSelectVideoTrack={onSelectVideoTrack}
        audioTracks={state.audioTracks}
        selectedAudioTrack={state.selectedAudioTrack}
        onSelectAudioTrack={onSelectAudioTrack}
        textTracks={state.textTracks}
        selectedTextTrack={state.selectedTextTrack}
        onSelectTextTrack={onSelectTextTrack}
      />
    </>
  );
}

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  rate: number;
  onSelectRate: (r: number) => void;
  videoTracks: RnvSnapshot['videoTracks'];
  selectedVideoTrack: RnvSnapshot['selectedVideoTrack'];
  onSelectVideoTrack: (index: number | 'auto') => void;
  audioTracks: RnvSnapshot['audioTracks'];
  selectedAudioTrack: RnvSnapshot['selectedAudioTrack'];
  onSelectAudioTrack: (index: number | null) => void;
  textTracks: RnvSnapshot['textTracks'];
  selectedTextTrack: RnvSnapshot['selectedTextTrack'];
  onSelectTextTrack: (index: number | null) => void;
};

function SettingsSheet({
  visible,
  onClose,
  rate,
  onSelectRate,
  videoTracks,
  selectedVideoTrack,
  onSelectVideoTrack,
  audioTracks,
  selectedAudioTrack,
  onSelectAudioTrack,
  textTracks,
  selectedTextTrack,
  onSelectTextTrack,
}: SheetProps) {
  // Pull palette from the project's existing theme system (NativeWind tokens).
  const { colors } = useColorScheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.sheetRoot}>
        {/* Backdrop covers the full screen; tap anywhere outside the sheet to close */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close settings"
        />
        {/* Sheet sits on top of backdrop; its own touches don't propagate */}
        <View
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.grey3 }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Player settings
            </Text>
          </View>

        <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: 8 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Playback speed
          </Text>
          <View style={styles.rateRow}>
            {PLAYBACK_RATES.map((r) => {
              const active = Math.abs(rate - r) < 0.01;
              return (
                <Pressable
                  key={r}
                  onPress={() => onSelectRate(r)}
                  style={[
                    styles.rateChip,
                    { backgroundColor: active ? colors.primary : colors.grey5 },
                  ]}>
                  <Text
                    style={[
                      styles.rateText,
                      {
                        color: active ? colors.primaryForeground : colors.foreground,
                      },
                    ]}>
                    {r === 1 ? 'Normal' : `${r}x`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Quality</Text>
          {videoTracks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Source has no quality variants
            </Text>
          ) : (
            <>
              <PickerRow
                label="Auto"
                active={selectedVideoTrack === 'auto'}
                onPress={() => onSelectVideoTrack('auto')}
              />
              {videoTracks.map((t, i) => {
                const active = selectedVideoTrack === t.index;
                const sub =
                  t.bitrate !== undefined ? `${Math.round(t.bitrate / 1000)} kbps` : null;
                return (
                  <PickerRow
                    key={`v-${t.index}-${t.height ?? 'h'}-${t.bitrate ?? 'b'}-${i}`}
                    label={trackLabel(t)}
                    sub={sub ?? undefined}
                    active={active}
                    onPress={() => onSelectVideoTrack(t.index)}
                  />
                );
              })}
            </>
          )}

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Audio</Text>
          {audioTracks.length <= 1 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Single audio track only
            </Text>
          ) : (
            audioTracks.map((t, i) => {
              const active = selectedAudioTrack === t.index;
              const lbl = `${t.title ?? `Track ${t.index + 1}`}${t.language ? ` · ${t.language}` : ''}`;
              return (
                <PickerRow
                  key={`a-${t.index}-${t.language ?? 'l'}-${i}`}
                  label={lbl}
                  active={active}
                  onPress={() => onSelectAudioTrack(t.index)}
                />
              );
            })
          )}

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Subtitles</Text>
          <PickerRow
            label="Off"
            active={selectedTextTrack === null}
            onPress={() => onSelectTextTrack(null)}
          />
          {textTracks.map((t, i) => {
            const active = selectedTextTrack === t.index;
            const lbl = `${t.title ?? `Track ${t.index + 1}`}${t.language ? ` · ${t.language}` : ''}`;
            return (
              <PickerRow
                key={`t-${t.index}-${t.language ?? 'l'}-${i}`}
                label={lbl}
                active={active}
                onPress={() => onSelectTextTrack(t.index)}
              />
            );
          })}
          {textTracks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No subtitle tracks in this source
            </Text>
          ) : null}

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PickerRow({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub?: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.pickerLabel,
            {
              color: active ? colors.primary : colors.foreground,
              fontWeight: active ? '600' : '400',
            },
          ]}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>{sub}</Text>
        ) : null}
      </View>
      {active ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 6,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castButton: {
    width: 22,
    height: 22,
    tintColor: '#fff',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  seekBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 6,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 36,
  },
  sliderWrap: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  spriteBubble: {
    position: 'absolute',
    bottom: 36,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 4,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 5,
  },
  spriteTime: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  bufferingPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 2,
  },
  bufferingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 10,
    zIndex: 3,
  },
  errorText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0a84ff',
    borderRadius: 999,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d4d4d8',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetBody: {
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#71717a',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rateChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f4f4f5',
  },
  rateChipActive: {
    backgroundColor: '#0a84ff',
  },
  rateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27272a',
  },
  rateTextActive: {
    color: '#fff',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  pickerLabel: {
    fontSize: 15,
    color: '#27272a',
  },
  pickerLabelActive: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  pickerSub: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#a1a1aa',
    paddingVertical: 8,
  },
});
