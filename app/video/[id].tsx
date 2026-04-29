import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { VideoPlayer } from '@/components/player/expo-video';
import type { VideoItem } from '@/components/player/expo-video/types';
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
      <VideoPlayer
        source={video}
        allowsPictureInPicture
        startsPictureInPictureAutomatically
        showFilmstrip
      />

      {/* home screen link */}
      <Link href="/(drawer)/(tabs)" asChild>
        <Pressable className="rounded-xl bg-card p-5 shadow-sm active:opacity-80">
          <Text className="text-lg font-semibold text-card-foreground">🏠 Home</Text>
        </Pressable>
      </Link>

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
