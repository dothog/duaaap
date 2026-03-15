import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import data from './husn_en.json';
import { getFavorites, addFavorite, removeFavorite } from './favorites';
import { theme } from './theme';

export default function DuaScreen({ route }) {
  const { category, datasetTitles } = route.params;
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  const sections = data.English.filter((item) =>
    datasetTitles.includes(item.TITLE)
  );

  const handleFavorite = async (id) => {
    if (favorites.includes(id)) {
      await removeFavorite(id);
      setFavorites(favorites.filter((f) => f !== id));
    } else {
      await addFavorite(id);
      setFavorites([...favorites, id]);
    }
  };

  return (
    <ScrollView style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.screen,
    }}>

      {/* Category heading */}
      <Text style={{
        fontSize: theme.typography.heading,
        color: theme.colors.text,
        marginTop: 20,
        marginBottom: 24,
        letterSpacing: 1,
      }}>
        {category}
      </Text>

      {sections.map((section) => (
        <View key={section.ID}>

          {/* Section title */}
          <Text style={{
            fontSize: 13,
            color: theme.colors.accent,
            letterSpacing: 2,
            marginBottom: 12,
            textTransform: 'uppercase',
          }}>
            {section.TITLE}
          </Text>

          {section.TEXT.map((dua) => (
            <View key={dua.ID} style={{
              marginBottom: 20,
              padding: theme.spacing.card,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>

              {/* Favorite button */}
              <TouchableOpacity
                onPress={() => handleFavorite(dua.ID)}
                style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                <Text style={{ fontSize: 18 }}>
                  {favorites.includes(dua.ID) ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>

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

              {/* Divider line */}
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
        </View>
      ))}
    </ScrollView>
  );
}