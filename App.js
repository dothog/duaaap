import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import HomeScreen          from './HomeScreen';
import DuaScreen           from './DuaScreen';
import SearchScreen        from './SearchScreen';
import FavoritesScreen     from './FavoritesScreen';
import PlaylistScreen      from './PlaylistScreen';
import PlaylistsScreen     from './PlaylistsScreen';
import PlaylistDetailScreen from './PlaylistDetailScreen';
import CounterScreen       from './CounterScreen';
import CategoriesScreen    from './screens/CategoriesScreen';
import DuaCounterScreen    from './screens/DuaCounterScreen';
import AddDuasScreen       from './screens/AddDuasScreen';
import RemindersScreen     from './screens/RemindersScreen';
import { loadPlaylists }   from './data/playlistStorage';

/**
 * navigationRef — a stable ref passed to NavigationContainer so we can
 * navigate from outside a screen component (e.g. inside the notification
 * response listener, which lives at the App level).
 */
const navigationRef = createNavigationContainerRef();

/**
 * Notification display behaviour — must be configured at module level,
 * before any notification can arrive, so it is set here outside the component.
 * This tells expo-notifications to show a banner, play a sound, and skip the
 * badge count whenever a notification fires while the app is in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {

  useEffect(() => {
    // ── 1. Request notification permissions on first launch ──────────
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[App] Notification permission not granted');
      }

      // Android requires an explicit notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Prayer Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B4A2F',
        });
      }
    })();

    // ── 2. Deep-link handler — fires when the user taps a notification ─
    //
    // Reads playlistId from the notification data, looks up the playlist,
    // and navigates directly to CounterScreen so recitation starts immediately.
    // Falls back to HomeScreen if the playlist is not found or not set.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data ?? {};
        const { playlistId } = data;

        if (!navigationRef.isReady()) return;

        if (playlistId) {
          const playlists = await loadPlaylists();
          const playlist  = playlists.find(p => p.id === playlistId);

          if (playlist) {
            navigationRef.navigate('Counter', {
              playlist: {
                title:          playlist.name,
                duaIds:         playlist.duaIds,
                datasetTitles:  [], // unused when duaIds is present
              },
            });
            return;
          }
        }

        // No valid playlist — fall back to the home screen
        navigationRef.navigate('Home');
      }
    );

    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          // These styles apply to ALL screens at once —
          // like setting a dress code for the entire building
          headerStyle:       { backgroundColor: '#F5F0E8' },
          headerTintColor:   '#2C2C2C',
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="Home"           component={HomeScreen} />
        <Stack.Screen name="Categories"     component={CategoriesScreen} />
        <Stack.Screen name="DuaCounter"     component={DuaCounterScreen} />
        <Stack.Screen name="AddDuas"        component={AddDuasScreen} />
        <Stack.Screen name="Duas"           component={DuaScreen} />
        <Stack.Screen name="Search"         component={SearchScreen} />
        <Stack.Screen name="Favorites"      component={FavoritesScreen} />
        <Stack.Screen name="Reminder"       component={RemindersScreen} />
        <Stack.Screen name="Playlist"       component={PlaylistScreen} />
        <Stack.Screen name="Playlists"      component={PlaylistsScreen} />
        <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
        <Stack.Screen
          name="Counter"
          component={CounterScreen}
          options={{
            // Match header to parchment theme with a warm yellow accent
            headerStyle:       { backgroundColor: '#F5F083' },
            headerTintColor:   '#2C2C2C',
            headerShadowVisible: false,
            title:             'Dua Counter',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
