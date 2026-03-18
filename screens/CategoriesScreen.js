/**
 * screens/CategoriesScreen.js
 * Purpose: Browse all dua categories in a 2-column grid.
 *          A pinned "Favorites" card always appears at the top — it is
 *          always visible regardless of the search query, shows a live
 *          saved-favorites count, and navigates to FavoritesScreen.
 *          Real-time search bar filters the 11 category cards by name.
 *          Each category card shows the emoji, name, and section count.
 * Dependencies: React Native, @react-navigation/native, data/categories.js,
 *               favorites.js, theme.js
 * Context: Navigated to from HomeScreen.
 *          Navigates to DuaScreen with { category, duaIds }.
 *          Navigates to FavoritesScreen.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CATEGORIES } from '../data/categories';
import { getFavorites } from '../favorites';
import { theme } from '../theme';

/**
 * FAVORITES_BG — distinct soft-rose background for the pinned Favorites card.
 * Warm enough to stand out from the regular parchment cards without clashing.
 */
const FAVORITES_BG = '#EDD5D5';

export default function CategoriesScreen({ navigation }) {
  const [query, setQuery] = useState('');

  /**
   * favCount — current number of saved favorites.
   * Loaded fresh every time the screen gains focus so it reflects
   * additions/removals made on FavoritesScreen or DuaScreen.
   */
  const [favCount, setFavCount] = useState(0);

  /**
   * Reload the favorites count whenever this screen comes into focus.
   * Like a notice board that updates its number every time you walk past.
   */
  useFocusEffect(
    useCallback(() => {
      getFavorites().then(ids => setFavCount(ids.length));
    }, [])
  );

  /**
   * filteredCategories — live-filtered subset of CATEGORIES.
   * Empty query shows all 11. Case-insensitive substring match on name.
   * The Favorites card is rendered separately and is never filtered out.
   */
  const filteredCategories = query.trim()
    ? CATEGORIES.filter(cat =>
        cat.name.toLowerCase().includes(query.toLowerCase())
      )
    : CATEGORIES;

  // ── Category card ───────────────────────────────────────────────
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{
        flex: 1,
        margin: 6,
        padding: theme.spacing.card,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 110,
      }}
      onPress={() => navigation.navigate('Duas', {
        category: item.name,
        duaIds: item.duaIds.map(Number),
      })}>

      {/* Emoji */}
      <Text style={{ fontSize: 34, marginBottom: 8 }}>
        {item.emoji}
      </Text>

      {/* Category name */}
      <Text style={{
        fontSize: theme.typography.small + 1,
        color: theme.colors.text,
        textAlign: 'center',
        fontWeight: '500',
        marginBottom: 5,
        lineHeight: 18,
      }}>
        {item.name}
      </Text>

      {/* Section count badge */}
      <Text style={{
        fontSize: 10,
        color: theme.colors.subtle,
        letterSpacing: 1,
        fontFamily: 'Courier New',
      }}>
        {item.duaIds.length} {item.duaIds.length === 1 ? 'SECTION' : 'SECTIONS'}
      </Text>

    </TouchableOpacity>
  );

  /**
   * renderFavoritesCard — pinned full-width card at the top of the list.
   * Uses ListHeaderComponent so it scrolls with the grid and naturally
   * spans the full width regardless of numColumns.
   * Always visible — the search filter only affects the category cards below.
   */
  const renderFavoritesCard = () => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Favorites')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        margin: 6,
        padding: theme.spacing.card,
        backgroundColor: FAVORITES_BG,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        minHeight: 72,
      }}>

      {/* Emoji */}
      <Text style={{ fontSize: 30, marginRight: 14 }}>❤️</Text>

      {/* Label + count */}
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: theme.typography.small + 1,
          color: theme.colors.text,
          fontWeight: '500',
          marginBottom: 4,
        }}>
          Favorites
        </Text>
        <Text style={{
          fontSize: 10,
          color: theme.colors.subtle,
          letterSpacing: 1,
          fontFamily: 'Courier New',
        }}>
          {favCount} {favCount === 1 ? 'SAVED' : 'SAVED'}
        </Text>
      </View>

      {/* Chevron */}
      <Text style={{
        fontSize: 11,
        color: theme.colors.subtle,
        marginLeft: 8,
      }}>
        ›
      </Text>

    </TouchableOpacity>
  );

  // ── Main render ─────────────────────────────────────────────────
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.screen,
    }}>

      {/* Search bar — filters category cards only, not the Favorites card */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search categories..."
        placeholderTextColor={theme.colors.subtle}
        clearButtonMode="while-editing"
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.button,
          padding: 12,
          fontSize: theme.typography.body,
          color: theme.colors.text,
          backgroundColor: theme.colors.card,
          marginBottom: 16,
        }}
      />

      {/* 2-column grid with pinned Favorites header */}
      <FlatList
        data={filteredCategories}
        keyExtractor={item => item.id}
        numColumns={2}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={renderFavoritesCard}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{
              fontSize: theme.typography.body,
              color: theme.colors.subtle,
            }}>
              No categories match "{query}"
            </Text>
          </View>
        )}
      />

    </View>
  );
}
