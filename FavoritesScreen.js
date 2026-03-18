import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import data from './husn_en.json';
import { getFavorites, removeFavorite } from './favorites';
import { theme } from './theme';

const ALL_DUAS = data.English.flatMap((section) =>
  section.TEXT.map((dua) => ({
    ...dua,
    SECTION_TITLE: section.TITLE,
  }))
);

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getFavorites()
      .then(setFavorites)
      .finally(() => setIsLoading(false));
  }, []);

  const favoriteDuas = ALL_DUAS.filter((dua) =>
    favorites.includes(dua.ID)
  );

  const handleRemove = async (id) => {
    await removeFavorite(id);
    setFavorites(favorites.filter((f) => f !== id));
  };

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.screen, paddingBottom: 40 }}
    >

      {/* Empty state message */}
      {favoriteDuas.length === 0 && (
        <View style={{
          marginTop: 60,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 32,
            marginBottom: 16,
          }}>
            🤍
          </Text>
          <Text style={{
            color: theme.colors.subtle,
            textAlign: 'center',
            fontSize: theme.typography.body,
            lineHeight: 24,
          }}>
            No favorites saved yet.{'\n'}
            Tap 🤍 on any dua to save it here.
          </Text>
        </View>
      )}

      {/* Favorite dua cards */}
      {favoriteDuas.map((dua) => (
        <View key={dua.ID} style={{
          marginBottom: 20,
          padding: theme.spacing.card,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}>

          {/* Section label + remove button */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <Text style={{
              fontSize: theme.typography.small,
              color: theme.colors.accent,
              letterSpacing: 2,
              textTransform: 'uppercase',
              flex: 1,
            }}>
              {dua.SECTION_TITLE}
            </Text>

            {/* Remove favorite button */}
            <TouchableOpacity onPress={() => handleRemove(dua.ID)}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          </View>

          {/* Arabic text */}
          <Text style={{
            fontSize: theme.typography.arabic,
            color: theme.colors.text,
            textAlign: 'right',
            lineHeight: 40,
            marginBottom: 12,
          }}>
            {dua.ARABIC_TEXT}
          </Text>

          {/* Divider */}
          <View style={{
            height: 1,
            backgroundColor: theme.colors.border,
            marginBottom: 12,
          }}/>

          {/* Translation */}
          <Text style={{
            fontSize: theme.typography.body - 2,
            color: theme.colors.subtle,
            lineHeight: 22,
          }}>
            {dua.TRANSLATED_TEXT}
          </Text>

        </View>
      ))}

    </ScrollView>
  );
}