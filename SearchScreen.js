import { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import data from './husn_en.json';
import { theme } from './theme';

const ALL_DUAS = data.English.flatMap((section) =>
  section.TEXT.map((dua) => ({
    ...dua,
    SECTION_TITLE: section.TITLE,
  }))
);

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  const results = ALL_DUAS.filter((dua) =>
    dua.TRANSLATED_TEXT?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <ScrollView style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.screen,
    }}>

      {/* Header */}
      <Text style={{
        fontSize: theme.typography.heading,
        color: theme.colors.text,
        marginTop: 20,
        marginBottom: 20,
        letterSpacing: 1,
      }}>
        Search Duas
      </Text>

      {/* Search input */}
      <TextInput
        placeholder="Search in English..."
        placeholderTextColor={theme.colors.subtle}
        value={query}
        onChangeText={setQuery}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.button,
          padding: theme.spacing.card,
          fontSize: theme.typography.body,
          backgroundColor: theme.colors.card,
          color: theme.colors.text,
          marginBottom: 20,
        }}
      />

      {/* Result count */}
      {query.length > 0 && (
        <Text style={{
          color: theme.colors.subtle,
          fontSize: theme.typography.small,
          letterSpacing: 2,
          marginBottom: 16,
        }}>
          {results.length} DUAS FOUND
        </Text>
      )}

      {/* Results */}
      {results.map((dua) => (
        <View key={dua.ID} style={{
          marginBottom: 16,
          padding: theme.spacing.card,
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}>

          {/* Section label */}
          <Text style={{
            fontSize: theme.typography.small,
            color: theme.colors.accent,
            letterSpacing: 2,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}>
            {dua.SECTION_TITLE}
          </Text>

          {/* Arabic */}
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