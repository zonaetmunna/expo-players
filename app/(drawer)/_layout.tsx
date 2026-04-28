import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';

const DrawerLayout = () => (
  <Drawer>
    <Drawer.Screen
      name="index"
      options={{
        headerTitle: 'Home',
        drawerLabel: 'Home',
        drawerIcon: ({ size, color }) => <Ionicons name="home-outline" size={size} color={color} />,
      }}
    />
    <Drawer.Screen
      name="(tabs)"
      options={{
        headerShown: false,
        drawerLabel: 'Players',
        drawerIcon: ({ size, color }) => (
          <MaterialIcons name="play-circle-outline" size={size} color={color} />
        ),
      }}
    />
  </Drawer>
);

export default DrawerLayout;
