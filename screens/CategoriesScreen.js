/**
 * screens/CategoriesScreen.js
 * Purpose: Browse all dua categories in a 2-column grid.
 *          Real-time search bar filters by category name.
 *          Each card shows the emoji, category name, and dua count.
 * Dependencies: React Native, data/categories.js, theme.js
 * Context: Navigated to from HomeScreen.
 *          Navigates to DuaScreen with { category, duaIds }.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { CATEGORIES } from '../data/categories';
import { theme } from '../theme';

export default function CategoriesScreen({ navigation }) {
  const [query, setQuery] = useState('');

  /**
   * filteredCategories — live-filtered subset of CATEGORIES.
   * Empty query shows all. Case-insensitive substring match on name.
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

      {/* Dua count badge */}
      <Text style={{
        fontSize: 10,
        color: theme.colors.subtle,
        letterSpacing: 1,
        fontFamily: 'Courier New',
      }}>
        {item.duaIds.length} DUAS
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

      {/* Search bar */}
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

      {/* 2-column grid */}
      <FlatList
        data={filteredCategories}
        keyExtractor={item => item.id}
        numColumns={2}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
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
