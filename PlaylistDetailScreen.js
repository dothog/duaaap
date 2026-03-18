/**
 * PlaylistDetailScreen.js
 * Purpose: Shows all duas in a saved playlist. Users can remove individual duas,
 *          reorder them with ▲/▼ controls, and tap any dua to open CounterScreen
 *          for a focused single-dua recitation session.
 * Dependencies: React Native, husn_en.json, playlistStorage.js, theme.js
 * Context: Navigated to from PlaylistsScreen with { playlistId }.
 *          Navigates to CounterScreen with a synthetic single-dua playlist.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import data from './husn_en.json';
import {
  loadPlaylists,
  removeDuaFromPlaylist,
  savePlaylists,
} from './data/playlistStorage';
import { theme } from './theme';

/**
 * CARD_PALETTE — 8 soft, muted background colors for dua cards.
 * All light enough that dark text (#2C2C2C) is comfortably readable.
 * Tones match the parchment (#F5F0E8) theme.
 */
const CARD_PALETTE = [
  '#E8D5C4', // soft terracotta
  '#C8D5C9', // sage green
  '#C4CDD8', // slate blue
  '#DFC4CF', // dusty rose
  '#D8D2C0', // warm sand
  '#C4D4D7', // muted teal
  '#D4C4D8', // warm lavender
  '#DDD8C0', // muted amber
];

/**
 * getCardColor — deterministically picks a palette color for a dua card.
 * Uses the numeric dua ID modulo palette length — same dua always gets the
 * same color regardless of its current position in the list.
 * @param {number} id - dua ID (item.ID)
 * @returns {string} hex color string
 */
const getCardColor = (id) =>
  CARD_PALETTE[(id ?? 0) % CARD_PALETTE.length];

/**
 * duaIndex — a pre-built lookup table mapping dua ID → dua object.
 * Built once at module level so we don't rebuild it on every render.
 * Like an index at the back of a book — look up a page number instantly.
 */
const duaIndex = Object.fromEntries(
  data.English.flatMap(section =>
    section.TEXT.map(dua => [dua.ID, { ...dua, sectionTitle: section.TITLE }])
  )
);

export default function PlaylistDetailScreen({ route, navigation }) {
  const { playlistId } = route.params;

  // Full playlist object from storage
  const [playlist, setPlaylist] = useState(null);

  // Ordered array of resolved dua objects (from duaIndex)
  const [duas, setDuas] = useState([]);

  // ── Reorder flash animation ──────────────────────────────────────
  // Numeric ID of the dua row currently showing the move flash overlay
  const [flashId, setFlashId] = useState(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  /**
   * triggerMoveFlash — briefly highlights a dua row after a reorder so the
   * user can track which item moved. Like a brief spotlight on the moved card.
   * @param {number} id - dua ID (item.ID) of the row that just moved
   */
  const triggerMoveFlash = (id) => {
    setFlashId(id);
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setFlashId(null));
  };

  /**
   * Reload whenever the screen comes into focus so that changes
   * made from DuaScreen (Add to Playlist) are reflected immediately.
   */
  useFocusEffect(
    useCallback(() => {
      loadPlaylists().then(all => {
        const found = all.find(p => p.id === playlistId);
        if (!found) return;
        setPlaylist(found);
        // Resolve IDs to full objects, preserving playlist order, skipping missing IDs
        setDuas(found.duaIds.map(id => duaIndex[id]).filter(Boolean));
      });
    }, [playlistId])
  );

  /**
   * Keep the navigation header title in sync with the playlist name and count.
   * Runs whenever playlist state changes.
   */
  useEffect(() => {
    if (playlist) {
      navigation.setOptions({
        title: `${playlist.name} · ${duas.length} ${duas.length === 1 ? 'section' : 'sections'}`,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('AddDuas', {
              playlistId,
              playlistName: playlist.name,
              playlistType: playlist.type,
            })}
            style={{ paddingHorizontal: 4, paddingVertical: 6 }}>
            <Text style={{
              color: theme.colors.accent,
              fontSize: theme.typography.small,
              letterSpacing: 0.5,
            }}>
              Edit Duas
            </Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [playlist, duas.length]);

  /**
   * handleRemove — shows a confirmation dialog then removes a dua from the playlist.
   * Updates both AsyncStorage and local state so the UI reflects immediately.
   * @param {number} duaId - the dua ID to remove
   */
  const handleRemove = (duaId) => {
    Alert.alert(
      'Remove from playlist?',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeDuaFromPlaylist(playlistId, duaId);
            setDuas(prev => prev.filter(d => d.ID !== duaId));
            setPlaylist(prev => ({
              ...prev,
              duaIds: prev.duaIds.filter(id => id !== duaId),
            }));
          },
        },
      ]
    );
  };

  /**
   * handleMove — shifts a dua up or down and persists the new order.
   * Updates local state immediately (feels instant), then writes to storage.
   * @param {number} index - current position in the list
   * @param {-1|1} direction - -1 moves up, 1 moves down
   */
  const handleMove = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= duas.length) return;

    const nextDuas = [...duas];
    [nextDuas[index], nextDuas[target]] = [nextDuas[target], nextDuas[index]];
    const nextIds = nextDuas.map(d => d.ID);

    setDuas(nextDuas);
    setPlaylist(prev => ({ ...prev, duaIds: nextIds }));
    triggerMoveFlash(nextDuas[target].ID); // highlight the item that moved

    // Persist new order — load full list, update this playlist, save
    const all = await loadPlaylists();
    const updated = all.map(p =>
      p.id === playlistId ? { ...p, duaIds: nextIds } : p
    );
    await savePlaylists(updated);
  };

  /**
   * handleStartSession — launches CounterScreen for the full playlist.
   * Passes all duaIds in their current order so CounterScreen plays every
   * dua back-to-back as one continuous session.
   */
  const handleStartSession = () => {
    navigation.navigate('Counter', {
      playlist: {
        title: playlist.name,
        duaIds: playlist.duaIds,
        datasetTitles: [], // unused when duaIds is present
      },
    });
  };

  if (!playlist) return null;

  // ── Empty state ─────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={{ alignItems: 'center', marginTop: 60 }}>
      <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
      <Text style={{
        fontSize: theme.typography.body,
        color: theme.colors.subtle,
        textAlign: 'center',
      }}>
        No duas in this playlist yet.{'\n'}Use + Playlist on any dua to add one.
      </Text>
    </View>
  );

  // ── Dua row ─────────────────────────────────────────────────────
  const renderItem = ({ item, index }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: getCardColor(item.ID),
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.between,
      padding: theme.spacing.card,
      overflow: 'hidden',
    }}>

      {/* Move flash overlay — accent tint that fades out after a reorder */}
      {item.ID === flashId && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.colors.accent + '28',
            borderRadius: theme.radius.card,
            opacity: flashOpacity,
          }}
        />
      )}

      {/* ▲/▼ reorder buttons — 44×44 minimum tap area, arrow centred inside */}
      <View style={{ marginRight: 4 }}>
        <TouchableOpacity
          onPress={() => handleMove(index, -1)}
          disabled={index === 0}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{
            fontSize: 13,
            color: index === 0 ? theme.colors.border : theme.colors.subtle,
          }}>▲</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleMove(index, 1)}
          disabled={index === duas.length - 1}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{
            fontSize: 13,
            color: index === duas.length - 1 ? theme.colors.border : theme.colors.subtle,
          }}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Dua content */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: theme.typography.arabic - 4,
            color: theme.colors.text,
            textAlign: 'right',
            lineHeight: 30,
            marginBottom: 6,
          }}
          numberOfLines={2}>
          {item.ARABIC_TEXT}
        </Text>
        <Text
          style={{
            fontSize: theme.typography.small,
            color: theme.colors.subtle,
            lineHeight: 18,
          }}
          numberOfLines={2}>
          {item.TRANSLATED_TEXT}
        </Text>
        {/* Section label */}
        <Text style={{
          fontSize: 10,
          color: theme.colors.accent,
          letterSpacing: 1,
          marginTop: 6,
          fontFamily: 'Courier New',
          textTransform: 'uppercase',
        }}
          numberOfLines={1}>
          {item.sectionTitle}
        </Text>
      </View>

      {/* Remove button */}
      <TouchableOpacity
        onPress={() => handleRemove(item.ID)}
        style={{ padding: 8, marginLeft: 4 }}>
        <Text style={{ fontSize: 18 }}>🗑️</Text>
      </TouchableOpacity>

    </View>
  );

  // ── Main render ─────────────────────────────────────────────────
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.screen,
    }}>
      <FlatList
        data={duas}
        keyExtractor={item => String(item.ID)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={duas.length > 0 ? (
          <TouchableOpacity
            onPress={handleStartSession}
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: theme.radius.button,
              padding: 16,
              alignItems: 'center',
              marginBottom: 20,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}>
            <Text style={{
              color: '#fff',
              fontSize: theme.typography.body,
              letterSpacing: 0.5,
            }}>
              ▶  Start Session
            </Text>
          </TouchableOpacity>
        ) : null}
      />
    </View>
  );
}
