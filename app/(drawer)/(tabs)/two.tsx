import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ScreenHeader';
import { AUDIOS } from '@/data/audios';

function formatDuration(seconds?: number) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioListScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Audio" badge={`${AUDIOS.length}`} />

      <FlashList
        data={AUDIOS}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-3"
        renderItem={({ item }) => (
          <Link href={{ pathname: '/audio/[id]', params: { id: item.id } }} asChild>
            <Pressable className="mb-3 flex-row items-center gap-3 rounded-2xl bg-card p-3 shadow-sm active:opacity-80">
              <View className="h-16 w-16 overflow-hidden rounded-lg bg-neutral-200">
                {item.artwork ? (
                  <Image source={{ uri: item.artwork }} className="h-full w-full" />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-neutral-800">
                    <Text className="text-[10px] font-bold tracking-widest text-white">
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-card-foreground" numberOfLines={1}>
                  {item.title}
                </Text>
                {item.artist ? (
                  <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                    {item.artist}
                    {item.album ? ` · ${item.album}` : ''}
                  </Text>
                ) : null}
                <View className="mt-1 flex-row items-center gap-2">
                  <View className="rounded bg-neutral-900 px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold tracking-wide text-white">
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                  {item.isLive ? (
                    <View className="flex-row items-center gap-1 rounded bg-red-600 px-1.5 py-0.5">
                      <View className="h-1.5 w-1.5 rounded-full bg-white" />
                      <Text className="text-[10px] font-bold tracking-wide text-white">LIVE</Text>
                    </View>
                  ) : item.duration ? (
                    <Text className="text-xs text-muted-foreground">
                      {formatDuration(item.duration)}
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
