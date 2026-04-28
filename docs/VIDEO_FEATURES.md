# 🎬 Video Player — Feature Board

> Single source of truth. Update this file as features land.

---

## 📊 Dashboard

| Status | Count | % |
| --- | ---: | ---: |
| ✅ **Done** — working in app today | **42** | 28% |
| 🟡 **Ready to wire** — `expo-video` supports it, no UI yet | **26** | 17% |
| 🔨 **To build** — custom code needed | **59** | 40% |
| 📦 **Needs library** — extra install + native rebuild | **8** | 5% |
| 🌐 **Needs backend** — server-side feature, not player | **6** | 4% |
| 🚫 **Won't build** — not feasible on this stack | **9** | 6% |
| **Total** | **149** | |

```text
██████░░░░░░░░░░░░░░░░░░░░  24% done
██████████░░░░░░░░░░░░░░░░  42% achievable now (done + ready to wire)
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

We ship in rounds. Pick one, build it, update boxes here, move on.

| Round | Theme | Items | Status |
|:-:|---|:-:|:-:|
| **1** | Foundation: install + native player + list/details | 5 | ✅ **Done** |
| **2** | Track pickers · LIVE badge · error UI · retry | 6 | ⏳ Next |
| **3** | Resume position · auto-play / loop toggles · caching · thumbnails | 5 | ⏸ Queued |
| **4** | Custom controls overlay + gestures (the "skin" foundation) | 8 | ⏸ Queued |
| **5** | Playlist · auto-next · continue watching | 4 | ⏸ Queued |
| **6** | Chapters · bookmarks · A/B repeat · sprite thumbnails | 5 | ⏸ Queued |
| **7** | Chromecast · AirPlay button · analytics hook | 3 | ⏸ Queued |
| **8** | Ads (IMA/VAST) · DRM hardening · offline download | 4 | ⏸ Queued |

---

## 🎯 Round 2 — Up Next

> All items below are 🟡 (native-supported). Biggest visible win, no extra deps.

- [ ] Quality picker UI (`availableVideoTracks`)
- [ ] Audio track picker UI (`availableAudioTracks`)
- [ ] Subtitle track picker UI (`availableSubtitleTracks`)
- [ ] LIVE badge + offset display (`isLive`, `currentOffsetFromLive`)
- [ ] Error UI when `status === 'error'` + `PlayerError`
- [ ] Retry mechanism (replaceAsync with same source)

---

## 📚 Full Feature Index

> Grouped by category. Status badge is the **at-a-glance** indicator.

---

## 🎬 Core Playback

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | MP4 | expo-video | tested in samples |
| 🟡 | WebM | expo-video | OS decoder; usually Android only |
| 🟡 | Ogg | expo-video | rarely supported on iOS |
| ✅ | HLS (m3u8) | expo-video | tested |
| ✅ | MPEG-DASH (mpd) | expo-video | Android-only on this stack |
| ✅ | Progressive playback | expo-video | |
| 🟡 | Live streaming | expo-video | flags exposed, no UI |
| 🔨 | Low-latency mode | custom | needs `bufferOptions` tuning |
| 🔨 | DVR (rewind live) | custom | scrubber needs DVR window |
| ✅ | Adaptive bitrate (ABR) | expo-video | automatic |
| 🚫 | Manual quality selection | n/a | `expo-video` exposes `availableVideoTracks` but `videoTrack` is **readonly** — no API to set it. ABR is forced automatic. Would need switching to `react-native-video` to enable. |
| ✅ | Codec H.264 | expo-video | OS decoder |
| ✅ | Codec H.265 / HEVC | expo-video | OS decoder |
| ✅ | Codec VP9 | expo-video | OS decoder (Android) |
| ✅ | Codec AV1 | expo-video | OS decoder where available |
| 🟡 | Audio-only mode | expo-video | hide view + background flag |

---

## 🎛️ Player Controls

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Play / Pause | expo-video | native controls |
| ✅ | Seek (scrubber) | expo-video | native controls |
| ✅ | Forward / rewind buttons | expo-video | native controls |
| 🔨 | Keyboard shortcuts | custom | RN doesn't expose web keys natively |
| ✅ | Volume + mute | expo-video | system volume |
| ✅ | Playback speed (0.25x – 2x+) | expo-video | `playbackRate` |
| ✅ | Fullscreen | expo-video | |
| ✅ | Picture-in-Picture | expo-video | plugin enabled |
| 🔨 | Theater mode / mini player | custom | layout-level |
| ✅ | Time display | expo-video | native controls |
| ✅ | Replay button (on end) | expo-video | `replay()` |
| 🔨 | Auto-play toggle (UI) | custom | prop exists, no toggle |
| 🔨 | Next video / playlist | custom | needs queue model |

---

## 📱 Gesture Controls

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Double-tap left/right → seek ±10s | custom | `useDoubleTapSeek` → `components/player/video/hooks/` |
| ✅ | Vertical swipe right → volume | custom | `useSwipeVolume` — sets `player.volume` |
| ✅ | Vertical swipe left → brightness | custom | `useSwipeBrightness` — uses `expo-brightness` |
| ✅ | Horizontal swipe → seek | custom | `useSwipeSeek` — preview HUD + `player.currentTime` |
| ✅ | Pinch to zoom | custom | `usePinchZoom` — toggles `contentFit` contain↔cover |
| 🚫 | Tap to show / hide controls | n/a | native controls own single-tap behavior; would need `nativeControls={false}` + Round 4 custom overlay |
| ✅ | Long-press → temporary 2x speed | custom | `useLongPressSpeed` — sets `playbackRate=2` |

---

## 🎚️ Advanced Playback UX

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Resume from last position | custom | AsyncStorage + `currentTime` |
| 🔨 | Intro skip | custom | data-driven (timestamps) |
| 🔨 | Outro skip | custom | data-driven |
| 🔨 | Chapter markers | custom | data-driven, scrubber overlay |
| 🔨 | Bookmarks | custom | per-user storage |
| ✅ | Loop / repeat | expo-video | `loop` prop |
| 🔨 | A/B repeat | custom | |
| 🔨 | Frame-by-frame stepping | custom | uses `currentTime` |
| 🔨 | Playback history | custom | + storage |

---

## 🧠 Smart / AI

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Network-aware quality optimization | expo-video | ABR is native |
| 🟡 | Smart buffering tuning | expo-video | `bufferOptions` exposed |
| 🌐 | AI subtitle generation | server | Whisper / cloud STT |
| 🌐 | Content-aware thumbnails | server | encoder pipeline |
| 🔨 | Scene preview on hover | custom + sprites | |
| 🟡 | Auto language selection | expo-video | tracks + locale |

---

## 🖼️ UI / Customization

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Multiple skins/themes | custom | needs theme system |
| ✅ | Dark / light mode (app screens) | NativeWind | player overlay TBD |
| 🔨 | Fully customizable control bar | custom | replaces native controls |
| 🔨 | Logo watermark overlay | custom | absolute-positioned image |
| 🟡 | Poster / preview image | expo-video | metadata set, no overlay |
| 🔨 | Custom loading spinner | custom | tied to `status === 'loading'` |
| 🔨 | Custom error UI | custom | tied to `status === 'error'` |

---

## 🧾 Subtitles & Captions

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | VTT in HLS/DASH manifest | expo-video | |
| 🚫 | SRT side-loaded | n/a | expo-video requires manifest tracks |
| 🚫 | TTML side-loaded | n/a | same |
| 🟡 | Multiple subtitle tracks | expo-video | tracks exposed |
| 🟡 | Multi-language support | expo-video | exposed, no picker |
| ✅ | Closed captions (CC) | expo-video | when in manifest |
| 🔨 | Subtitle styling | custom | requires custom renderer |
| 🔨 | Subtitle sync adjustment | custom | offset applied to render time |
| 🟡 | Forced subtitles | expo-video | track flag, needs UI |
| ✅ | Burned-in vs soft | expo-video | source-dependent |

---

## 🧩 Audio

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🟡 | Multiple audio tracks | expo-video | tracks exposed |
| 🟡 | Audio description track | expo-video | track flag |
| 🚫 | Volume normalization | n/a | not in expo-video API |
| 🚫 | Equalizer | n/a | not in expo-video API |
| 🟡 | Spatial audio (Dolby Atmos) | OS | passthrough only |

---

## 🖥️ Casting & External Playback

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | AirPlay (iOS) | expo-video | `VideoAirPlayButton`, not yet placed |
| 📦 | Chromecast | lib:react-native-google-cast | requires native rebuild |
| 📦 | DLNA | lib:upnp (unofficial) | rarely worth it |
| 🚫 | Smart TV handoff | n/a | Expo doesn't target Tizen/WebOS |

---

## 🔐 DRM & Security

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Widevine (Android) | expo-video | type ready |
| ✅ | FairPlay (iOS) | expo-video | |
| ✅ | PlayReady | expo-video | |
| ✅ | ClearKey | expo-video | |
| ✅ | Token-based auth | expo-video | `drm.headers` |
| ✅ | Signed URLs | expo-video | source headers |
| ✅ | AES-128 encrypted HLS | expo-video | native HLS engine |
| 🌐 | Forensic watermarking | server | encoder pipeline |
| 🚫 | Screen recording protection | n/a | very limited on RN |

---

## 📊 Analytics & QoE

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🟡 | Playback events (play/pause/seek) | expo-video | events exposed, partial wiring |
| 🔨 | Watch time / engagement | custom | aggregate from events |
| 🔨 | Drop-off points | custom + server | |
| 🔨 | Buffering ratio | custom | from status events |
| 🔨 | Startup time | custom | from sourceLoad → first frame |
| 🔨 | Bitrate switch tracking | custom | |
| 🔨 | Error tracking | custom | already partial |
| 📦 | Device / network analytics | lib:expo-network + expo-device | |
| 🌐 | CDN performance | server / Mux Data | |

---

## 🖱️ Preview & Navigation

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Hover preview thumbnails | custom | web-first concept |
| 🔨 | Sprite thumbnails on scrubber | custom + sprites | |
| 🔨 | Timeline heatmap | custom + server | |
| 🔨 | Chapter-based navigation | custom | tied to chapters |
| 🟡 | Seek preview (live frames) | expo-video | `generateThumbnailsAsync()` |

---

## 📦 Playlist & Content

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Playlist queue | custom | data + UI |
| 🔨 | Auto-next | custom | on `playToEnd` |
| 🔨 | Related videos | custom + server | |
| 🔨 | Episode / series support | custom + data model | |
| 🔨 | Continue watching | custom + storage | depends on resume position |

---

## ⚙️ Performance & Optimization

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Lazy player init | custom | render only when needed |
| 🟡 | Preload strategy | expo-video | partial via `bufferOptions` |
| 🟡 | Smart buffering | expo-video | `bufferOptions` |
| 🟡 | Source caching | expo-video | `useCaching: true` per source |
| 🔨 | CDN switching / multi-CDN | custom | source list + retry |
| 🔨 | Low-latency mode | custom | tuned `bufferOptions` |
| 🔨 | Offline download | custom + lib:expo-file-system | DRM offline = hard |

---

## 🧪 Developer / Integration

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | JS API (play / pause / seek / etc.) | expo-video | full surface |
| 🟡 | Event hooks | expo-video | 2 of ~10 wired |
| 🔨 | Plugin system | custom | architectural decision |
| 🔨 | Custom controls | custom | Round 4 |
| 📦 | Ad SDK (VAST/VMAP/IMA) | lib:google-ima or webview | |
| ✅ | DRM license server integration | expo-video | already supported |
| 🔨 | Multi-tenant theming | custom | depends on theme system |

---

## 💰 Monetization

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 📦 | Pre-roll ads | lib:google-ima | |
| 📦 | Mid-roll ads | lib:google-ima | |
| 📦 | Post-roll ads | lib:google-ima | |
| 🌐 | Server-side ads (SSAI) | server | manifest stitching |
| 📦 | Client-side ads (VAST/IMA) | lib:google-ima | |
| 🔨 | Skip ads button | custom | tied to ad SDK |
| 🔨 | Subscription gating | custom + server | auth / entitlements |
| 🔨 | Pay-per-view | custom + server | |
| 🔨 | Coupon / access control | custom + server | |

---

## 📡 Live Streaming

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | LIVE badge | custom | use `player.isLive` |
| 🔨 | DVR scrubber | custom | live offset math |
| 🔨 | Catch-up TV | custom + server | EPG required |
| 🔨 | Low-latency HLS/DASH | custom | tuning + manifest support |
| 🔨 | Live chat integration | custom + server | not really player |
| 🔨 | Stream failover | custom | source fallback list |

---

## ♿ Accessibility

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Keyboard navigation | expo-video | when native controls on |
| ✅ | Screen reader support | expo-video | OS-level |
| 🔨 | High-contrast UI | custom | needed for custom skin |
| 🟡 | Captions + audio descriptions | expo-video | when in manifest |
| 🔨 | Focus management | custom | for custom controls |

---

## 🔄 Cross-Platform Support

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | iOS | expo-video | AVPlayer |
| ✅ | Android | expo-video | ExoPlayer |
| 🟡 | Web (Chrome/Safari/Firefox/Edge) | expo-video | web build exists, untested |
| 🚫 | Smart TVs (Tizen, WebOS) | n/a | Expo doesn't target |
| 🟡 | PWA | web build | works if web works |

---

## 🧯 Error Handling

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Friendly error messages | custom | `status === 'error'` + `PlayerError` |
| 🔨 | Retry mechanism | custom | `replaceAsync` with same source |
| 🔨 | Network fallback | custom | + `expo-network` |
| 🔨 | Source fallback (multi-URL) | custom | source list + iteration |
| 🟡 | Debug logs | expo-video | console-only today |

---

## 📝 Workflow Notes

### This file is the only tracker

Don't track features in chat, GitHub issues, or Notion.

### One round at a time

Say *"let's do Round 2"* and we'll build those items, then update the boxes.

### When a feature is done

- Flip 🟡 / 🔨 → ✅
- Add a one-line note pointing to the file (e.g. `→ components/player/QualityPicker.tsx`)
- Update the dashboard counts at the top
- Bump round status (`⏳ Next` → `✅ Done`)

### When scope changes

Mark 🚫 with a one-line reason — keeps the audit trail. Don't delete rows.

### Test screens stay separate

New features go under `app/test/<feature>.tsx` so each is isolated. The main details page stays the "real" player.

---

## 🗒️ Out-of-scope decisions log

> Add an entry whenever we explicitly decide NOT to build something.

- **2026-04-28** — Manual resolution/quality selection: `expo-video` exposes `availableVideoTracks` but `videoTrack` is `readonly`. No way to set it. ABR is forced automatic. Speed / audio / subtitle pickers built instead — those are writable. Would need switching to `react-native-video` to enable manual quality.
