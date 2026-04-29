import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { VideoPlayer } from '@/components/player/react-native-video';
import type { VideoItem } from '@/components/player/react-native-video/types';
import { VIDEOS } from '@/data/videos-rnv';

export default function RnvVideoDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const video: VideoItem | undefined = VIDEOS.find((v) => v.id === id);

  if (!video) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-base text-muted-foreground">Video not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: video.title }} />
      <VideoPlayer
        source={video}
        onRequestBack={() => router.back()}
        // Free-form height — gives skins like Netflix breathing room for the
        // top/bottom gradient overlays + actions row without overflowing into
        // the metadata below. The Default and YouTube skins fit the same box
        // happily; only Netflix needed the extra space.
        style={{ aspectRatio: undefined, height: 260 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled">
        <View className="gap-2 px-4 pt-4">
          <Text className="text-xl font-bold text-foreground">{video.title}</Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="rounded bg-neutral-900 px-2 py-1">
              <Text className="text-[11px] font-bold tracking-wide text-white">
                {video.type.toUpperCase()}
              </Text>
            </View>
            <View className="rounded bg-neutral-700 px-2 py-1">
              <Text className="text-[11px] font-bold tracking-wide text-white">
                {video.category}
              </Text>
            </View>
            {video.codecVideo ? (
              <View className="rounded bg-blue-600 px-2 py-1">
                <Text className="text-[11px] font-bold tracking-wide text-white">
                  {video.codecVideo.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {video.resolution ? (
              <View className="rounded bg-emerald-600 px-2 py-1">
                <Text className="text-[11px] font-bold tracking-wide text-white">
                  {video.resolution.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {video.drm ? (
              <View className="rounded bg-violet-600 px-2 py-1">
                <Text className="text-[11px] font-bold tracking-wide text-white">
                  DRM · {video.drm.type}
                </Text>
              </View>
            ) : null}
            {video.ads ? (
              <View className="rounded bg-amber-500 px-2 py-1">
                <Text className="text-[11px] font-bold tracking-wide text-white">
                  ADS · {video.ads.type.toUpperCase()}
                </Text>
              </View>
            ) : null}
            {video.isLive ? (
              <View className="rounded bg-red-600 px-2 py-1">
                <Text className="text-[11px] font-bold tracking-wide text-white">LIVE</Text>
              </View>
            ) : null}
            {video.subtitles && video.subtitles.length > 0 ? (
              <View className="rounded bg-blue-700 px-2 py-1">
                <Text className="text-[11px] font-bold tracking-wide text-white">
                  +{video.subtitles.length} side-loaded sub
                </Text>
              </View>
            ) : null}
          </View>
          {video.description ? (
            <Text className="mt-1 text-sm leading-5 text-foreground/80">{video.description}</Text>
          ) : null}
        </View>

        <View className="mt-4 px-4">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            🔗 Source
          </Text>
          <View className="rounded-xl bg-card p-3">
            {video.source ? (
              <Text className="text-sm text-foreground">{video.source}</Text>
            ) : null}
            {video.license ? (
              <Text className="mt-0.5 text-xs text-muted-foreground">{video.license}</Text>
            ) : null}
            <Text className="mt-2 font-mono text-[11px] text-muted-foreground" numberOfLines={3}>
              {video.uri}
            </Text>
          </View>
        </View>

        {video.knownIssues && video.knownIssues.length > 0 ? (
          <View className="mt-4 px-4">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              ⚠️ Known issues
            </Text>
            <View className="rounded-xl bg-card p-3">
              {video.knownIssues.map((i, idx) => (
                <Text key={idx} className="text-sm text-foreground/90">
                  • {i}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
