import { StatusBar } from 'expo-status-bar';
import { Linking, Platform, Text, View } from 'react-native';

import { useColorScheme } from '@/lib/useColorScheme';

export default function ModalScreen() {
  const { colorScheme } = useColorScheme();
  return (
    <>
      <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      />
      <View className="flex-1 items-center justify-center gap-2 bg-background px-12">
        <Text className="pb-1 text-center text-xl font-semibold text-foreground">Settings</Text>
        <Text className="pb-4 text-center text-sm text-muted-foreground">
          Use the toggle in the header to switch theme. More settings coming with later rounds — see{' '}
          <Text
            className="text-primary"
            onPress={() => Linking.openURL('https://docs.expo.dev/versions/latest/sdk/video/')}>
            expo-video docs
          </Text>
          {' for the player API reference.'}
        </Text>
      </View>
    </>
  );
}
