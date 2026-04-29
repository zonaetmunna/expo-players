import { Tabs } from 'expo-router';

import { TabBarIcon } from '@/components/TabBarIcon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'black',
       
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Videos',
          tabBarIcon: ({ color }) => <TabBarIcon name="video-camera" color={color} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Audio',
          tabBarIcon: ({ color }) => <TabBarIcon name="music" color={color} />,
        }}
      />
      <Tabs.Screen
        name="three"
        options={{
          title: 'RN-Video',
          tabBarIcon: ({ color }) => <TabBarIcon name="film" color={color} />,
        }}
      />
    </Tabs>
  );
}
