import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import {
  NavHomeIcon,
  NavFeedIcon,
  NavPlayIcon,
  NavRivalryIcon,
  NavChatsIcon,
} from '../../lib/icons';

// ─── Center Play FAB button ───────────────────────────────────────────────────
function PlayTabButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/round/create')}
      style={styles.playBtn}
      activeOpacity={0.85}
    >
      <View style={styles.playCircle}>
        <NavPlayIcon />
      </View>
    </TouchableOpacity>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E0E561',
        tabBarInactiveTintColor: 'rgba(255,249,245,0.38)',
        tabBarStyle: {
          backgroundColor: '#1F201A',
          borderTopColor: '#E0E561',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <NavHomeIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rivalry"
        options={{
          title: 'Rivalry',
          tabBarIcon: ({ focused }) => <NavRivalryIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: '',
          tabBarButton: () => <PlayTabButton />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused }) => <NavChatsIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ focused }) => <NavFeedIcon focused={focused} />,
        }}
      />
      {/* Hidden from tab bar but routes still accessible */}
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  playBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0E561',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    shadowColor: '#E0E561',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
});
