/**
 * CounterScreen.js
 * Purpose: Displays a dua-by-dua counter interface for a selected playlist.
 *          Users tap a large circle to count recitations, with auto-advance
 *          to the next dua when the target count is reached.
 * Dependencies: React Native, husn_en.json, theme.js
 * Context: Navigated to from PlaylistScreen with a playlist object as a param.
 */

import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import data from './husn_en.json';
import { theme } from './theme';
import Svg, { Circle } from 'react-native-svg';

export default function CounterScreen({ route, navigation }) {
  const { playlist } = route.params;

  /**
   * Build a flat list of all duas in this playlist.
   * We filter sections by datasetTitles, then flatten
   * each section's TEXT array into one unified list.
   * Each dua carries its repeat target from the dataset.
   */
  const allDuas = data.English
    .filter(section => playlist.datasetTitles.includes(section.TITLE))
    .flatMap(section => section.TEXT.map(dua => ({
      id: dua.ID,
      arabic: dua.ARABIC_TEXT,
      translation: dua.TRANSLATED_TEXT,
      // NOTE: Default to 1 if REPEAT is missing or 0 in the dataset
      target: dua.REPEAT || 1,
      sectionTitle: section.TITLE,
    })));

  // Tracks which dua in the playlist we are currently on
  const [currentIndex, setCurrentIndex] = useState(0);

  // Tracks how many times the current dua has been recited
  const [count, setCount] = useState(0);

  // Tracks whether the entire playlist has been completed
  const [complete, setComplete] = useState(false);

  // Convenience variables derived from state
  const currentDua = allDuas[currentIndex];

  // NOTE: We subtract 1 because arrays are zero-indexed —
  // the last item's index is always length - 1, not length
  const isLastDua = currentIndex === allDuas.length - 1;

  /**
   * handleTap — called every time user taps the counter circle.
   * Increments count and advances to next dua when target is reached.
   * If on the last dua, marks the playlist as complete instead.
   */
  const handleTap = () => {
    if (complete) return;
    const newCount = count + 1;

    if (newCount >= currentDua.target) {
      if (isLastDua) {
        setComplete(true);
      } else {
        setCurrentIndex(currentIndex + 1);
        setCount(0);
      }
    } else {
      setCount(newCount);
    }
  };

  /**
   * handlePrevious — moves back one dua in the playlist.
   * Disabled on the first dua (index 0).
   */
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setCount(0);
    }
  };

  /**
   * handleNext — skips forward one dua in the playlist.
   * Useful when user cannot complete full repeat count.
   * Disabled on the last dua.
   */
  const handleNext = () => {
    if (currentIndex < allDuas.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCount(0);
    }
  };

  // ─── Completion Screen ───────────────────────────────────────────
  if (complete) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.screen,
      }}>
        <Text style={{ fontSize: 48, marginBottom: 24 }}>🤲</Text>

        <Text style={{
          fontSize: theme.typography.heading,
          color: theme.colors.text,
          marginBottom: 12,
          textAlign: 'center',
        }}>
          Alhamdulillah
        </Text>

        <Text style={{
          fontSize: theme.typography.body,
          color: theme.colors.subtle,
          textAlign: 'center',
          marginBottom: 40,
        }}>
          You have completed{'\n'}{playlist.title}
        </Text>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            padding: theme.spacing.card,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.button,
            width: '100%',
          }}>
          <Text style={{
            color: '#fff',
            textAlign: 'center',
            fontSize: theme.typography.body,
          }}>
            Return to Playlists
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Main Counter Screen ─────────────────────────────────────────
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.screen,
      // NOTE: paddingBottom prevents buttons overlapping
      // the phone's system navigation bar at the bottom
      paddingBottom: 80,
    }}>

      {/* Progress — shows current position in playlist */}
      <Text style={{
        fontSize: theme.typography.small,
        color: theme.colors.subtle,
        letterSpacing: 2,
        marginTop: 20,
        marginBottom: 4,
        textAlign: 'center',
      }}>
        {currentIndex + 1} OF {allDuas.length}
      </Text>

      {/* Section title — shown in terracotta accent colour */}
      <Text style={{
        fontSize: theme.typography.small,
        color: theme.colors.accent,
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 24,
        textTransform: 'uppercase',
      }}>
        {currentDua.sectionTitle}
      </Text>

      {/* Arabic text — scrollable in case it's long */}
      <ScrollView style={{ maxHeight: 200, marginBottom: 24 }}>
        <Text style={{
          fontSize: theme.typography.arabic,
          color: theme.colors.text,
          textAlign: 'right',
          lineHeight: 44,
        }}>
          {currentDua.arabic}
        </Text>
      </ScrollView>

      {/* Translation — capped at 3 lines to preserve layout */}
      <Text
        numberOfLines={3}
        style={{
          fontSize: theme.typography.body - 2,
          color: theme.colors.subtle,
          lineHeight: 22,
          marginBottom: 32,
        }}>
        {currentDua.translation}
      </Text>

{/* Wrapper — layers counter circle on top of progress ring
    NOTE: position 'relative' on parent allows children to use
    position 'absolute' to overlap each other */}
<View style={{
  alignSelf: 'center',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 32,
  position: 'relative',
  width: 180,
  height: 180,
}}>

  {/* Progress ring — sits at base layer behind the counter */}
  {(() => {
    const size = 180;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = count / currentDua.target;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}>

        {/* Background ring — always visible in border colour */}
        <Circle
          cx={90} cy={90} r={radius}
          stroke={theme.colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Foreground ring — fills as count increases */}
        <Circle
          cx={90} cy={90} r={radius}
          stroke={theme.colors.accent}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90, 90, 90)`}
          strokeLinecap="round"
        />

      </Svg>
    );
  })()}

  {/* TAP TO COUNT — floats on top of the progress ring
      NOTE: position 'absolute' lifts this out of normal flow
      so it overlaps the SVG ring underneath */}
  <TouchableOpacity
    onPress={handleTap}
    style={{
      position: 'absolute',
      backgroundColor: theme.colors.card,
      borderRadius: 100,
      width: 140,
      height: 140,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <Text style={{
      fontSize: 48,
      color: theme.colors.accent,
      fontWeight: 'bold',
    }}>
      {count}
    </Text>
    <Text style={{
      fontSize: theme.typography.small,
      color: theme.colors.subtle,
      letterSpacing: 2,
    }}>
      OF {currentDua.target}
    </Text>
  </TouchableOpacity>

</View>

      {/* Navigation buttons — Previous and Next sit side by side
          NOTE: Both buttons live INSIDE this View so flexDirection
          'row' correctly places them horizontally next to each other */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.card,
      }}>

        {/* Previous — disabled and greyed out on first dua */}
        <TouchableOpacity
          onPress={handlePrevious}
          disabled={currentIndex === 0}>
          <Text style={{
            color: currentIndex === 0
              ? theme.colors.border
              : theme.colors.subtle,
            fontSize: theme.typography.body,
            letterSpacing: 2,
          }}>
            ← PREV
          </Text>
        </TouchableOpacity>

        {/* Next — disabled and greyed out on last dua */}
        <TouchableOpacity
          onPress={handleNext}
          disabled={isLastDua}>
          <Text style={{
            color: isLastDua
              ? theme.colors.border
              : theme.colors.subtle,
            fontSize: theme.typography.body,
            letterSpacing: 2,
          }}>
            NEXT →
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}