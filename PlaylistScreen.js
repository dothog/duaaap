import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { PLAYLISTS } from './playlists';
import { theme } from './theme';

export default function PlaylistScreen({ navigation }) {
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
        marginBottom: 8,
        letterSpacing: 1,
      }}>
        Dua Counter
      </Text>

      <Text style={{
        fontSize: theme.typography.small,
        color: theme.colors.subtle,
        letterSpacing: 2,
        marginBottom: 24,
      }}>
        SELECT A PLAYLIST
      </Text>

      {/* Playlist cards */}
      {PLAYLISTS.map((playlist) => (
        <TouchableOpacity
          key={playlist.id}
          onPress={() => navigation.navigate('Counter', { playlist })}
          style={{
            padding: theme.spacing.card,
            marginBottom: theme.spacing.between,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}>

          <Text style={{
            fontSize: theme.typography.body,
            color: theme.colors.text,
            marginBottom: 4,
          }}>
            {playlist.emoji}  {playlist.title}
          </Text>

          <Text style={{
            fontSize: theme.typography.small,
            color: theme.colors.subtle,
            letterSpacing: 1,
          }}>
            {playlist.datasetTitles.length} SECTIONS
          </Text>

        </TouchableOpacity>
      ))}

    </ScrollView>
  );
}