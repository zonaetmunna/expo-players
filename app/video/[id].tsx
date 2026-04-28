import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { VideoPlayer } from '@/components/player/video';
import type { VideoItem } from '@/components/player/video/types';
import {
  DeviceCompatibility,
  KnownIssues,
  SourceInfo,
  TechnicalSpecs,
  VideoHeaderInfo,
} from '@/components/video-details';
import { VIDEOS } from '@/data/videos';

export default function VideoDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
      <VideoPlayer source={video} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled">
        <VideoHeaderInfo video={video} />
        <TechnicalSpecs video={video} />
        <DeviceCompatibility video={video} />
        <KnownIssues video={video} />
        <SourceInfo video={video} />
      </ScrollView>
    </View>
  );
}
