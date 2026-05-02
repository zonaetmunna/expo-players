// Typed AsyncStorage helper for player persistence. Two namespaces:
//   @rnv/pref/<key>            — app-global preferences (skin, etc.)
//   @rnv/video/<id>/<field>    — per-video state (resume position, tracks)
//
// Reads return null on missing/parse-error so callers can safely fall back to
// defaults. Writes never throw — persistence is a UX nicety, not load-bearing.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_PREFIX = '@rnv/pref/';
const VIDEO_PREFIX = '@rnv/video/';

export async function readPref<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREF_PREFIX + key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writePref<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore — persistence is best-effort
  }
}

export async function readVideo<T>(videoId: string, field: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${VIDEO_PREFIX}${videoId}/${field}`);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeVideo<T>(videoId: string, field: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${VIDEO_PREFIX}${videoId}/${field}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export async function removeVideo(videoId: string, field: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${VIDEO_PREFIX}${videoId}/${field}`);
  } catch {
    // ignore
  }
}
