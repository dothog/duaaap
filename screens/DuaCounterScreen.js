/**
 * screens/DuaCounterScreen.js
 * Purpose: Entry point for the Dua Counter — lets the user pick a
 *          playlist or category and go straight into CounterScreen.
 *
 *          Section 1 — My Playlists  (horizontal card row, AsyncStorage)
 *          Section 2 — Categories    (2-column grid, from data/categories.js)
 *
 * Dependencies: React Native, data/playlistStorage.js, data/categories.js, theme.js
 * Context: Navigated to from HomeScreen.
 *          Navigates to CounterScreen with { playlist: { title, duaIds, datasetTitles } }.
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { loadPlaylists } from '../data/playlistStorage';
import { CATEGORIES } from '../data/categories';
import { theme } from '../theme';

export default function DuaCounterScreen({ navigation }) {
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Reload playlists every time the screen comes into focus so that
   * newly created playlists appear without a manual refresh.
   * Like a shop window that updates its display whenever you walk past.
   */
  useFocusEffect(
    useCallback(() => {
      loadPlaylists()
        .then(setPlaylists)
        .finally(() => setIsLoading(false));
    }, [])
  );

  /**
   * navigateToCounter — shared helper for both playlists and categories.
   * CounterScreen expects a playlist object with title + duaIds.
   * @param {string} title  — display name shown in the counter header
   * @param {number[]} duaIds — group-level IDs to pass to CounterScreen
   */
  const navigateToCounter = (title, duaIds) => {
    navigation.navigate('Counter', {
      playlist: {
        title,
        duaIds: duaIds.map(Number),
        datasetTitles: [], // unused when duaIds is present
      },
    });
  };

  // ── Section label style (reused for both headers) ───────────────
  const sectionLabel = {
    fontSize: 11,
    color: theme.colors.accent,
    letterSpacing: 3,
    fontFamily: 'Courier New',
    textTransform: 'uppercase',
    marginBottom: 12,
  };

  // ── Loading guard ────────────────────────────────────────────────
  if (isLoading) return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.screen,
        paddingTop: theme.spacing.screen,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Section 1: My Playlists ── */}
      <Text style={sectionLabel}>My Playlists</Text>

      {playlists.length === 0 ? (
        <View style={{
          padding: theme.spacing.card,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          marginBottom: 32,
        }}>
          <Text style={{
            fontSize: theme.typography.small,
            color: theme.colors.subtle,
            textAlign: 'center',
            lineHeight: 20,
          }}>
            No playlists yet — create one in Playlists
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          style={{ marginBottom: 32 }}
        >
          {playlists.map(pl => (
            <TouchableOpacity
              key={pl.id}
              onPress={() => navigateToCounter(pl.name, pl.duaIds)}
              style={{
                width: 130,
                padding: theme.spacing.card,
                backgroundColor: theme.colors.card,
                borderRadius: theme.radius.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                justifyContent: 'space-between',
                minHeight: 80,
              }}>
              <Text style={{
                fontSize: theme.typography.small,
                color: theme.colors.text,
                fontWeight: '500',
                lineHeight: 18,
              }}
                numberOfLines={2}>
                {pl.name}
              </Text>
              <Text style={{
                fontSize: 10,
                color: theme.colors.subtle,
                letterSpacing: 1,
                fontFamily: 'Courier New',
                marginTop: 8,
              }}>
                {pl.duaIds.length} {pl.duaIds.length === 1 ? 'SECTION' : 'SECTIONS'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Section 2: Categories ── */}
      <Text style={sectionLabel}>Categories</Text>

      {/**
       * 2-column grid via flexWrap.
       * Each card is ~48% wide so two fit per row with a gap between them.
       * Using flexWrap instead of a nested FlatList avoids the
       * "VirtualizedList inside ScrollView" warning.
       */}
      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => navigateToCounter(cat.name, cat.duaIds)}
            style={{
              width: '48%',
              padding: theme.spacing.card,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 110,
            }}>

            {/* Emoji */}
            <Text style={{ fontSize: 30, marginBottom: 8 }}>
              {cat.emoji}
            </Text>

            {/* Category name */}
            <Text style={{
              fontSize: theme.typography.small + 1,
              color: theme.colors.text,
              textAlign: 'center',
              fontWeight: '500',
              lineHeight: 18,
              marginBottom: 5,
            }}>
              {cat.name}
            </Text>

            {/* Dua count badge */}
            <Text style={{
              fontSize: 10,
              color: theme.colors.subtle,
              letterSpacing: 1,
              fontFamily: 'Courier New',
            }}>
              {cat.duaIds.length} {cat.duaIds.length === 1 ? 'SECTION' : 'SECTIONS'}
            </Text>

          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}
