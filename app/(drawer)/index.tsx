import { Link, Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function Home() {
  return (
    <>
      <Stack.Screen options={{ title: 'Home' }} />
      <View className="flex-1 gap-4 bg-background p-6">
        <Text className="text-2xl font-bold text-foreground">Expo Players</Text>
        <Text className="text-base text-muted-foreground">
          Pick a player to test. Each is fully separate — no shared code between them.
        </Text>

        <Link href="/(drawer)/(tabs)" asChild>
          <Pressable className="mt-4 rounded-xl bg-card p-5 shadow-sm active:opacity-80">
            <Text className="text-lg font-semibold text-card-foreground">🎬 Video Player</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              MP4 · HLS · DASH · DRM · PiP · fullscreen
            </Text>
          </Pressable>
        </Link>

        <Link href="/(drawer)/(tabs)/two" asChild>
          <Pressable className="rounded-xl bg-card p-5 shadow-sm active:opacity-80">
            <Text className="text-lg font-semibold text-card-foreground">🎧 Audio Player</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              MP3 · HLS · live radio · lock-screen controls · background playback
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
