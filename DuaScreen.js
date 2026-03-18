/**
 * DuaScreen.js
 * Purpose: Displays all duas for a given category, grouped by section.
 *          Supports favouriting and per-dua audio preview playback.
 * Dependencies: React Native, expo-av, husn_en.json, favorites.js, theme.js
 * Context: Navigated to from HomeScreen with { category, datasetTitles }.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, FlatList, Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import data from './husn_en.json';
import { getFavorites, addFavorite, removeFavorite } from './favorites';
import {
  loadPlaylists,
  createPlaylist,
  addDuaToPlaylist,
} from './data/playlistStorage';
import { theme } from './theme';

export default function DuaScreen({ route }) {
  const { category, duaIds } = route.params;
  const [favorites, setFavorites] = useState([]);

  // ── Audio state ─────────────────────────────────────────────────
  // ID of the dua whose audio is currently loaded/playing
  const [playingId, setPlayingId] = useState(null);

  // Holds the active expo-av Sound object
  const soundRef = useRef(null);

  /**
   * stopAndUnloadAudio — halts playback and releases the Sound object.
   * Called before every new preview and on screen unmount.
   */
  const stopAndUnloadAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlayingId(null);
  };

  /**
   * handlePreview — plays (or stops) audio for a dua item in the list.
   * Tapping the same item while playing stops it.
   * Tapping a different item stops the previous before starting the new one.
   */
  const handlePreview = async (dua) => {
    if (!dua.AUDIO) return;

    // Tapping the same item while playing → stop
    if (playingId === dua.ID) {
      await stopAndUnloadAudio();
      return;
    }

    // Stop any currently playing preview before starting a new one
    await stopAndUnloadAudio();

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: dua.AUDIO },
      { shouldPlay: true }
    );
    soundRef.current = sound;
    setPlayingId(dua.ID);

    // Auto-reset when track finishes naturally
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        soundRef.current = null;
        setPlayingId(null);
      }
    });
  };

  /**
   * On screen unmount, release the Sound object to prevent memory leaks.
   */
  useEffect(() => {
    return () => { stopAndUnloadAudio(); };
  }, []);

  useEffect(() => {
    getFavorites().then(setFavorites);
  }, []);

  // ── Add to Playlist state ────────────────────────────────────────
  // The dua object that triggered the sheet (null = sheet closed)
  const [addingDua, setAddingDua] = useState(null);

  // Playlists loaded when the sheet opens
  const [sheetPlaylists, setSheetPlaylists] = useState([]);

  // Toast message — null when hidden, string when visible
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  /**
   * showToast — briefly displays a success message above the content.
   * Auto-hides after 1.8 seconds using a fade-out animation.
   * @param {string} message - text to display
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
   * openPlaylistSheet — loads the latest playlists then opens the bottom sheet
   * for the given dua. Loading fresh ensures newly created playlists appear.
   * @param {object} dua - the dua object from the dataset
   */
  const openPlaylistSheet = async (dua) => {
    const lists = await loadPlaylists();
    setSheetPlaylists(lists);
    setAddingDua(dua);
  };

  /**
   * handleAddToPlaylist — adds the pending dua to the chosen playlist,
   * closes the sheet, and shows a brief success toast.
   * @param {object} playlist - the target playlist object
   */
  const handleAddToPlaylist = async (playlist) => {
    await addDuaToPlaylist(playlist.id, addingDua.ID);
    setAddingDua(null);
    showToast(`Added to ${playlist.name}`);
  };

  /**
   * handleAddToNewPlaylist — creates a new 'custom' playlist containing
   * just this dua, then shows the success toast.
   * Name uses the current time (HH:MM) to avoid duplicates after deletions.
   */
  const handleAddToNewPlaylist = async () => {
    const name = `My Playlist ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const created = await createPlaylist(name, 'custom', [addingDua.ID], null);
    setAddingDua(null);
    showToast(`Added to ${created.name}`);
  };

  /**
   * Build sections by matching each duaId against the OUTER group ID
   * on data.English entries (not the inner TEXT[n].ID).
   *
   * Think of husn_en.json like a book of chapters:
   *   - data.English[n]         = a chapter  (ID + TITLE + TEXT[])
   *   - data.English[n].TEXT[m] = a verse     (ID + ARABIC_TEXT + …)
   *
   * duaIds from categories.js are chapter numbers, not verse numbers.
   * We look up each chapter in order, then show ALL its verses.
   *
   * Order is preserved by mapping over duaIds rather than over the
   * dataset, so the category's intended sequence is respected.
   */
  const groupIndex = Object.fromEntries(
    data.English.map(group => [Number(group.ID), group])
  );
  const sections = duaIds
    .map(id => groupIndex[Number(id)])
    .filter(Boolean);

  const handleFavorite = async (id) => {
    if (favorites.includes(id)) {
      await removeFavorite(id);
      setFavorites(favorites.filter((f) => f !== id));
    } else {
      await addFavorite(id);
      setFavorites([...favorites, id]);
    }
  };

  // ── Empty state guard ────────────────────────────────────────────
  if (sections.length === 0) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.screen,
      }}>
        <Text style={{ fontSize: 32, marginBottom: 16 }}>📭</Text>
        <Text style={{
          fontSize: theme.typography.body,
          color: theme.colors.subtle,
          textAlign: 'center',
          lineHeight: 24,
        }}>
          No duas found for this category
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: theme.spacing.screen, paddingBottom: 40 }}
    >

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

              {/* Card top row — audio control (left) + favorite (right) */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>

                {/* Play preview or no-audio badge */}
                {dua.AUDIO ? (
                  <TouchableOpacity
                    onPress={() => handlePreview(dua)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: theme.radius.button,
                      borderWidth: 1,
                      borderColor: playingId === dua.ID
                        ? theme.colors.accent
                        : theme.colors.border,
                      backgroundColor: playingId === dua.ID
                        ? theme.colors.accent + '18'
                        : 'transparent',
                    }}>
                    <Text style={{
                      fontSize: 10,
                      color: playingId === dua.ID
                        ? theme.colors.accent
                        : theme.colors.subtle,
                      letterSpacing: 1.5,
                      fontFamily: 'Courier New',
                    }}>
                      {playingId === dua.ID ? '⏸  STOP' : '▶  PLAY'}
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

                {/* Right-side actions: + playlist and favourite */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* Add to playlist button */}
                  <TouchableOpacity
                    onPress={() => openPlaylistSheet(dua)}
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

                  {/* Favourite button */}
                  <TouchableOpacity onPress={() => handleFavorite(dua.ID)}>
                    <Text style={{ fontSize: 18 }}>
                      {favorites.includes(dua.ID) ? '❤️' : '🤍'}
                    </Text>
                  </TouchableOpacity>
                </View>

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

    {/* ── Add to Playlist bottom sheet ── */}
    <Modal
      visible={!!addingDua}
      transparent
      animationType="slide"
      onRequestClose={() => setAddingDua(null)}>
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
            {addingDua?.TRANSLATED_TEXT
              ? addingDua.TRANSLATED_TEXT.length > 60
                ? addingDua.TRANSLATED_TEXT.slice(0, 60) + '…'
                : addingDua.TRANSLATED_TEXT
              : ''}
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
            onPress={() => setAddingDua(null)}
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