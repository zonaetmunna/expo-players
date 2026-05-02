import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { CategoryChips } from '@/components/CategoryChips';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { VideoItem } from '@/packages/react-native-video/types';
import { VIDEO_CATEGORIES, VIDEOS, type VideoCategoryKey } from '@/data/videos-rnv';

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

  const data = useMemo(() => {
    if (active === 'all') return VIDEOS;
    return VIDEOS.filter((v) => v.category === active);
  }, [active]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="RN-Video" badge={`${VIDEOS.length}`} />

      <CategoryChips chips={VIDEO_CATEGORIES} active={active} onChange={setActive} />

      <View className="flex-row items-center justify-between px-4 py-2.5">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Showing {data.length} of {VIDEOS.length} · react-native-video engine
        </Text>
      </View>

      <FlashList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-3 pb-6"
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
