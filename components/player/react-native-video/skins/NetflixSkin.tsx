

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

const NETFLIX_RED = '#e50914';

function formatTime(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NetflixSkin(props: SkinProps) {
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

  // IMA owns the surface during ad breaks — hide our chrome to avoid double-UI.
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
          <ActivityIndicator color={NETFLIX_RED} size="large" />
        </View>
      ) : null}

      {hasError ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="warning" size={36} color={NETFLIX_RED} />
          <Text style={styles.errorText}>{errorTitle ?? 'Playback failed'}</Text>
          {errorHint ? (
            <Text style={styles.errorDetail} numberOfLines={4}>
              {errorHint}
            </Text>
          ) : null}
          {errorRetryable ? (
            <Pressable onPress={onRetry} style={styles.retryBtn}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {ctrl.visible ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(220)}
          style={styles.layer}
          pointerEvents="box-none">
          {/* Top gradient + close button */}
          <LinearGradient
            colors={['rgba(0,0,0,0.9)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="box-none">
            <View style={styles.topBar} pointerEvents="box-none">
              {onRequestBack ? (
                <Pressable
                  onPress={onRequestBack}
                  hitSlop={8}
                  style={styles.closeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close">
                  <Ionicons name="close" size={28} color="#fff" />
                </Pressable>
              ) : (
                <View style={styles.closeBtn} />
              )}
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.topRight}>
                {isLive ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                ) : null}
                {onRequestPiP && Platform.OS !== 'web' ? (
                  <Pressable
                    onPress={onRequestPiP}
                    hitSlop={8}
                    style={styles.iconBtn}>
                    <Ionicons name="albums-outline" size={22} color="#fff" />
                  </Pressable>
                ) : null}
                {canCast ? (
                  <View style={styles.iconBtn}>
                    <CastButton style={styles.castButton} />
                  </View>
                ) : null}
              </View>
            </View>
          </LinearGradient>

          {/* Center: large play + side seek */}
          <View style={styles.centerRow} pointerEvents="box-none">
            <Pressable
              onPress={() => ctrl.seekRelative(-10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-back" size={28} color="#fff" />
              <Text style={styles.seekHint}>10</Text>
            </Pressable>
            <Pressable
              onPress={ctrl.togglePlay}
              hitSlop={12}
              style={styles.playBtn}
              disabled={!state.isLoaded}>
              {ctrl.seekPending != null || state.buffering ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <Ionicons
                  name={isEnded ? 'refresh' : state.isPlaying ? 'pause' : 'play'}
                  size={48}
                  color="#fff"
                />
              )}
            </Pressable>
            <Pressable
              onPress={() => ctrl.seekRelative(10)}
              hitSlop={12}
              disabled={isLive || !state.isLoaded}
              style={[styles.seekBtn, (isLive || !state.isLoaded) && styles.btnDisabled]}>
              <Ionicons name="play-forward" size={28} color="#fff" />
              <Text style={styles.seekHint}>10</Text>
            </Pressable>
          </View>

          {/* Bottom gradient + scrubber + actions */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.bottomGradient}
            pointerEvents="box-none">
            <View style={styles.scrubRow} pointerEvents="box-none">
              <SkinScrubber
                duration={ctrl.safeDuration}
                value={ctrl.sliderValue}
                scrubValue={ctrl.scrubValue}
                scrubbing={ctrl.scrubbing}
                spriteCue={ctrl.spriteCue}
                disabled={isLive || !state.isLoaded}
                minimumTrackTintColor={NETFLIX_RED}
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                thumbTintColor={NETFLIX_RED}
                onSlidingStart={ctrl.onScrubStart}
                onValueChange={ctrl.onScrubChange}
                onSlidingComplete={ctrl.onScrubComplete}
              />
            </View>
            <View style={styles.actionsRow} pointerEvents="box-none">
              <Text style={styles.timeText}>
                {isLive
                  ? 'LIVE'
                  : `${formatTime(ctrl.sliderValue)} / ${formatTime(ctrl.safeDuration)}`}
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => {
                  ctrl.setSettingsOpen(true);
                  ctrl.autoHide.show();
                }}
                hitSlop={8}
                style={styles.actionBtn}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>Settings</Text>
              </Pressable>
              <Pressable
                onPress={onToggleFullscreen}
                hitSlop={8}
                style={styles.actionBtn}>
                <Ionicons
                  name={isFullscreen ? 'contract' : 'expand'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionText}>
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </Text>
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
  topGradient: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  castButton: { width: 24, height: 24, tintColor: '#fff' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: NETFLIX_RED,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  seekBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekHint: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
  },
  playBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomGradient: {
    paddingTop: 32,
    paddingBottom: 6,
    paddingHorizontal: 12,
  },
  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 4,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  errorText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorDetail: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 17,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: NETFLIX_RED,
    borderRadius: 4,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  adPillWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 5,
  },
  adPill: {
    backgroundColor: NETFLIX_RED,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  adPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
