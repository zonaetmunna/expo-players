import { FlashList } from '@shopify/flash-list';
import { useNetworkState } from 'expo-network';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { CategoryChips } from '@/components/CategoryChips';
import { ScreenHeader } from '@/components/ScreenHeader';
import { VIDEO_CATEGORIES, VIDEOS, type VideoCategoryKey } from '@/data/videos-rnv';
import { useAllDownloads } from '@/packages/react-native-video';
import type { VideoItem } from '@/packages/react-native-video/types/types';

function formatDuration(seconds?: number) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function platformIcon(p: VideoItem['platforms']['ios']) {
  return p.supported ? '✅' : '❌';
}

export default function RnvVideoListScreen() {
  const [active, setActive] = useState<VideoCategoryKey>('all');
  const downloads = useAllDownloads();
  const network = useNetworkState();
  // O(1) lookup for the per-card "downloaded" badge.
  const downloadedIds = useMemo(() => new Set(downloads.map((d) => d.id)), [downloads]);
  // expo-network returns isInternetReachable as undefined until the first
  // probe completes. Treat that as "online" so we don't flash the banner on
  // first paint. Only show the banner when we know we're offline.
  const isOffline = network.isInternetReachable === false || network.isConnected === false;

  const data = useMemo<VideoItem[]>(() => {
    if (active === 'all') return VIDEOS;
    if (active === 'downloads') {
      // Map downloaded records back to their VideoItem entries (so the list
      // card shows the same metadata as elsewhere). Falls back to a synthetic
      // entry when the catalog item was removed since the download.
      return downloads.map((rec) => {
        const original = VIDEOS.find((v) => v.id === rec.id);
        if (original) return original;
        return {
          id: rec.id,
          title: rec.title ?? 'Downloaded video',
          uri: rec.localUri,
          poster: rec.poster,
          duration: rec.durationSec,
          type: 'mp4',
          category: 'progressive',
          platforms: {
            ios: { supported: true },
            android: { supported: true },
            web: { supported: false },
          },
        } satisfies VideoItem;
      });
    }
    return VIDEOS.filter((v) => v.category === active);
  }, [active, downloads]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="RN-Video" badge={`${VIDEOS.length}`} />

      {isOffline ? (
        <View className="flex-row items-center gap-2 bg-amber-600 px-4 py-2">
          <Text className="text-base">📴</Text>
          <Text className="flex-1 text-sm font-semibold text-white">
            You&apos;re offline · {downloads.length} downloaded video
            {downloads.length === 1 ? '' : 's'} available
          </Text>
        </View>
      ) : null}

      <CategoryChips chips={VIDEO_CATEGORIES} active={active} onChange={setActive} />

      <View className="flex-row items-center justify-between px-4 py-2.5">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {active === 'downloads'
            ? `${data.length} downloaded · plays offline`
            : `Showing ${data.length} of ${VIDEOS.length} · react-native-video engine`}
        </Text>
      </View>

      <FlashList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-3 pb-6"
        ListEmptyComponent={
          active === 'downloads' ? (
            <View className="mt-12 items-center px-6">
              <Text className="text-center text-base font-semibold text-foreground">
                No downloads yet
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                Open any MP4 video and tap the cloud icon in the player to save it for offline
                playback.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Link href={`/video-rnv/${item.id}` as never} asChild>
            <Pressable className="mb-4 overflow-hidden rounded-2xl bg-card shadow-sm active:opacity-80">
              <View className="relative aspect-video w-full bg-black">
                {item.poster ? (
                  <Image source={{ uri: item.poster }} className="h-full w-full" />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-neutral-800">
                    <Text className="font-semibold tracking-widest text-white">
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                )}

                <View className="absolute left-2 top-2 flex-row gap-1">
                  <View className="rounded bg-black/70 px-2 py-0.5">
                    <Text className="text-[11px] font-bold tracking-wide text-white">
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                  {item.codecVideo ? (
                    <View className="rounded bg-black/70 px-2 py-0.5">
                      <Text className="text-[11px] font-bold tracking-wide text-white">
                        {item.codecVideo.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                  {item.resolution ? (
                    <View className="rounded bg-black/70 px-2 py-0.5">
                      <Text className="text-[11px] font-bold tracking-wide text-white">
                        {item.resolution.toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="absolute right-2 top-2 flex-row gap-1">
                  {downloadedIds.has(item.id) ? (
                    <View className="flex-row items-center gap-1 rounded bg-emerald-600 px-2 py-0.5">
                      <Text className="text-[10px] font-bold text-white">✓</Text>
                      <Text className="text-[11px] font-bold tracking-wide text-white">
                        DOWNLOADED
                      </Text>
                    </View>
                  ) : null}
                  {item.drm ? (
                    <View className="rounded bg-violet-600 px-2 py-0.5">
                      <Text className="text-[11px] font-bold tracking-wide text-white">
                        DRM · {item.drm.type}
                      </Text>
                    </View>
                  ) : null}
                  {item.subtitles && item.subtitles.length > 0 ? (
                    <View className="rounded bg-blue-600 px-2 py-0.5">
                      <Text className="text-[11px] font-bold tracking-wide text-white">+SUBS</Text>
                    </View>
                  ) : null}
                  {item.knownIssues && item.knownIssues.length > 0 ? (
                    <View className="rounded bg-red-600 px-2 py-0.5">
                      <Text className="text-[11px] font-bold text-white">⚠</Text>
                    </View>
                  ) : null}
                </View>

                {item.isLive ? (
                  <View className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded bg-red-600 px-2 py-0.5">
                    <View className="h-1.5 w-1.5 rounded-full bg-white" />
                    <Text className="text-[11px] font-bold tracking-wide text-white">LIVE</Text>
                  </View>
                ) : item.duration ? (
                  <View className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5">
                    <Text className="text-xs text-white">{formatDuration(item.duration)}</Text>
                  </View>
                ) : null}
              </View>

              <View className="gap-1 p-3">
                <Text className="text-base font-semibold text-card-foreground" numberOfLines={1}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View className="mt-1 flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs text-muted-foreground">iOS</Text>
                    <Text className="text-xs">{platformIcon(item.platforms.ios)}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs text-muted-foreground">Android</Text>
                    <Text className="text-xs">{platformIcon(item.platforms.android)}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs text-muted-foreground">Web</Text>
                    <Text className="text-xs">{platformIcon(item.platforms.web)}</Text>
                  </View>
                  {item.source ? (
                    <Text className="ml-auto text-[11px] text-muted-foreground" numberOfLines={1}>
                      {item.source}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
