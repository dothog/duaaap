/**
 * CounterScreen.js
 * Purpose: Displays a dua-by-dua counter interface for a selected playlist.
 *          Users tap a large circle to count recitations, with auto-advance
 *          to the next dua when the target count is reached.
 *          Each dua supports independent audio playback via expo-av.
 * Dependencies: React Native, expo-av, husn_en.json, theme.js
 * Context: Navigated to from PlaylistScreen with a playlist object as a param.
 */

import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Audio } from 'expo-av';
import data from './husn_en.json';
import { theme } from './theme';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

export default function CounterScreen({ route, navigation }) {
  const { playlist } = route.params;

  /**
   * Build a flat list of all duas in this playlist.
   * Supports two lookup strategies depending on what the caller provided:
   *
   * 1. duaIds (new) — used by PlaylistDetailScreen and user-created playlists.
   *    Looks up each dua by ID across all sections. Preserves the caller's order.
   *
   * 2. datasetTitles (legacy) — used by PlaylistScreen (curated playlists).
   *    Filters sections by title then flattens, preserving section order.
   *
   * Think of it like two different ways to find books in a library:
   * by ISBN (duaIds) or by shelf label (datasetTitles).
   */
  const allDuas = playlist.duaIds && playlist.duaIds.length > 0
    // Path 1 — ID-based lookup, preserves caller order.
    //
    // Each ID is tried as a GROUP first (outer data.English entry — the
    // level that categories.js and AddDuasScreen work with).  When found,
    // ALL verses of that group are included in sequence so the whole
    // playlist is one continuous session without stopping between groups.
    //
    // If the ID is not a group ID (e.g. a verse-level ID stored by the
    // DuaScreen "Add to Playlist" button), we fall back to a flat verse
    // lookup so those playlists still work correctly.
    //
    // Think of it like a playlist of albums: playing "Abbey Road" plays
    // every track back-to-back; but if you added a single track by its
    // own ID, that still works too.
    ? (() => {
        // Group index: outer section ID → section object
        const groupIdx = Object.fromEntries(
          data.English.map(s => [Number(s.ID), s])
        );
        // Verse index: inner TEXT item ID → verse object (fallback)
        const verseIdx = Object.fromEntries(
          data.English.flatMap(s =>
            s.TEXT.map(dua => [Number(dua.ID), {
              id: dua.ID,
              arabic: dua.ARABIC_TEXT,
              translation: dua.TRANSLATED_TEXT,
              target: dua.REPEAT || 1,
              sectionTitle: s.TITLE,
              audio: dua.AUDIO || null,
            }])
          )
        );
        return playlist.duaIds.flatMap(id => {
          const numId = Number(id);
          const group = groupIdx[numId];
          if (group) {
            // Group found → include all its verses as a continuous block
            return group.TEXT.map(dua => ({
              id: dua.ID,
              arabic: dua.ARABIC_TEXT,
              translation: dua.TRANSLATED_TEXT,
              target: dua.REPEAT || 1,
              sectionTitle: group.TITLE,
              audio: dua.AUDIO || null,
            }));
          }
          // Fallback → treat as a direct verse ID
          const verse = verseIdx[numId];
          return verse ? [verse] : [];
        });
      })()
    // Path 2 — legacy section-title lookup
    : data.English
        .filter(section => playlist.datasetTitles.includes(section.TITLE))
        .flatMap(section => section.TEXT.map(dua => ({
          id: dua.ID,
          arabic: dua.ARABIC_TEXT,
          translation: dua.TRANSLATED_TEXT,
          // NOTE: Default to 1 if REPEAT is missing or 0 in the dataset
          target: dua.REPEAT || 1,
          sectionTitle: section.TITLE,
          // AUDIO is present on ~267/284 duas — null if missing
          audio: dua.AUDIO || null,
        })));

  // Tracks which dua in the playlist we are currently on
  const [currentIndex, setCurrentIndex] = useState(0);

  // Tracks how many times the current dua has been recited
  const [count, setCount] = useState(0);

  // Tracks whether the entire playlist has been completed
  const [complete, setComplete] = useState(false);

  // ── Audio state ─────────────────────────────────────────────────
  // Holds the expo-av Sound object for the current verse
  const soundRef = useRef(null);

  // Whether audio is currently playing
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Toast (audio error feedback) ────────────────────────────────
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  /**
   * showToast — briefly displays a message overlay, then fades out.
   * @param {string} message
   */
  const showToast = (message) => {
    setToast(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  /**
   * stopAndUnloadAudio — stops playback and frees the Sound object.
   * Called on verse advance and on screen unmount.
   */
  const stopAndUnloadAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
  };

  /**
   * When the current verse index changes, stop audio and reset
   * to paused state — do NOT auto-play the next verse.
   */
  useEffect(() => {
    stopAndUnloadAudio();
  }, [currentIndex]);

  /**
   * On screen unmount, release the Sound object to prevent memory leaks.
   * Think of it like turning off a radio when you leave the room.
   */
  useEffect(() => {
    return () => { stopAndUnloadAudio(); };
  }, []);

  /**
   * Set the navigation header title to the playlist name so the user
   * always knows which playlist they are reciting. Falls back to
   * 'Dua Counter' if no title was passed.
   */
  useEffect(() => {
    navigation.setOptions({ title: playlist.title || 'Dua Counter' });
  }, []);

  /**
   * handlePlayPause — toggles audio playback for the current verse.
   * - If playing: pauses but keeps sound loaded (cheap resume).
   * - If paused with sound loaded: resumes from paused position.
   * - If no sound loaded yet: fetches and plays the audio URL.
   * Counter tap (handleTap) is completely unaffected by this.
   */
  const handlePlayPause = async () => {
    if (!currentDua.audio) return;

    if (isPlaying) {
      // Pause — keep Sound object alive for cheap resume
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else if (soundRef.current) {
      // Resume from paused position
      await soundRef.current.playAsync();
      setIsPlaying(true);
    } else {
      // First play — load from URL then start
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: currentDua.audio },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        setIsPlaying(true);

        // Auto-reset when track finishes naturally
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            soundRef.current = null;
          }
        });
      } catch {
        // Network error or bad URL — inform the user without crashing
        setIsPlaying(false);
        soundRef.current = null;
        showToast('Audio unavailable for this dua');
      }
    }
  };

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

  // ─── Empty playlist guard ────────────────────────────────────────
  // Shown when the playlist's IDs don't resolve to any known duas in the
  // dataset — prevents a crash on currentDua.target / currentDua.audio access.
  if (allDuas.length === 0) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.screen,
      }}>
        <Text style={{ fontSize: 32, marginBottom: 24 }}>⚠️</Text>
        <Text style={{
          fontSize: theme.typography.body,
          color: theme.colors.subtle,
          textAlign: 'center',
          lineHeight: 24,
          marginBottom: 32,
        }}>
          Could not load duas — please go back and try again
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.button,
            padding: theme.spacing.card,
            width: '100%',
          }}>
          <Text style={{
            color: '#fff',
            textAlign: 'center',
            fontSize: theme.typography.body,
          }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          onPress={() => navigation.navigate('Home')}
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
            Return Home
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

      {/* ── Audio control — play/pause or no-audio badge ── */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 10,
        paddingRight: 4,
      }}>
        {currentDua.audio ? (
          <TouchableOpacity
            onPress={handlePlayPause}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: theme.radius.button,
              borderWidth: 1,
              borderColor: isPlaying ? theme.colors.accent : theme.colors.border,
              backgroundColor: isPlaying
                ? theme.colors.accent + '18'
                : 'transparent',
            }}>
            <Text style={{
              fontSize: 11,
              color: isPlaying ? theme.colors.accent : theme.colors.subtle,
              letterSpacing: 1.5,
              fontFamily: 'Courier New',
            }}>
              {isPlaying ? '⏸  PAUSE' : '▶  PLAY'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}>
            <Text style={{
              fontSize: 10,
              color: theme.colors.border,
              letterSpacing: 1.5,
              fontFamily: 'Courier New',
            }}>
              NO AUDIO
            </Text>
          </View>
        )}
      </View>

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

    {/* ── Toast — audio error feedback ── */}
    {toast && (
      <Animated.View style={{
        position: 'absolute',
        bottom: 80,
        left: 24,
        right: 24,
        backgroundColor: theme.colors.text,
        borderRadius: theme.radius.button,
        padding: 14,
        alignItems: 'center',
        opacity: toastOpacity,
      }}>
        <Text style={{
          color: theme.colors.background,
          fontSize: theme.typography.small,
          letterSpacing: 0.5,
        }}>
          {toast}
        </Text>
      </Animated.View>
    )}

  </View>
);
}