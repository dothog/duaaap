import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './HomeScreen';
import DuaScreen from './DuaScreen';
import SearchScreen from './SearchScreen';
import FavoritesScreen from './FavoritesScreen';
import ReminderScreen from './ReminderScreen';
import PlaylistScreen from './PlaylistScreen';
import CounterScreen from './CounterScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
      screenOptions={{
        //These styles apply to ALL screens at once
        //Like setting a dress code for the entire building
        headerStyle: { backgroundColor: '#F5F0E8' },
        headerTintColor: '#2C2C2C',
        headerShadowVisible: false,
      }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Duas" component={DuaScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="Reminder" component={ReminderScreen} />
        <Stack.Screen name="Playlist" component={PlaylistScreen} />
        <Stack.Screen name="Counter" component={CounterScreen} 
        options={{
          //Match header to parchment theme
          headerStyle: {backgroundColor: '#F5F083' },
          headerTintColor: '#2C2C2C',
          headerShadowVisible: false,
          title: 'Dua Counter',
        }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}