/**
 * SearchScreen.js
 * Purpose: Full-text search across all dua groups in husn_en.json.
 *          Matches against each group's TITLE and any verse's TRANSLATED_TEXT.
 *          Results are group-level cards that navigate to CounterScreen
 *          for a focused recitation session, or can be added to a playlist.
 * Dependencies: React Native, husn_en.json, categories.js, playlistStorage.js, theme.js
 * Context: Navigated to from HomeScreen.
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import data from './husn_en.json';
import { CATEGORIES } from './data/categories';
import {
  loadPlaylists,
  createPlaylist,
  addDuaToPlaylist,
} from './data/playlistStorage';
import { theme } from './theme';

/**
 * GROUP_CATEGORY — reverse map from outer group ID → category name.
 * Built once at module level so lookups are O(1) during render.
 * Groups that don't appear in any category map to undefined (shown as 'General').
 */
const GROUP_CATEGORY = {};
CATEGORIES.forEach(cat => {
  cat.duaIds.forEach(id => {
    GROUP_CATEGORY[id] = { name: cat.name, emoji: cat.emoji };
  });
});

/**
 * searchGroups — filters data.English groups by query.
 * Matches if the group TITLE contains the query, OR if any verse's
 * TRANSLATED_TEXT contains the query. Case-insensitive.
 * @param {string} query - lowercased, trimmed search string
 * @returns {object[]} matching group objects from data.English
 */
const searchGroups = (query) => {
  const q = query.toLowerCase();
  return data.English.filter(group =>
    group.TITLE?.toLowerCase().includes(q) ||
    group.TEXT?.some(verse => verse.TRANSLATED_TEXT?.toLowerCase().includes(q))
  );
};

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');

  // ── Add to Playlist sheet ────────────────────────────────────────
  // The group object that triggered the sheet (null = sheet closed)
  const [addingGroup, setAddingGroup] = useState(null);

  // Playlists loaded when the sheet opens
  const [sheetPlaylists, setSheetPlaylists] = useState([]);

  // Toast message — null when hidden, string when visible
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  /**
   * showToast — briefly displays a success message at the bottom.
   * Auto-hides after 1.8 seconds using a fade-out animation.
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
   * openPlaylistSheet — loads the latest playlists then opens the bottom sheet.
   * @param {object} group - dua group from data.English
   */
  const openPlaylistSheet = async (group) => {
    const lists = await loadPlaylists();
    setSheetPlaylists(lists);
    setAddingGroup(group);
  };

  /**
   * handleAddToPlaylist — adds the group's outer ID to the chosen playlist.
   * CounterScreen resolves outer IDs → all verses automatically.
   */
  const handleAddToPlaylist = async (playlist) => {
    await addDuaToPlaylist(playlist.id, addingGroup.ID);
    setAddingGroup(null);
    showToast(`Added to ${playlist.name}`);
  };

  /**
   * handleAddToNewPlaylist — creates a new 'custom' playlist containing
   * just this dua group, then shows the success toast.
   * Name uses the current time (HH:MM) to avoid duplicates after deletions.
   */
  const handleAddToNewPlaylist = async () => {
    const name = `My Playlist ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const created = await createPlaylist(name, 'custom', [addingGroup.ID], null);
    setAddingGroup(null);
    showToast(`Added to ${created.name}`);
  };

  /**
   * handleTapCard — navigates to CounterScreen for a focused recitation
   * session containing all verses in this group.
   * @param {object} group - dua group from data.English
   */
  const handleTapCard = (group) => {
    navigation.navigate('Counter', {
      playlist: {
        title: group.TITLE,
        duaIds: [group.ID],
        datasetTitles: [],
      },
    });
  };

  const results = query.trim().length >= 2 ? searchGroups(query.trim()) : [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: theme.spacing.screen, paddingBottom: 40 }}
    >

      {/* Search input with platform-appropriate clear affordance */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.button,
        backgroundColor: theme.colors.card,
        marginBottom: 20,
        marginTop: 8,
        paddingRight: query.length > 0 && Platform.OS === 'android' ? 4 : 0,
      }}>
        <TextInput
          placeholder="Search by title or translation..."
          placeholderTextColor={theme.colors.subtle}
          value={query}
          onChangeText={setQuery}
          clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
          style={{
            flex: 1,
            padding: theme.spacing.card,
            fontSize: theme.typography.body,
            color: theme.colors.text,
          }}
        />
        {/* Android manual clear button — iOS uses native clearButtonMode */}
        {Platform.OS === 'android' && query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ paddingHorizontal: 10 }}>
            <Text style={{ fontSize: 14, color: theme.colors.subtle }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Results / empty states ── */}
      {query.trim().length < 2 ? (

        /* Prompt — shown before the user has typed enough */
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{
            fontSize: theme.typography.body,
            color: theme.colors.subtle,
            textAlign: 'center',
            lineHeight: 24,
          }}>
            Start typing to search duas...
          </Text>
        </View>

      ) : results.length === 0 ? (

        /* No-match state */
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{
            fontSize: theme.typography.body,
            color: theme.colors.subtle,
            textAlign: 'center',
          }}>
            No duas matched your search
          </Text>
        </View>

      ) : (
        <>
          {/* Result count */}
          <Text style={{
            color: theme.colors.subtle,
            fontSize: theme.typography.small,
            letterSpacing: 2,
            marginBottom: 16,
          }}>
            {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'}
          </Text>

          {/* Result cards */}
          {results.map((group) => {
            const cat = GROUP_CATEGORY[Number(group.ID)];
            return (
              <TouchableOpacity
                key={group.ID}
                onPress={() => handleTapCard(group)}
                activeOpacity={0.75}
                style={{
                  marginBottom: 16,
                  padding: theme.spacing.card,
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}>

                {/* Category badge */}
                {cat && (
                  <Text style={{
                    fontSize: 10,
                    color: theme.colors.accent,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    marginBottom: 6,
                    fontFamily: 'Courier New',
                  }}>
                    {cat.emoji}  {cat.name}
                  </Text>
                )}

                {/* Group title */}
                <Text style={{
                  fontSize: theme.typography.body,
                  color: theme.colors.text,
                  marginBottom: 10,
                  lineHeight: 22,
                }}>
                  {group.TITLE}
                </Text>

                {/* Bottom row: verse count + + Playlist */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Text style={{
                    fontSize: theme.typography.small,
                    color: theme.colors.subtle,
                  }}>
                    {group.TEXT.length} {group.TEXT.length === 1 ? 'verse' : 'verses'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => openPlaylistSheet(group)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: theme.radius.button,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    }}>
                    <Text style={{
                      fontSize: 10,
                      color: theme.colors.subtle,
                      fontFamily: 'Courier New',
                    }}>
                      + Playlist
                    </Text>
                  </TouchableOpacity>
                </View>

              </TouchableOpacity>
            );
          })}
        </>
      )}

    </ScrollView>

    {/* ── Add to Playlist bottom sheet ── */}
    <Modal
      visible={!!addingGroup}
      transparent
      animationType="slide"
      onRequestClose={() => setAddingGroup(null)}>
      <View style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}>
        <View style={{
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
          paddingBottom: 44,
          maxHeight: '70%',
        }}>

          <Text style={{
            fontSize: theme.typography.heading,
            color: theme.colors.text,
            marginBottom: 4,
          }}>
            Add to Playlist
          </Text>
          <Text style={{
            fontSize: theme.typography.small,
            color: theme.colors.subtle,
            marginBottom: 20,
          }}
            numberOfLines={1}>
            {addingGroup?.TITLE}
          </Text>

          {/* + New Playlist option */}
          <TouchableOpacity
            onPress={handleAddToNewPlaylist}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: theme.spacing.card,
              marginBottom: theme.spacing.between,
              borderRadius: theme.radius.button,
              borderWidth: 1,
              borderColor: theme.colors.accent,
              borderStyle: 'dashed',
            }}>
            <Text style={{
              fontSize: theme.typography.body,
              color: theme.colors.accent,
            }}>
              + New Playlist
            </Text>
          </TouchableOpacity>

          {/* Existing playlists */}
          <FlatList
            data={sheetPlaylists}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <Text style={{
                fontSize: theme.typography.small,
                color: theme.colors.subtle,
                textAlign: 'center',
                marginTop: 8,
              }}>
                No saved playlists yet
              </Text>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleAddToPlaylist(item)}
                style={{
                  padding: theme.spacing.card,
                  marginBottom: theme.spacing.between,
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.radius.card,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <Text style={{
                  fontSize: theme.typography.body,
                  color: theme.colors.text,
                }}>
                  {item.name}
                </Text>
                <Text style={{
                  fontSize: theme.typography.small,
                  color: theme.colors.subtle,
                }}>
                  {item.duaIds.length} {item.duaIds.length === 1 ? 'section' : 'sections'}
                </Text>
              </TouchableOpacity>
            )}
          />

          {/* Cancel */}
          <TouchableOpacity
            onPress={() => setAddingGroup(null)}
            style={{ alignItems: 'center', marginTop: 8, padding: 8 }}>
            <Text style={{
              color: theme.colors.subtle,
              fontSize: theme.typography.body,
            }}>
              Cancel
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>

    {/* ── Toast notification ── */}
    {toast && (
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 40,
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
