// Shared settings sheet — used by all skins. Renders Speed / Quality / Aspect /
// Audio / Subtitles / Skin pickers. Not skin-specific (looks the same regardless
// of which skin is active) — gives the user a consistent settings UI.

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/lib/useColorScheme';

import type { ResizeMode } from '../resizeMode';
import type { RnvSnapshot } from '../types';
import { SKIN_OPTIONS, type SkinId } from './types';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

const RESIZE_MODE_OPTIONS: { key: ResizeMode; label: string; sub: string }[] = [
  { key: 'contain', label: 'Fit', sub: 'Show full video, may have black bars' },
  { key: 'cover', label: 'Fill', sub: 'Crop to fill screen, no black bars' },
  { key: 'stretch', label: 'Stretch', sub: 'Distort to fill — not recommended' },
];

function trackLabel(t: { width?: number; height?: number; bitrate?: number }) {
  if (t.height) return `${t.height}p`;
  if (t.bitrate) return `${Math.round(t.bitrate / 1000)} kbps`;
  return 'Track';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  rate: number;
  onSelectRate: (r: number) => void;
  resizeMode: ResizeMode;
  onSelectResizeMode: (mode: ResizeMode) => void;
  videoTracks: RnvSnapshot['videoTracks'];
  selectedVideoTrack: RnvSnapshot['selectedVideoTrack'];
  onSelectVideoTrack: (index: number | 'auto') => void;
  audioTracks: RnvSnapshot['audioTracks'];
  selectedAudioTrack: RnvSnapshot['selectedAudioTrack'];
  onSelectAudioTrack: (index: number | null) => void;
  textTracks: RnvSnapshot['textTracks'];
  selectedTextTrack: RnvSnapshot['selectedTextTrack'];
  onSelectTextTrack: (index: number | null) => void;
  skin: SkinId;
  onSelectSkin: (id: SkinId) => void;
};

export function SettingsSheet({
  visible,
  onClose,
  rate,
  onSelectRate,
  resizeMode,
  onSelectResizeMode,
  videoTracks,
  selectedVideoTrack,
  onSelectVideoTrack,
  audioTracks,
  selectedAudioTrack,
  onSelectAudioTrack,
  textTracks,
  selectedTextTrack,
  onSelectTextTrack,
  skin,
  onSelectSkin,
}: Props) {
  const { colors, colorScheme, setColorScheme } = useColorScheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close settings"
        />
        <View
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.grey3 }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Player settings</Text>
          </View>

          <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Appearance</Text>
            <PickerRow
              label="Light"
              sub="Bright UI for daytime viewing"
              active={colorScheme === 'light'}
              onPress={() => setColorScheme('light')}
            />
            <PickerRow
              label="Dark"
              sub="Dim UI for low-light viewing"
              active={colorScheme === 'dark'}
              onPress={() => setColorScheme('dark')}
            />

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Skin</Text>
            {SKIN_OPTIONS.map((opt) => {
              const active = skin === opt.key;
              return (
                <PickerRow
                  key={`s-${opt.key}`}
                  label={opt.label}
                  sub={opt.sub}
                  active={active}
                  onPress={() => onSelectSkin(opt.key)}
                />
              );
            })}

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

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Aspect ratio
            </Text>
            {RESIZE_MODE_OPTIONS.map((opt) => {
              const active = resizeMode === opt.key;
              return (
                <PickerRow
                  key={`r-${opt.key}`}
                  label={opt.label}
                  sub={opt.sub}
                  active={active}
                  onPress={() => onSelectResizeMode(opt.key)}
                />
              );
            })}

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
    <Pressable onPress={onPress} style={[styles.pickerRow, { borderBottomColor: colors.border }]}>
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
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
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
  },
  sheetBody: {
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
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
  },
  rateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerLabel: {
    fontSize: 15,
  },
  pickerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: 8,
  },
});
