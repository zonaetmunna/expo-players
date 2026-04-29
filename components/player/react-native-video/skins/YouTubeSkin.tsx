// YouTube-inspired skin — minimal chrome, red progress bar, smaller controls,
// title-only top bar, time on left of scrubber, fullscreen on right.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { CastButton } from '../bridges';
import { SettingsSheet } from './SettingsSheet';
import { SkinScrubber } from './SkinScrubber';
import { useSkinControlsState } from './useSkinControlsState';
import type { SkinProps } from './types';

const YT_RED = '#ff0000';

function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function YouTubeSkin(props: SkinProps) {
  const {
    state,
    title,
    isLive,
    hasError,
    errorTitle,
    errorHint,
    errorRetryable = true,
    isEnded = false,
    isInAdBreak = false,
    rate,
    resizeMode,
    isFullscreen,
    canCast = false,
    skin,
    onSetRate,
    onSelectVideoTrack,
    onSelectAudioTrack,
    onSelectTextTrack,
    onSelectResizeMode,
    onSelectSkin,
    onToggleFullscreen,
    onRequestPiP,
    onRetry,
    onRequestBack,
  } = props;

  const ctrl = useSkinControlsState(props);

  // IMA SDK draws skip / countdown / click-through during ad breaks. Hide our
  // chrome so it doesn't paint over the IMA UI.
  if (isInAdBreak) {
    return (
      <View pointerEvents="none" style={styles.adPillWrap}>
        <View style={styles.adPill}>
          <Text style={styles.adPillText}>Ad</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <Pressable style={styles.tapLayer} onPress={ctrl.handleTapLayerPress} />

      {ctrl.showLoading ? (
        <View pointerEvents="none" style={styles.centerOverlay}>
          <ActivityIndicator color={YT_RED} size="large" />
        </View>
      ) : null}

      {hasError ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle" size={36} color={YT_RED} />
          <Text style={styles.errorText}>{errorTitle ?? 'Playback error'}</Text>
          {errorHint ? (
            <Text style={styles.errorDetail} numberOfLines={4}>
              {errorHint}
            </Text>
          ) : null}
          {errorRetryable ? (
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>RETRY</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {ctrl.visible ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(160)}
          style={styles.layer}
          pointerEvents="box-none">
          {/* Top gradient — minimal: title + cast */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="box-none">
            <View style={styles.topBar} pointerEvents="box-none">
              {onRequestBack ? (
                <Pressable onPress={onRequestBack} hitSlop={8} style={styles.iconBtn}>
                  <Ionicons name="chevron-down" size={26} color="#fff" />
                </Pressable>
              ) : null}
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {isLive ? (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : null}
              {canCast ? (
                <View style={styles.iconBtn}>
                  <CastButton style={styles.castButton} />
                </View>
              ) : null}
              {onRequestPiP && Platform.OS !== 'web' ? (
                <Pressable onPress={onRequestPiP} hitSlop={8} style={styles.iconBtn}>
                  <Ionicons name="albums-outline" size={20} color="#fff" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  ctrl.setSettingsOpen(true);
                  ctrl.autoHide.show();
                }}
                hitSlop={8}
                style={styles.iconBtn}>
                <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
              </Pressable>
            </View>
          </LinearGradient>

          {/* Center play + ±10 */}
          <View style={styles.centerRow} pointerEvents="box-none">
            <Pressable
              onPress={() => ctrl.seekRelative(-10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-back" size={32} color="#fff" />
            </Pressable>
            <Pressable
              onPress={ctrl.togglePlay}
              hitSlop={12}
              style={styles.playBtn}
              disabled={!state.isLoaded}>
              {ctrl.seekPending != null || state.buffering ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name={isEnded ? 'refresh' : state.isPlaying ? 'pause' : 'play'}
                  size={42}
                  color="#fff"
                />
              )}
            </Pressable>
            <Pressable
              onPress={() => ctrl.seekRelative(10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-forward" size={32} color="#fff" />
            </Pressable>
          </View>

          {/* Bottom: time, scrubber, fullscreen */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.bottomGradient}
            pointerEvents="box-none">
            <View style={styles.bottomRow} pointerEvents="box-none">
              <Text style={styles.timeText}>
                {isLive ? 'LIVE' : formatTime(ctrl.sliderValue)}
              </Text>
              <SkinScrubber
                duration={ctrl.safeDuration}
                value={ctrl.sliderValue}
                scrubValue={ctrl.scrubValue}
                scrubbing={ctrl.scrubbing}
                spriteCue={ctrl.spriteCue}
                disabled={isLive || !state.isLoaded}
                minimumTrackTintColor={YT_RED}
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor={YT_RED}
                onSlidingStart={ctrl.onScrubStart}
                onValueChange={ctrl.onScrubChange}
                onSlidingComplete={ctrl.onScrubComplete}
              />
              <Text style={styles.timeText}>
                {isLive
                  ? ''
                  : formatTime(Math.max(0, ctrl.safeDuration - ctrl.sliderValue))}
              </Text>
              <Pressable onPress={onToggleFullscreen} hitSlop={8} style={styles.iconBtn}>
                <Ionicons
                  name={isFullscreen ? 'contract' : 'expand'}
                  size={20}
                  color="#fff"
                />
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      ) : null}

      <SettingsSheet
        visible={ctrl.settingsOpen}
        onClose={() => ctrl.setSettingsOpen(false)}
        rate={rate}
        onSelectRate={onSetRate}
        resizeMode={resizeMode}
        onSelectResizeMode={onSelectResizeMode}
        videoTracks={state.videoTracks}
        selectedVideoTrack={state.selectedVideoTrack}
        onSelectVideoTrack={onSelectVideoTrack}
        audioTracks={state.audioTracks}
        selectedAudioTrack={state.selectedAudioTrack}
        onSelectAudioTrack={onSelectAudioTrack}
        textTracks={state.textTracks}
        selectedTextTrack={state.selectedTextTrack}
        onSelectTextTrack={onSelectTextTrack}
        skin={skin}
        onSelectSkin={onSelectSkin}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tapLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 2, justifyContent: 'space-between' },
  topGradient: { paddingBottom: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 6,
  },
  title: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castButton: { width: 22, height: 22, tintColor: '#fff' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: YT_RED,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 56,
  },
  seekBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGradient: {
    paddingTop: 24,
    paddingBottom: 4,
    paddingHorizontal: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap: 10,
    zIndex: 3,
  },
  errorText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorDetail: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: YT_RED,
    borderRadius: 2,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  adPillWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 5,
  },
  adPill: {
    backgroundColor: '#facc15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  adPillText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
