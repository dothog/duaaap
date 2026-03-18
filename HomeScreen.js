import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Svg, Circle, Line, G, Defs, Mask, Rect, Polygon, Text as SvgText } from 'react-native-svg';

const DuaLogo = ({ size = 280 }) => {
  const scale = size / 400;
  return (
    <Svg
      viewBox="0 0 400 420"
      width={size}
      height={size * (420 / 400)}
    >
      <Defs>
        <Mask id="ring-gap">
          <Rect width="400" height="420" fill="white" />
          <Rect x="162" y="42" width="76" height="36" fill="black" />
        </Mask>
        <Mask id="crescent-shape">
          <Circle cx="200" cy="62" r="26" fill="white" />
          <Circle cx="218" cy="58" r="22" fill="black" />
        </Mask>
      </Defs>

      {/* Outer ring */}
      <Circle
        cx="200" cy="220" r="150"
        fill="none" stroke="#2C2C2C" strokeWidth="2"
        mask="url(#ring-gap)"
      />

      {/* Inner ring */}
      <Circle
        cx="200" cy="220" r="138"
        fill="none" stroke="#2C2C2C" strokeWidth="0.9"
        opacity="0.4"
        mask="url(#ring-gap)"
      />

      {/* Tasbih tick marks — 3, 6, 9 o'clock */}
      <Line x1="350" y1="220" x2="340" y2="220"
        stroke="#A0522D" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <Line x1="200" y1="370" x2="200" y2="360"
        stroke="#A0522D" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <Line x1="50" y1="220" x2="60" y2="220"
        stroke="#A0522D" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />

      {/* Crescent moon badge */}
      <G rotation="-20" originX="200" originY="62">
        <Circle cx="200" cy="62" r="26" fill="#A0522D" mask="url(#crescent-shape)" />
      </G>

      {/* Wordmark — "dua" */}
      <SvgText
        x="200" y="232"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="92"
        fontWeight="300"
        fontStyle="italic"
        fill="#2C2C2C"
        letterSpacing="-2"
      >dua</SvgText>

      {/* Wordmark — "app" */}
      <SvgText
        x="200" y="258"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize="11"
        fontWeight="500"
        fill="#2C2C2C"
        letterSpacing="10"
      >app</SvgText>

      {/* Ornamental rule */}
      <G>
        <Line x1="160" y1="278" x2="193" y2="278"
          stroke="#2C2C2C" strokeWidth="0.7" opacity="0.3" strokeLinecap="round" />
        <Polygon points="200,274.5 204.5,278 200,281.5 195.5,278" fill="#A0522D" opacity="0.65" />
        <Line x1="207" y1="278" x2="240" y2="278"
          stroke="#2C2C2C" strokeWidth="0.7" opacity="0.3" strokeLinecap="round" />
      </G>
    </Svg>
  );
};
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
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.screen,
      }}
      contentContainerStyle={{ paddingBottom: 60 }}
    >

      {/* App header */}
      <View style={{ marginTop: 40, marginBottom: 30, alignItems: 'center' }}>
        <DuaLogo size={280} />
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