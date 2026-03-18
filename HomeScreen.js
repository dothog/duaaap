import { View, Text, TouchableOpacity } from 'react-native';
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

export default function HomeScreen({ navigation }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.screen,
      alignItems: 'center',
      justifyContent: 'center',
    }}>

      {/* Logo + subtitle */}
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
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

      {/* Navigation buttons */}
      <View style={{ width: '100%', gap: 12, paddingBottom: 60 }}>

        {/* Dua Counter — primary action */}
        <TouchableOpacity
          onPress={() => navigation.navigate('DuaCounter')}
          style={{
            padding: theme.spacing.card,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.button,
            alignItems: 'center',
          }}>
          <Text style={{
            color: '#fff',
            fontSize: theme.typography.body,
            letterSpacing: 0.5,
          }}>
            🕌  Dua Counter
          </Text>
        </TouchableOpacity>

        {/* Categories */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Categories')}
          style={{
            padding: theme.spacing.card,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
          }}>
          <Text style={{
            color: theme.colors.text,
            fontSize: theme.typography.body,
            letterSpacing: 0.5,
          }}>
            📖  Categories
          </Text>
        </TouchableOpacity>

        {/* Playlists */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Playlists')}
          style={{
            padding: theme.spacing.card,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
          }}>
          <Text style={{
            color: theme.colors.text,
            fontSize: theme.typography.body,
            letterSpacing: 0.5,
          }}>
            📋  Playlists
          </Text>
        </TouchableOpacity>

        {/* Reminders */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Reminder')}
          style={{
            padding: theme.spacing.card,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
          }}>
          <Text style={{
            color: theme.colors.text,
            fontSize: theme.typography.body,
            letterSpacing: 0.5,
          }}>
            🔔  Reminders
          </Text>
        </TouchableOpacity>

        {/* Search */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Search')}
          style={{
            padding: theme.spacing.card,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
          }}>
          <Text style={{
            color: theme.colors.text,
            fontSize: theme.typography.body,
            letterSpacing: 0.5,
          }}>
            🔍  Search
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}