// Default skin — same look as the original CustomControls.

import { Ionicons } from '@expo/vector-icons';
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

function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function DefaultSkin(props: SkinProps) {
  const {
    state,
    title,
    isLive,
    hasError,
    isEnded = false,
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

  return (
    <>
      <Pressable style={styles.tapLayer} onPress={ctrl.handleTapLayerPress} />

      {ctrl.showLoading ? (
        <View pointerEvents="none" style={styles.centerOverlay}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : null}

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

      {ctrl.visible ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(200)}
          style={styles.layer}
          pointerEvents="box-none">
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
                  ctrl.setSettingsOpen(true);
                  ctrl.autoHide.show();
                }}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Player settings">
                <Ionicons name="settings-sharp" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.centerRow} pointerEvents="box-none">
            <Pressable
              onPress={() => ctrl.seekRelative(-10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              accessibilityRole="button"
              accessibilityLabel="Seek backward 10 seconds"
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-back" size={26} color="#fff" />
            </Pressable>
            <Pressable
              onPress={ctrl.togglePlay}
              hitSlop={12}
              style={styles.playBtn}
              disabled={!state.isLoaded}
              accessibilityRole="button">
              {ctrl.seekPending != null || state.buffering ? (
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
              onPress={() => ctrl.seekRelative(10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              accessibilityRole="button"
              accessibilityLabel="Seek forward 10 seconds"
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-forward" size={26} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.bottomBar} pointerEvents="box-none">
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
              minimumTrackTintColor="#0a84ff"
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor="#0a84ff"
              onSlidingStart={ctrl.onScrubStart}
              onValueChange={ctrl.onScrubChange}
              onSlidingComplete={ctrl.onScrubComplete}
            />
            <Text style={styles.timeText}>
              {isLive ? '' : formatTime(Math.max(0, ctrl.safeDuration - ctrl.sliderValue))}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 6,
  },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castButton: { width: 22, height: 22, tintColor: '#fff' },
  btnDisabled: { opacity: 0.4 },
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
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 10,
    zIndex: 3,
  },
  errorText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0a84ff',
    borderRadius: 999,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
