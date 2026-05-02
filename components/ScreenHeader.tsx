import { Ionicons } from '@expo/vector-icons';
import { Link, useNavigation } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/lib/useColorScheme';

type Props = {
  title: string;
  badge?: string;
  showMenu?: boolean;
  showSettings?: boolean;
};

export function ScreenHeader({ title, badge, showMenu = true, showSettings = true }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDarkColorScheme } = useColorScheme();
  const iconColor = isDarkColorScheme ? '#fff' : '#0f172a';

  const openDrawer = () => {
    const nav = navigation as unknown as { openDrawer?: () => void };
    nav.openDrawer?.();
  };

  return (
    <View style={{ paddingTop: insets.top }} className="bg-background">
      <View className="h-12 flex-row items-center justify-between px-3">
        {showMenu ? (
          <Pressable
            onPress={openDrawer}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full">
            <Ionicons name="menu" size={22} color={iconColor} />
          </Pressable>
        ) : (
          <View className="h-9 w-9" />
        )}

        <View className="flex-1 flex-row items-center justify-center gap-2">
          <Text className="text-base font-bold tracking-tight text-foreground" numberOfLines={1}>
            {title}
          </Text>
          {badge ? (
            <View className="rounded-full bg-primary/15 px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-primary">{badge}</Text>
            </View>
          ) : null}
        </View>

        {showSettings ? (
          <Link href="/modal" asChild>
            <Pressable hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full">
              <Ionicons name="settings-outline" size={20} color={iconColor} />
            </Pressable>
          </Link>
        ) : (
          <View className="h-9 w-9" />
        )}
      </View>
    </View>
  );
}
