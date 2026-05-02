import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useColorScheme } from '@/lib/useColorScheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type Chip<K extends string> = {
  key: K;
  label: string;
  icon?: IconName;
};

type Props<K extends string> = {
  chips: readonly Chip<K>[];
  active: K;
  onChange: (key: K) => void;
};

export function CategoryChips<K extends string>({ chips, active, onChange }: Props<K>) {
  const { isDarkColorScheme } = useColorScheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      className="bg-background"
      contentContainerClassName="px-3 py-1.5 gap-1.5 items-center">
      {chips.map((c) => {
        const isActive = active === c.key;
        const iconColor = isActive ? '#ffffff' : isDarkColorScheme ? '#cbd5e1' : '#475569';
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${
              isActive ? 'bg-primary' : 'bg-card'
            }`}>
            {c.icon ? <Ionicons name={c.icon} size={12} color={iconColor} /> : null}
            <Text
              className={`text-[11px] font-semibold ${
                isActive ? 'text-white' : 'text-foreground'
              }`}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
      <View className="w-1" />
    </ScrollView>
  );
}
