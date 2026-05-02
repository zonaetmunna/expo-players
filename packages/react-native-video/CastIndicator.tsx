import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  deviceName?: string;
  loadError?: string | null;
};

/**
 * Shown over the player when a Cast session is active.
 * Replaces the local video frame so the user clearly understands
 * playback has been handed off to the receiver.
 */
export function CastIndicator({ deviceName, loadError }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="tv" size={48} color="#fff" />
      <Text style={styles.heading}>Casting</Text>
      <Text style={styles.device} numberOfLines={1}>
        {deviceName ? `to ${deviceName}` : 'to Cast device'}
      </Text>
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  heading: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  device: {
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
  },
  error: {
    marginTop: 8,
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
  },
});
