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

{/* Progress ring — shows visual completion percentage */}
{(() => {
  // Ring dimensions
  const size = 180;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  
  // NOTE: circumference is the total length of the circle's edge
  // like measuring the perimeter of a circular running track
  const circumference = 2 * Math.PI * radius;
  
  // progress goes from 0 (start) to 1 (complete)
  const progress = count / currentDua.target;
  
  // How much of the ring to "fill" with colour
  // NOTE: strokeDashoffset shrinks as progress grows
  // like slowly revealing a hidden circle underneath
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Svg
      width={size}
      height={size}
      style={{ alignSelf: 'center', marginBottom: 8 }}>
      
      {/* Background ring — always full, shows in border colour */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={theme.colors.border}
        strokeWidth={strokeWidth}
        fill="transparent"
      />

      {/* Foreground ring — fills as count increases */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={theme.colors.accent}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        // NOTE: rotate -90 degrees so ring starts filling from top
        // By default SVG circles start from the right (3 o'clock)
        transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        strokeLinecap="round"
      />

    </Svg>
  );
})()}

      {/* TAP TO COUNT — the primary interaction element */}
      <TouchableOpacity
        onPress={handleTap}
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: 100,
          width: 160,
          height: 160,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.colors.accent,
          marginBottom: 32,
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