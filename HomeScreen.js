import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from './theme';

const CATEGORIES = [
  {
    id: 1,
    emoji: '🌅',
    title: 'Morning',
    datasetTitles: [
      'Words of remembrance for morning and evening',
      'supplications for when you wake up'
    ]
  },
  {
    id: 2,
    emoji: '🌙',
    title: 'Evening',
    datasetTitles: [
      'Words of remembrance for morning and evening',
      'What to say before sleeping'
    ]
  },
  {
    id: 3,
    emoji: '🏠',
    title: 'Home',
    datasetTitles: [
      'What to say when entering the home',
      'What to say when leaving the home'
    ]
  },
  {
    id: 4,
    emoji: '💚',
    title: 'Emotional State',
    datasetTitles: [
      'Invocations in times of worry and grief',
      'Invocations for anguish',
      'Invocation for anger'
    ]
  },
  {
    id: 5,
    emoji: '🤲',
    title: 'Prayer',
    datasetTitles: [
      'Invocations for the beginning of the prayer',
      'What to say after completing the prayer'
    ]
  },
  {
    id: 6,
    emoji: '✈️',
    title: 'Travel',
    datasetTitles: [
      'Invocation for traveling',
      'What to say upon returning from a Journey'
    ]
  },
];

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.screen,
    }}>

      {/* App header */}
      <View style={{ marginTop: 40, marginBottom: 30, alignItems: 'center' }}>
        <Text style={{
          fontSize: theme.typography.appName,
          color: theme.colors.text,
          letterSpacing: 2,
        }}>
          dua app
        </Text>
        <Text style={{
          fontSize: theme.typography.small,
          color: theme.colors.subtle,
          letterSpacing: 4,
          marginTop: 4,
        }}>
          HISNUL MUSLIM
        </Text>
      </View>

      {/* Search button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Search')}
        style={{
          padding: theme.spacing.card,
          marginBottom: theme.spacing.between,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.button,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}>
        <Text style={{ color: theme.colors.subtle, fontSize: 16 }}>
          🔍  Search duas...
        </Text>
      </TouchableOpacity>

      {/* Favorites button */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Favorites')}
        style={{
          padding: theme.spacing.card,
          marginBottom: 24,
          backgroundColor: theme.colors.accent,
          borderRadius: theme.radius.button,
        }}>
        <Text style={{
          color: '#fff',
          fontSize: 16,
          textAlign: 'center',
        }}>
          ❤️  My Favorites
        </Text>
      </TouchableOpacity>
      {/* Dua Counter button */}
<TouchableOpacity
  onPress={() => navigation.navigate('Playlist')}
  style={{
    padding: theme.spacing.card,
    marginBottom: theme.spacing.between,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.button,
  }}>
  <Text style={{
    color: theme.colors.background,
    fontSize: theme.typography.body,
    textAlign: 'center',
  }}>
    📿  Dua Counter
  </Text>
</TouchableOpacity>
{/* Reminder Button */}
          <TouchableOpacity
  onPress={() => navigation.navigate('Reminder')}
  style={{
    padding: 15,
    marginBottom: 20,
    backgroundColor: '#457b9d',
    borderRadius: 12,
  }}>
  <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
    🔔 Daily Reminder
  </Text>
</TouchableOpacity>
      {/* Category cards */}
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          onPress={() => navigation.navigate('Duas', {
            category: cat.title,
            datasetTitles: cat.datasetTitles
          })}
          style={{
            padding: theme.spacing.card,
            marginBottom: theme.spacing.between,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}>
          <Text style={{
            fontSize: theme.typography.body,
            color: theme.colors.text,
          }}>
            {cat.emoji}  {cat.title}
          </Text>
        </TouchableOpacity>

      ))}

    </ScrollView>
  );
}