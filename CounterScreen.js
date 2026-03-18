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
import * as Haptics from 'expo-haptics';

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

   // Stores scroll measurements for Arabic text
const [arabicScrollData, setArabicScrollData] = useState({
  offset: 0, visible: 0, total: 0
});

// Stores scroll measurements for translation text
const [translationScrollData, setTranslationScrollData] = useState({
  offset: 0, visible: 0, total: 0
});

  // Convenience variables derived from state
  const currentDua = allDuas[currentIndex];

  // NOTE: We subtract 1 because arrays are zero-indexed —
  // the last item's index is always length - 1, not length
  const isLastDua = currentIndex === allDuas.length - 1;

  /**
 * handleTap — called every time user taps the counter circle.
 * Increments count and advances to next dua when target is reached.
 * Each outcome triggers a different haptic intensity:
 * - Normal count → light click
 * - Dua complete → medium impact  
 * - Playlist complete → heavy impact
 */
const handleTap = async () => {
  if (complete) return;
  const newCount = count + 1;

  if (newCount >= currentDua.target) {
    if (isLastDua) {
      // Outcome 3 — entire playlist complete!
      // Heavy vibration = big achievement feeling
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      setComplete(true);
    } else {
      // Outcome 2 — dua complete, moving to next
      // Medium impact = small achievement feeling
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );
      setCurrentIndex(currentIndex + 1);
      setCount(0);
    }
  } else {
    // Outcome 1 — normal count increase
    // Light impact = subtle bead click feeling
    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light
    );
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

/**
 * calculateIndicator — computes scroll indicator size and position
 * @param {object} scrollData - offset, visible and total measurements
 * @param {number} trackHeight - total height of the indicator track
 * @returns {object} - height and marginTop for the indicator, 
 *                     and whether to show it
 */
const calculateIndicator = (scrollData, trackHeight) => {
  const { offset, visible, total } = scrollData;

  // NOTE: Only show indicator if content is taller than container
  // Like only showing an elevator if building has more than 1 floor
  const needsScroll = total > visible;
  if (!needsScroll) return { show: false, height: 0, top: 0 };

  // Indicator height proportional to visible/total ratio
  const indicatorHeight = (visible / total) * trackHeight;

  // Scrollable distance = total content - visible window
  const scrollableDistance = total - visible;

  // Position moves proportionally as user scrolls
  const indicatorTop = (offset / scrollableDistance) 
    * (trackHeight - indicatorHeight);

  return {
    show: true,
    height: indicatorHeight,
    top: indicatorTop,
  };
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
    paddingBottom: 60,
  }}>

    {/* ── TOP ZONE — scrollable content ── */}
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}>

      {/* Progress — shows current position in playlist */}
      <Text style={{
        fontSize: theme.typography.small,
        color: theme.colors.subtle,
        letterSpacing: 2,
        marginTop: 8,
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

      {/* Arabic text container with smart scroll indicator */}
      <View style={{
        maxHeight: 160,
        marginBottom: 24,
        flexDirection: 'row',
      }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            setArabicScrollData({
              offset: contentOffset.y,
              total: contentSize.height,
              visible: layoutMeasurement.height,
            });
          }}
          scrollEventThrottle={16}>
          <Text style={{
            fontSize: theme.typography.arabic,
            color: theme.colors.text,
            textAlign: 'right',
            lineHeight: 44,
            paddingRight: 8,
          }}>
            {currentDua.arabic}
          </Text>
        </ScrollView>

        {/* Smart indicator — Arabic */}
        {calculateIndicator(arabicScrollData, 160).show && (
          <View style={{
            width: 3,
            height: 160,
            backgroundColor: theme.colors.border,
            borderRadius: 3,
            marginLeft: 4,
          }}>
            <View style={{
              width: 3,
              backgroundColor: theme.colors.accent,
              borderRadius: 3,
              height: calculateIndicator(arabicScrollData, 160).height,
              marginTop: calculateIndicator(arabicScrollData, 160).top,
            }}/>
          </View>
        )}
      </View>

      {/* Translation container with smart scroll indicator */}
      <View style={{
        maxHeight: 80,
        marginBottom: 16,
        flexDirection: 'row',
      }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            setTranslationScrollData({
              offset: contentOffset.y,
              total: contentSize.height,
              visible: layoutMeasurement.height,
            });
          }}
          scrollEventThrottle={16}>
          <Text style={{
            fontSize: theme.typography.body - 2,
            color: theme.colors.subtle,
            lineHeight: 22,
            paddingRight: 8,
          }}>
            {currentDua.translation}
          </Text>
        </ScrollView>

        {/* Smart indicator — Translation */}
        {calculateIndicator(translationScrollData, 80).show && (
          <View style={{
            width: 3,
            height: 80,
            backgroundColor: theme.colors.border,
            borderRadius: 3,
            marginLeft: 4,
          }}>
            <View style={{
              width: 3,
              backgroundColor: theme.colors.accent,
              borderRadius: 3,
              height: calculateIndicator(translationScrollData, 80).height,
              marginTop: calculateIndicator(translationScrollData, 80).top,
            }}/>
          </View>
        )}
      </View>

    </ScrollView>
    {/* ── END TOP ZONE ── */}

    {/* ── BOTTOM ZONE — pinned counter, never moves ── */}
    <View style={{
      // NOTE: borderTopWidth adds subtle divider between
      // scrollable content and fixed counter below
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 16,
    }}>

      {/* Counter row — PREV, ring/counter, NEXT */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.card,
      }}>

        {/* Previous arrow */}
        <TouchableOpacity
          onPress={handlePrevious}
          disabled={currentIndex === 0}
          style={{
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{
            fontSize: 28,
            color: currentIndex === 0
              ? theme.colors.border
              : theme.colors.subtle,
          }}>
            ←
          </Text>
        </TouchableOpacity>

        {/* Ring/Counter wrapper */}
        <View style={{
          alignSelf: 'center',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          width: 150,
          height: 150,
        }}>

          {/* Progress ring */}
          {(() => {
            const size = 150;
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
                <Circle
                  cx={size / 2} cy={size / 2} r={radius}
                  stroke={theme.colors.border}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <Circle
                  cx={size / 2} cy={size / 2} r={radius}
                  stroke={theme.colors.accent}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(-90, ${size/2}, ${size/2})`}
                  strokeLinecap="round"
                />
              </Svg>
            );
          })()}

          {/* Counter circle */}
          <TouchableOpacity
            onPress={handleTap}
            style={{
              position: 'absolute',
              backgroundColor: theme.colors.card,
              borderRadius: 100,
              width: 115,
              height: 115,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{
              fontSize: 40,
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

        {/* Next arrow */}
        <TouchableOpacity
          onPress={handleNext}
          disabled={isLastDua}
          style={{
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{
            fontSize: 28,
            color: isLastDua
              ? theme.colors.border
              : theme.colors.subtle,
          }}>
            →
          </Text>
        </TouchableOpacity>

      </View>
    </View>
    {/* ── END BOTTOM ZONE ── */}

  </View>
);
}