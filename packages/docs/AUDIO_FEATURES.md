# 🎧 Audio Player — Feature Board

> Companion file: [`VIDEO_FEATURES.md`](./VIDEO_FEATURES.md) tracks the video player separately.
> Single source of truth for the audio player. Update as features land.

---

## 📊 Dashboard

| Status | Count | % |
| --- | ---: | ---: |
| ✅ **Done** — working in app today | **18** | 21% |
| 🟡 **Ready to wire** — `expo-audio` supports it, no UI yet | **15** | 18% |
| 🔨 **To build** — custom code needed | **40** | 47% |
| 📦 **Needs library** — extra install + native rebuild | **6** | 7% |
| 🌐 **Needs backend** — server-side feature, not player | **3** | 3% |
| 🚫 **Won't build** — not feasible on this stack | **3** | 4% |
| **Total** | **85** | |

```text
█████░░░░░░░░░░░░░░░░░░░░░  21% done
█████████░░░░░░░░░░░░░░░░░  39% achievable now (done + ready to wire)
```

---

## 🚦 Status Legend

| Badge | Meaning |
|:-:|---|
| ✅ | Working — tested in the running app |
| 🟡 | Native API exists, just needs UI / wiring |
| 🔨 | Custom code we need to write |
| 📦 | Requires an extra npm library |
| 🌐 | Backend / server-side work |
| 🚫 | Not feasible on Expo / RN |

---

## 🗺️ Round Plan

| Round | Theme | Items | Status |
|:-:|---|:-:|:-:|
| **1** | Foundation: install + custom controls + list/details + lock screen | 6 | ✅ **Done** |
| **2** | Scrubber drag · speed picker · sleep timer · queue model · auto-next | 5 | ⏳ Next |
| **3** | Mini player (persistent) · Now Playing screen · history · favorites | 4 | ⏸ Queued |
| **4** | Resume position · shuffle/repeat · gapless · crossfade | 4 | ⏸ Queued |
| **5** | Lyrics (LRC + plain) · waveform visualization | 2 | ⏸ Queued |
| **6** | Offline download · cache management | 2 | ⏸ Queued |
| **7** | Chromecast · AirPlay button · Bluetooth controls | 3 | ⏸ Queued |
| **8** | Equalizer · audio FX · analytics | 3 | ⏸ Queued |

---

## 🎯 Round 2 — Up Next

- [ ] Scrubber drag-to-seek (replace progress bar with `@react-native-community/slider`)
- [ ] Playback speed picker (0.5x / 1x / 1.25x / 1.5x / 2x)
- [ ] Sleep timer (auto-pause after N minutes)
- [ ] Queue / playlist data model + UI
- [ ] Auto-next on `didJustFinish`

---

## 📚 Full Feature Index

### 🎧 Core Playback

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | MP3 | expo-audio | tested |
| ✅ | AAC / M4A | expo-audio | OS decoder |
| 🟡 | FLAC | expo-audio | OS decoder, untested |
| 🟡 | OGG / Vorbis | expo-audio | Android-friendly |
| 🟡 | WAV | expo-audio | OS decoder |
| 🟡 | Opus | expo-audio | OS decoder |
| ✅ | HLS audio (m3u8 audio-only) | expo-audio | live radio sample |
| ✅ | Live radio streams (Icecast/Shoutcast) | expo-audio | works via HTTP/HLS |
| ✅ | Progressive playback | expo-audio | |
| 🟡 | ICY metadata (live title/artist updates) | expo-audio | not exposed in API |

### 🎛️ Controls

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Play / Pause | custom | wrapper button |
| ✅ | Skip ±15s / ±30s | custom | `seekTo` |
| 🟡 | Drag scrubber | custom | needs slider component |
| 🟡 | Volume | expo-audio | `player.volume` exposed |
| 🟡 | Mute | expo-audio | `player.muted` exposed |
| 🟡 | Playback speed | expo-audio | `playbackRate` / `setPlaybackRate` |
| 🟡 | Pitch correction | expo-audio | `shouldCorrectPitch` |
| ✅ | Lock screen / Control Center | expo-audio | `setActiveForLockScreen` wired |
| ✅ | Notification controls (Android) | expo-audio | from lock screen API |
| 🟡 | Bluetooth headset (play/pause/skip) | expo-audio | via lock screen API |
| 🔨 | Sleep timer | custom | setTimeout + pause |
| 🔨 | Fade-in / fade-out | custom | volume ramp on play/pause |

### 📜 Queue & Library

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Playlist / queue | custom | data + UI |
| 🔨 | Reorder queue | custom | drag handle |
| 🔨 | Shuffle | custom | random index |
| 🔨 | Repeat (off / one / all) | custom | + `loop` for one |
| 🔨 | Auto-next | custom | on `didJustFinish` from status |
| 🔨 | Gapless playback | custom | preload next track |
| 🔨 | History / recently played | custom + storage | |
| 🔨 | Favorites | custom + storage | |
| 🔨 | Continue listening | custom + storage | depends on resume position |

### 📡 Streaming / Live

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🟡 | LIVE indicator | custom | `source.isLive` already in type |
| 🔨 | Stream metadata updates (ICY) | custom + lib | needs separate fetch |
| ✅ | Buffering UI | custom | `status.isBuffering` wired |
| 🔨 | Stream failover | custom | source list + retry |

### 🎨 UI / Now Playing

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Album art (large) | app screen | |
| 🔨 | Mini player (persistent) | custom | global state + portal |
| 🔨 | Full-screen "Now Playing" | custom | dedicated screen |
| ✅ | Lock-screen artwork | expo-audio | `setActiveForLockScreen` |
| 🔨 | Waveform visualization | custom | `useAudioSampleListener` (needs RECORD_AUDIO on Android) |
| 🔨 | Lyrics (synced LRC) | custom + data | |
| 🔨 | Lyrics (plain text) | custom + data | |

### 🎚️ Audio Quality / FX

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🚫 | Equalizer | n/a | not in expo-audio API |
| 🚫 | Bass / treble boost | n/a | not in expo-audio API |
| 🟡 | Spatial audio (Dolby Atmos) | OS | passthrough only |
| 🔨 | Crossfade between tracks | custom | dual-player + volume ramp |
| 🚫 | Volume normalization (replay gain) | n/a | not in expo-audio API |

### 🧠 Smart

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Resume from last position | custom | AsyncStorage + seekTo |
| 🔨 | Auto-pause on headphone disconnect | custom + lib | needs route-change events |
| ✅ | Audio focus / ducking | expo-audio | `interruptionMode: 'duckOthers'` set in app/_layout.tsx |
| ✅ | Background playback | expo-audio | `shouldPlayInBackground: true` set |

### 📥 Offline / Cache

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🟡 | Download for offline | expo-audio | `downloadFirst: true` per source |
| 🔨 | Persistent offline library | custom + lib:expo-file-system | |
| 🔨 | Cache streamed audio | custom + lib:expo-file-system | |
| 🔨 | Storage management UI | custom | |

### 📊 Analytics

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Play count | custom + storage | |
| 🔨 | Listen time | custom | aggregate from status |
| 🔨 | Completion % | custom | `currentTime / duration` |
| 🔨 | Skip rate | custom | track skip events |

### 📦 Casting & External

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | AirPlay (iOS) | expo-audio | system default |
| 📦 | Chromecast | lib:react-native-google-cast | requires native rebuild |
| 🟡 | Bluetooth speaker | OS | system default |

### 🧯 Error / Resilience

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Friendly error UI | custom | detect via `isLoaded` + duration |
| 🔨 | Retry mechanism | custom | `replace` with same source |
| 🔨 | Network drop recovery | custom | + `expo-network` |
| 🔨 | Source fallback (multi-URL) | custom | source list |

### 🔄 Cross-Platform Support

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | iOS | expo-audio | AVAudioPlayer / AVPlayer |
| ✅ | Android | expo-audio | ExoPlayer |
| 🟡 | Web | expo-audio | uses `<audio>`, untested |
| 🚫 | Smart TVs | n/a | Expo doesn't target |

---

## 📝 Workflow Notes

### This file is the only tracker

Don't track features in chat, GitHub issues, or Notion.

### One round at a time

Say *"let's do Audio Round 2"* and we'll build those items, then update the boxes.

### When a feature is done

- Flip 🟡 / 🔨 → ✅
- Add a one-line note pointing to the file
- Update the dashboard counts at the top
- Bump round status

### When scope changes

Mark 🚫 with a one-line reason — keeps the audit trail. Don't delete rows.

### Strict separation from video

No imports between `components/player/audio/` and `components/player/video/`. Each player owns its types, data, screens, and tracking doc.

---

## 🗒️ Out-of-scope decisions log

*(none yet)*
