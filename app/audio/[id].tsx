import { Stack, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, Text, View } from 'react-native';

import { AudioPlayer } from '@/packages/audio';
import { AUDIOS } from '@/data/audios';

export default function AudioDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const audio = AUDIOS.find((a) => a.id === id);

  if (!audio) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-base text-muted-foreground">Audio not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-8">
      <Stack.Screen options={{ title: audio.title }} />
      <View className="items-center px-6 pt-6">
        <View className="aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-neutral-200">
          {audio.artwork ? (
            <Image source={{ uri: audio.artwork }} className="h-full w-full" />
          ) : (
            <View className="h-full w-full items-center justify-center bg-neutral-800">
              <Text className="text-2xl font-bold tracking-widest text-white">
                {audio.type.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="gap-1 px-6 pt-6">
        <Text className="text-2xl font-bold text-foreground" numberOfLines={2}>
          {audio.title}
        </Text>
        {audio.artist ? (
          <Text className="text-base text-muted-foreground">
            {audio.artist}
            {audio.album ? ` · ${audio.album}` : ''}
          </Text>
        ) : null}
        <View className="mt-2 flex-row flex-wrap gap-2">
          <View className="rounded bg-neutral-900 px-2 py-1">
            <Text className="text-[11px] font-bold tracking-wide text-white">
              {audio.type.toUpperCase()}
            </Text>
          </View>
          {audio.isLive ? (
            <View className="rounded bg-red-600 px-2 py-1">
              <Text className="text-[11px] font-bold tracking-wide text-white">LIVE</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="px-6 pt-2">
        <AudioPlayer source={audio} autoPlay />
      </View>

      <View className="px-6 pt-4">
        <Text className="font-mono text-[11px] text-muted-foreground" numberOfLines={2}>
          {audio.uri}
        </Text>
      </View>
    </ScrollView>
  );
}
