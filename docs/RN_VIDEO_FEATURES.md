# 🎥 react-native-video Player — Feature Board

> SaaS-grade video engine. This file mirrors `VIDEO_FEATURES.md` (the expo-video tracker) but covers the parallel **react-native-video** player at `components/player/react-native-video/`. The two players are strictly separated — no shared imports.

---

## 📊 Dashboard

| Status | Count | % |
| --- | ---: | ---: |
| ✅ **Done** — working in app today | **79** | 56% |
| 🟡 **Ready to wire** — rn-video supports it, no UI yet | **20** | 14% |
| 🔨 **To build** — custom code needed | **27** | 19% |
| 📦 **Needs library** — extra install + native rebuild | **3** | 2% |
| 🌐 **Needs backend** — server-side feature, not player | **6** | 4% |
| 🚫 **Won't build** — not feasible / out of scope | **8** | 6% |
| **Total** | **143** | |

```text
██████████████░░░░░░░░░░░░  55% done
██████████████████░░░░░░░░  69% achievable now (done + ready to wire)
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
| 🚫 | Not feasible on Expo / RN, or explicitly out-of-scope |

---

## 🗺️ Round Plan

We ship in rounds. Pick one, build it, update boxes here, move on.

| Round | Theme | Items | Status |
|:-:|---|:-:|:-:|
| **1** | Foundation: install + native player + sample catalog | 6 | ✅ **Done** |
| **2** | Custom controls overlay + 3 skins (Default / Netflix / YouTube) | 8 | ✅ **Done** |
| **3** | Gestures: double-tap / swipe / pinch / long-press | 6 | ✅ **Done** |
| **4** | Sprite thumbnails on scrubber (YouTube-style) | 3 | ✅ **Done** |
| **5** | System volume + brightness (real device-level control) | 2 | ✅ **Done** |
| **6** | Chromecast — auto session + remote control | 4 | ✅ **Done** |
| **7** | DRM — Widevine / FairPlay / PlayReady / ClearKey | 5 | ✅ **Done** |
| **8** | IMA Ads — pre/mid/post-roll, skippable, ad pods | 5 | ✅ **Done** |
| **9** | Theme-aware Default skin + dark/light toggle in settings | 3 | ✅ **Done** |
| **10** | Resume position · auto-next · continue watching | 4 | ⏳ Next |
| **11** | Chapters · bookmarks · A/B repeat | 4 | ⏸ Queued |
| **12** | Offline download · multi-CDN failover · low-latency tuning | 4 | ⏸ Queued |
| **13** | Analytics + QoE pipeline | 5 | ⏸ Queued |

---

## 🎯 Round 10 — Up Next

> All items below are 🔨 — needs custom code, but rn-video exposes everything we need.

- [ ] Resume from last position (AsyncStorage + `currentTime` on load)
- [ ] Auto-next on `onEnd` when playlist queued
- [ ] Continue-watching shelf data model
- [ ] Watch-history persistence

---

## 📚 Full Feature Index

> Grouped by category. Status badge is the **at-a-glance** indicator.

---

## 🎬 Core Playback

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | MP4 (H.264) | rn-video | tested across all samples |
| ✅ | WebM (VP8/VP9) | rn-video | Android only — covered by codec-test sample |
| ✅ | Ogg / Theora | rn-video | Android only |
| ✅ | HLS (m3u8) | rn-video | tested with Apple BipBop, Mux, Unified |
| ✅ | MPEG-DASH (mpd) | rn-video | Android-only on this stack — compat banner shown on iOS |
| ✅ | Progressive playback | rn-video | |
| ✅ | Live HLS streaming | rn-video | Unified Streaming demo + DASH-IF livesim |
| ✅ | Live DASH streaming | rn-video | Android-only |
| ✅ | Adaptive bitrate (ABR) | rn-video | automatic on every variant manifest |
| ✅ | Manual quality selection | rn-video | quality picker in settings sheet — `selectedVideoTrack` writable |
| ✅ | Codec H.264 | rn-video | OS decoder — every catalog sample uses it |
| ✅ | Codec H.265 / HEVC | rn-video | sample: `rnv-codec-h265-720` (MP4) + `rnv-codec-h265-1080` + `rnv-codec-hevc-hls`. iOS 11+ / Android 5+ |
| ✅ | Codec VP9 | rn-video | sample: `rnv-codec-vp9-webm` + `rnv-codec-vp9-dash`. Android-only — iOS rejects WebM/VP9 |
| ✅ | Codec VP8 | rn-video | sample: `rnv-codec-vp8-webm`. Android-only |
| ✅ | Codec AV1 | rn-video | sample: `rnv-codec-av1-720` + `rnv-codec-av1-1080`. Android 10+ / iOS 17+ — hardware decode device-dependent |
| 🟡 | HDR10 | rn-video | OS decoder supports it; no verified-working public sample (Bitmovin's HDR demo URLs were revoked) |
| 🟡 | Dolby Vision | rn-video | iOS-only; same sourcing problem as HDR10 |
| 🔨 | Low-latency mode | custom | needs `bufferConfig` tuning |
| 🔨 | DVR (rewind live) | custom | live offset window math |
| 🟡 | Audio-only mode | rn-video | `playInBackground` already on; needs UI flag |

---

## 🎛️ Player Controls

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Play / Pause | custom | center button in all 3 skins |
| ✅ | Seek (scrubber) | custom | `SkinScrubber.tsx` — shared across skins |
| ✅ | Forward / rewind buttons | custom | ±10s buttons in skin chrome |
| ✅ | Volume + mute | custom + bridge | system volume via `react-native-volume-manager` |
| ✅ | Playback speed (0.5x – 2x) | custom | settings sheet picker |
| ✅ | Fullscreen | custom | `expo-screen-orientation` lock + Modal |
| ✅ | Picture-in-Picture | rn-video | Android + iOS, auto-enter on app background |
| ✅ | Time display | custom | tabular-nums, formats h:mm:ss when needed |
| ✅ | Replay button (on end) | custom | replaces play icon when `isEnded` |
| ✅ | Aspect ratio picker (Fit / Fill / Stretch) | custom | settings sheet — `resizeMode` |
| ✅ | Auto-hide controls | custom | `useControlsAutoHide` — fades after inactivity |
| ✅ | Settings sheet (gear menu) | custom | `SettingsSheet.tsx` — bottom-sheet pattern |
| 🔨 | Theater mode / mini player | custom | layout-level |
| 🔨 | Next video / playlist | custom | needs queue model (Round 10) |

---

## 📱 Gesture Controls

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Double-tap left/right → seek ±10s | custom | `useDoubleTapSeek.ts` — flash badge centered, 280ms tap debounce |
| ✅ | Vertical swipe right → volume | custom | `useSwipeVolume.ts` — uses `VolumeManager` (system volume) |
| ✅ | Vertical swipe left → brightness | custom | `useSwipeBrightness.ts` — uses `expo-brightness` |
| ✅ | Horizontal swipe → seek | custom | `useSwipeSeek.ts` — preview HUD + `seek()` on release |
| ✅ | Pinch to zoom | custom | `usePinchZoom.ts` — toggles `resizeMode` contain↔cover |
| ✅ | Long-press → temporary 2x speed | custom | `useLongPressSpeed.ts` — sets `rate=2`, restores on release |
| ✅ | Tap to show / hide controls | custom | `useControlsAutoHide` — owned by skin, native controls disabled |
| ✅ | Cross-skin gesture composition | custom | `PlayerGestures.tsx` — `Gesture.Race` / `Simultaneous` orchestration |

---

## 🎨 UI Skins

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Default skin | custom | `skins/DefaultSkin.tsx` — minimal chrome, theme-aware |
| ✅ | Netflix skin | custom | `skins/NetflixSkin.tsx` — gradients, large play button, red accent |
| ✅ | YouTube skin | custom | `skins/YouTubeSkin.tsx` — minimal, red progress, ellipsis menu |
| ✅ | Skin picker in settings | custom | `SettingsSheet.tsx` — instant runtime swap |
| ✅ | Theme-aware Default skin | custom | scrubber + retry colors follow app theme (`useColorScheme`) |
| ✅ | Brand-locked skin colors | custom | Netflix/YouTube ignore theme — match real product behavior |
| ✅ | Dark/Light toggle in settings | custom | "Appearance" section — calls `setColorScheme()` |
| ✅ | Skin router | custom | `CustomControls.tsx` — thin dispatcher on `skin` prop |
| ✅ | Shared scrubber | custom | `SkinScrubber.tsx` — sprite-thumbnail bubble logic shared |
| ✅ | Shared controls state | custom | `useSkinControlsState.ts` — auto-hide / scrub / seek-flash |

---

## 🎚️ Advanced Playback UX

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Resume from last position | custom | AsyncStorage + `currentTime` (Round 10) |
| 🔨 | Intro skip | custom | data-driven (timestamps) |
| 🔨 | Outro skip | custom | data-driven |
| 🔨 | Chapter markers | custom | data-driven, scrubber overlay |
| 🔨 | Bookmarks | custom | per-user storage |
| ✅ | Loop / repeat | rn-video | `repeat` prop |
| 🔨 | A/B repeat | custom | needs marker UI + interval timer |
| 🟡 | Frame-by-frame stepping | rn-video | `seek(currentTime + 1/fps)` — needs UI |
| 🔨 | Playback history | custom | + storage |

---

## 🖼️ Sprite Thumbnails (YouTube-style)

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | WebVTT cue parsing | custom | `useSpriteThumbnails.ts` — supports MM:SS and HH:MM:SS formats |
| ✅ | Sprite-sheet image cropping | custom | `SpriteThumbnail.tsx` — uses `expo-image` with `transitionDuration: 0` |
| ✅ | Hover bubble on scrubber | custom | shown during scrub, position clamped to slider width |
| ✅ | Binary-search cue lookup | custom | O(log n) — handles 1000+ cues per video |
| ✅ | Relative + absolute URL resolution | custom | falls back to `spriteUri` if cue path is relative |
| ✅ | JW Player / Mux / Bitmovin compat | custom | tested with real production VTT files |

---

## 🖥️ Casting & External Playback

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Chromecast (Android + iOS) | lib:react-native-google-cast | `useCastSession.ts` |
| ✅ | Cast button in skin chrome | custom | platform-resolved via `bridges/castBridge.ts` |
| ✅ | Auto session pickup | custom | `useRemoteMediaClient` + `useCastState` |
| ✅ | Remote play/pause/seek/rate | custom | routed through cast session when active |
| ✅ | Auto-pause local on cast start | custom | `onCastStart` handler |
| ✅ | Resume local at receiver position | custom | `onCastEnd` reads last position |
| ✅ | Cast indicator overlay | custom | `CastIndicator.tsx` — shows device name |
| ✅ | Web build safety | custom | `bridges/castBridge.web.ts` — Metro auto-picks stub |
| 🚫 | AirPlay button | n/a | rn-video has no first-class AirPlay component (use AVRoutePickerView native) |
| 🚫 | DLNA | n/a | not worth the complexity |

---

## 🔐 DRM & Security

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Widevine (Android) | rn-video | `drm.ts` → `mapDrm()` |
| ✅ | FairPlay (iOS) | rn-video | cert URL + license server + base64Certificate flag |
| ✅ | PlayReady (Android) | rn-video | enterprise streams |
| ✅ | ClearKey (Android) | rn-video | testing only |
| ✅ | Multi-DRM (Widevine + PlayReady) | rn-video | `multiDrm: true` flag — Axinom test vector |
| ✅ | Token-based auth | rn-video | `drm.headers` — Axinom uses `X-AxDRM-Message` |
| ✅ | Custom license callback | rn-video | `getLicense(spc, contentId, url, loadedUrl) => CKC` |
| ✅ | DRM platform compat banner | custom | rejects Widevine on iOS / FairPlay on Android with clear message |
| ✅ | DRM-specific error messages | custom | `describeDrmError()` — pattern-matches license/key/scheme failures |
| ✅ | Web fallback notice | custom | "DRM not supported on web" banner |
| ✅ | AES-128 encrypted HLS | rn-video | native HLS engine |
| 🌐 | Forensic watermarking | server | encoder pipeline |
| 🚫 | Screen recording protection | n/a | very limited on RN |

---

## 💰 Monetization (IMA Ads)

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | IMA SDK integration | rn-video | `enableADSExtension: true` in `app.json` |
| ✅ | Pre-roll ads (VAST Linear) | rn-video | `ads.ts` → `mapAds()` |
| ✅ | Mid-roll ads (VMAP cuepoints) | rn-video | timestamp-based via VMAP |
| ✅ | Post-roll ads | rn-video | VMAP `end` cuepoint |
| ✅ | Skippable linear ads | rn-video | IMA renders native Skip button after `skipoffset` |
| ✅ | Ad pods (multiple back-to-back) | rn-video | VMAP single-break with multiple ads |
| ✅ | VAST wrapper / redirect chains | rn-video | IMA resolves up to 5 hops by default |
| ✅ | Companion banners | rn-video | surfaced via `onReceiveAdEvent` data |
| ✅ | Ad event tracking | custom | `reduceAdEvent()` — collapses 30+ events to player-facing state |
| ✅ | Hide skin during ad break | custom | `isInAdBreak` early-return — IMA owns the surface |
| ✅ | "Ad" pill overlay | custom | minimal indicator while IMA chrome plays |
| ✅ | Ad error → continue with content | custom | `lastAdError` tracked, content not blocked |
| ✅ | Web fallback notice | custom | "Ads not available on web" banner |
| ✅ | Sample catalog (5 IMA tags) | custom | pre-roll / VMAP / skippable / pod / wrapper |
| 🟡 | Server-side ads (DAI) | rn-video | `AdConfigDAI` shape ready in `ads.ts`, no Google Ad Manager test account |
| 🔨 | Subscription gating | custom + server | auth / entitlements |
| 🔨 | Pay-per-view | custom + server | |
| 🔨 | Coupon / access control | custom + server | |

---

## 🧾 Subtitles & Captions

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | VTT in HLS/DASH manifest | rn-video | |
| ✅ | SRT side-loaded | rn-video | `application/x-subrip` MIME |
| ✅ | TTML side-loaded | rn-video | `application/ttml+xml` |
| ✅ | WebVTT side-loaded | rn-video | `text/vtt` |
| ✅ | Multiple subtitle tracks | rn-video | settings sheet picker |
| ✅ | Multi-language support | rn-video | language picker per track |
| ✅ | Closed captions (CC) | rn-video | when in manifest |
| ✅ | Off / disable subtitles | custom | "Off" entry in subtitle picker |
| 🔨 | Subtitle styling | custom | requires custom renderer |
| 🔨 | Subtitle sync adjustment | custom | offset applied to render time |
| 🟡 | Forced subtitles | rn-video | track flag exposed |
| ✅ | Burned-in vs soft | rn-video | source-dependent |

---

## 🧩 Audio

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Multiple audio tracks | rn-video | settings sheet picker |
| ✅ | Audio track switching | rn-video | `selectedAudioTrack` writable |
| 🟡 | Audio description track | rn-video | track flag exposed, no explicit UI |
| 🟡 | 5.1 / surround passthrough | rn-video | OS decoder dependent |
| 🚫 | Volume normalization | n/a | not in rn-video API |
| 🚫 | Equalizer | n/a | not in rn-video API |
| 🟡 | Spatial audio (Dolby Atmos) | OS | passthrough only |

---

## 🧠 Smart / AI

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Network-aware quality optimization | rn-video | ABR is native |
| 🟡 | Smart buffering tuning | rn-video | `bufferConfig` exposed |
| 🌐 | AI subtitle generation | server | Whisper / cloud STT |
| 🌐 | Content-aware thumbnails | server | encoder pipeline |
| ✅ | Scene preview on scrub | custom | sprite thumbnails (already built) |
| 🟡 | Auto language selection | rn-video | tracks + locale matching |

---

## 📊 Analytics & QoE

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Playback events (play/pause/seek) | rn-video | `onPlaybackStateChanged`, `onProgress` wired |
| ✅ | Buffering events | rn-video | `onBuffer` wired |
| ✅ | Error tracking | custom | DRM-aware `describeDrmError` + raw payload dump |
| ✅ | Volume change events | rn-video | `onVolumeChange` wired |
| ✅ | Track-change events | custom | settings-sheet writes go through state machine |
| 🔨 | Watch time / engagement | custom | aggregate from events |
| 🔨 | Drop-off points | custom + server | |
| 🔨 | Buffering ratio | custom | from buffering events |
| 🔨 | Startup time | custom | from `onLoadStart` → first frame |
| 🔨 | Bitrate switch tracking | custom | from `onBandwidthUpdate` |
| 📦 | Device / network analytics | lib:expo-network + expo-device | already installed |
| 🌐 | CDN performance | server / Mux Data | |

---

## 🖼️ UI / Customization

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Multiple skins/themes | custom | 3 skins shipped |
| ✅ | Dark / light mode | custom | Default skin theme-aware, toggle in settings |
| ✅ | Fully customizable control bar | custom | each skin has full layout control |
| ✅ | Custom loading spinner | custom | per-skin (white / Netflix red / YouTube red) |
| ✅ | Custom error UI | custom | overlay with retry — DRM message routed in |
| ✅ | Free-form player height | custom | consumer screen passes `style.height` — `aspectRatio: undefined` |
| 🔨 | Logo watermark overlay | custom | absolute-positioned image |
| 🟡 | Poster / preview image | rn-video | metadata `imageUri` set |

---

## 🖱️ Preview & Navigation

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Sprite thumbnails on scrubber | custom | YouTube-style — bubble follows scrub |
| 🔨 | Hover preview thumbnails | custom | web-first concept |
| 🔨 | Filmstrip below player | custom | could reuse sprite-VTT data |
| 🔨 | Timeline heatmap | custom + server | |
| 🔨 | Chapter-based navigation | custom | tied to chapters |
| ✅ | Seek preview (live frames) | custom | covered by sprite bubble during scrub |

---

## 📦 Playlist & Content

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| 🔨 | Playlist queue | custom | data + UI (Round 10) |
| 🔨 | Auto-next | custom | on `onEnd` (Round 10) |
| 🔨 | Related videos | custom + server | |
| 🔨 | Episode / series support | custom + data model | |
| 🔨 | Continue watching | custom + storage | depends on resume position |

---

## ⚙️ Performance & Optimization

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Memoized source object | custom | `useMemo` on source — prevents reload on re-render |
| ✅ | Smart progress interval | rn-video | `progressUpdateInterval={250}` |
| 🟡 | Preload strategy | rn-video | `bufferConfig` partial |
| 🟡 | Source caching | rn-video | `enableCacheExtension` available, not enabled |
| 🔨 | Lazy player init | custom | render only when needed |
| 🔨 | CDN switching / multi-CDN | custom | source list + retry |
| 🔨 | Low-latency mode | custom | tuned `bufferConfig` |
| 🔨 | Offline download | custom + lib:expo-file-system | DRM offline = hard |

---

## 🧪 Developer / Integration

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | JS API (play / pause / seek / etc.) | rn-video | full surface via `videoRef` |
| ✅ | Event hooks | rn-video | onLoad / onProgress / onError / onBuffer / onEnd / onVolumeChange wired |
| ✅ | Strict separation from expo-video | custom | no shared imports — verified via grep |
| ✅ | Cross-platform Metro bundle | custom | `.web.ts` bridges for cast / volume / brightness |
| ✅ | Per-feature hook files | custom | each gesture in its own `useXxx.ts` |
| ✅ | Three-skin architecture | custom | shared state + scrubber, isolated chrome |
| 🔨 | Plugin system | custom | architectural decision |
| ✅ | Ad SDK (VAST/VMAP/IMA) | rn-video | shipped |
| ✅ | DRM license server integration | rn-video | shipped |
| 🔨 | Multi-tenant theming | custom | depends on theme system |

---

## 📡 Live Streaming

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | LIVE badge | custom | shown in all 3 skins when `isLive` |
| ✅ | Live HLS playback | rn-video | tested |
| ✅ | Live DASH playback | rn-video | Android only |
| ✅ | Disable seek on live | custom | scrubber + ±10s buttons disabled |
| 🔨 | DVR scrubber | custom | live offset math |
| 🔨 | Catch-up TV | custom + server | EPG required |
| 🔨 | Low-latency HLS/DASH | custom | tuning + manifest support |
| 🔨 | Live chat integration | custom + server | not really player |
| 🔨 | Stream failover | custom | source fallback list |

---

## ♿ Accessibility

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Accessibility labels on controls | custom | every Pressable has `accessibilityRole` + `accessibilityLabel` |
| ✅ | Screen reader support | custom | OS-level via accessibility props |
| 🔨 | High-contrast UI | custom | needed alongside theme system |
| 🟡 | Captions + audio descriptions | rn-video | when in manifest |
| 🔨 | Focus management | custom | for tablet / keyboard / TV |

---

## 🔄 Cross-Platform Support

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | iOS | rn-video | AVPlayer |
| ✅ | Android | rn-video | ExoPlayer / Media3 |
| 🚫 | Web | n/a | rn-video has no web build — bridges/*.web.ts no-op the native deps so Metro builds; player itself doesn't render. Use expo-video for web. |
| 🚫 | Smart TVs (Tizen, WebOS) | n/a | Expo doesn't target |
| 🚫 | PWA | n/a | depends on web build, which doesn't exist |

---

## 🧯 Error Handling

| Status | Feature | Source | Notes |
|:-:|---|---|---|
| ✅ | Friendly error messages | custom | error overlay in all 3 skins |
| ✅ | DRM-specific error messages | custom | `describeDrmError` — license/key/scheme |
| ✅ | Retry mechanism | custom | `reloadKey` increment forces remount |
| ✅ | Compatibility banner | custom | DASH/WebM/Ogg on iOS, DRM on web/wrong-platform, Ads on web |
| ✅ | Ad error → content continues | custom | doesn't block content playback |
| ✅ | Debug logs | custom | console — onError / onLoad / onAdEvent |
| 🔨 | Network fallback | custom | + `expo-network` |
| 🔨 | Source fallback (multi-URL) | custom | source list + iteration |

---

## 🎞️ Sample Catalog

> All test videos live in `data/videos-rnv.ts`. Categories drive the chip filter on the list screen.

| Category | Count | Purpose |
|:-:|---:|---|
| **Progressive** | 2 | Plain MP4 — universal compat baseline |
| **Streaming** | ~5 | HLS + DASH manifests, ABR test |
| **Live** | 2 | 24/7 HLS + DASH live streams |
| **DRM** | 4 | Widevine (Shaka + Bitmovin), FairPlay (Apple), Multi-DRM (Axinom) |
| **IMA Ads** | 5 | Pre-roll / VMAP pre+mid+post / Skippable / Ad Pod / VAST Wrapper |
| **Codecs / HDR** | 8 | HEVC (3 — MP4 720, MP4 1080, HLS), VP9 (2 — WebM, DASH), VP8 (1 — WebM), AV1 (2 — 720, 1080) |
| **Edge cases** | ~3 | DASH-IF tests, broken manifests, weird containers |

---

## 🛠️ Architecture

### File layout

```
components/player/react-native-video/
├── VideoPlayer.tsx          # Top-level — owns state, mounts <Video>, threads props to skin
├── CustomControls.tsx       # Thin router — picks skin by id
├── PlayerGestures.tsx       # Gesture composition — Race / Simultaneous wiring
├── CastIndicator.tsx        # Shown during active cast session
├── SpriteThumbnail.tsx      # Single sprite-tile renderer using expo-image
├── drm.ts                   # mapDrm() / validateDrm() / describeDrmError()
├── ads.ts                   # mapAds() / validateAds() / reduceAdEvent()
├── resizeMode.ts            # ResizeMode union + helpers
├── types.ts                 # VideoItem / VideoDRM / VideoAds / RnvSnapshot
├── index.ts                 # Public re-exports
├── bridges/                 # Platform-resolved native shims
│   ├── castBridge.ts        # Native: react-native-google-cast
│   ├── castBridge.web.ts    # Web stub: no-op
│   ├── volumeBridge.ts      # Native: react-native-volume-manager
│   ├── volumeBridge.web.ts  # Web stub
│   └── brightnessBridge.ts  # Native: expo-brightness
│   └── brightnessBridge.web.ts  # Web stub
├── hooks/                   # One hook per feature — testable in isolation
│   ├── useRnvPlayerSnapshot.ts  # Mirrors player state to a JS ref for worklets
│   ├── useCastSession.ts        # Cast lifecycle + remote control
│   ├── useControlsAutoHide.ts   # Auto-hide chrome after inactivity
│   ├── useDoubleTapSeek.ts
│   ├── useLongPressSpeed.ts
│   ├── usePinchZoom.ts
│   ├── useSpriteThumbnails.ts   # WebVTT parser + binary-search lookup
│   ├── useSwipeBrightness.ts
│   ├── useSwipeSeek.ts
│   └── useSwipeVolume.ts
└── skins/
    ├── DefaultSkin.tsx
    ├── NetflixSkin.tsx
    ├── YouTubeSkin.tsx
    ├── SettingsSheet.tsx     # Shared bottom-sheet settings UI
    ├── SkinScrubber.tsx      # Shared scrubber + sprite bubble
    ├── useSkinControlsState.ts  # Shared state hook
    ├── types.ts              # SkinProps + SkinId
    └── index.ts              # Skin re-exports
```

### Strict-separation invariant

`react-native-video/` **must not import** from `components/player/expo-video/` or `components/player/audio/`. The two engines are independently versioned and the players ship to different consumer screens (`/video-rnv/[id]` vs `/video/[id]`).

Verified via grep — zero shared imports.

### Per-feature hooks

Each gesture / device-API feature lives in its own `useXxx.ts` so that:
- One file = one concern, easy to read
- Worklets stay close to their gesture handlers
- Hook-level guards (`enabled`, `disabled`) compose naturally

### Three-skin architecture

The 3 skins share:
- `useSkinControlsState` — auto-hide / scrub / seek-flash / settings open
- `SkinScrubber` — sprite bubble + slider
- `SettingsSheet` — playback rate, quality, aspect, audio, subtitles, skin picker, theme toggle

Each skin owns:
- Layout (top bar / center buttons / bottom bar / gradients)
- Brand colors (Netflix red, YouTube red, Default theme-aware)
- Ad-pill style (gray / red / yellow)

Adding a 4th skin = create `skins/MySkin.tsx`, add it to `SKIN_OPTIONS`, register in `CustomControls.tsx` switch.

---

## 📝 Workflow Notes

### This file is the only tracker

Don't track features in chat, GitHub issues, or Notion.

### One round at a time

Say *"let's do Round 10"* and we'll build those items, then update the boxes.

### When a feature is done

- Flip 🟡 / 🔨 → ✅
- Add a one-line note pointing to the file (e.g. `→ hooks/useSpriteThumbnails.ts`)
- Update the dashboard counts at the top
- Bump round status (`⏳ Next` → `✅ Done`)

### When scope changes

Mark 🚫 with a one-line reason — keeps the audit trail. Don't delete rows.

### Test screens stay separate

The rn-video player has its own consumer route at `app/video-rnv/[id].tsx`. The expo-video route at `app/video/[id].tsx` stays untouched.

---

## 🗒️ Out-of-scope decisions log

> Add an entry whenever we explicitly decide NOT to build something.

- **2026-04-29** — Web playback for rn-video: rn-video has no web build. We added `bridges/*.web.ts` stubs so Metro can bundle the screen on web, but the player itself doesn't render there. Web users get expo-video.
- **2026-04-29** — DAI (Server-side ads): the type shape and `mapAds()` path support DAI/SSAI, but we haven't shipped a sample because Google DAI requires a real Ad Manager content-source ID. CSAI covers 90% of cases and is fully tested.
- **2026-04-29** — AirPlay button in skin chrome: rn-video doesn't ship a first-class AirPlay component the way expo-video does. iOS users get the system AirPlay picker via the lock-screen / control center — covers the use case without us building a native bridge.
- **2026-04-29** — `gtv-videos-bucket/sample/*` URLs: Google revoked public access to that bucket mid-development. All sample URIs migrated to `test-videos.co.uk` (Big Buck Bunny / Sintel / Jellyfish 1-5MB clips). The displayed `duration` in the catalog metadata reflects the original Blender films; actual clip duration is read from the file at `onLoad` time.

---

## 🔗 Related docs

- [VIDEO_FEATURES.md](./VIDEO_FEATURES.md) — parallel tracker for the **expo-video** player
- [AUDIO_FEATURES.md](./AUDIO_FEATURES.md) — tracker for the **expo-audio** player
