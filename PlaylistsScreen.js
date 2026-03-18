/**
 * PlaylistsScreen.js
 * Purpose: Browse, create, reorder, and delete the user's saved playlists.
 *          Each playlist is persisted via AsyncStorage using playlistStorage.js.
 *          New playlists are created through a bottom-sheet modal with a name
 *          input and type selector (Category / Single / Custom).
 * Dependencies: React Native, @react-navigation, playlistStorage.js, theme.js
 * Context: Navigated to from HomeScreen. Navigates to PlaylistDetailScreen.
 */

import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadPlaylists,
  createPlaylist,
  deletePlaylist,
  savePlaylists,
} from './data/playlistStorage';
import { theme } from './theme';

/**
 * TYPE_BADGE — maps playlist type to the short label shown in the list row badge.
 * Kept short so it fits alongside the dua count without wrapping.
 */
const TYPE_BADGE = {
  category: 'CAT',
  single: 'SINGLE',
  custom: 'CUSTOM',
};

/**
 * CARD_PALETTE — 8 soft, muted background colors for playlist cards.
 * All are light enough that dark text (#2C2C2C) is comfortably readable.
 * Tones are chosen to harmonise with the parchment (#F5F0E8) theme.
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
 * getCardColor — deterministically picks a palette color for a playlist card.
 * The same playlist always gets the same color regardless of its list position.
 * Sums all character codes in the id string so IDs that share a common prefix
 * (e.g. timestamp-based IDs like "1700000001234") still spread across the palette.
 * @param {string} id - playlist id
 * @returns {string} hex color string
 */
const getCardColor = (id) => {
  if (!id) return CARD_PALETTE[0];
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CARD_PALETTE[hash % CARD_PALETTE.length];
};

export default function PlaylistsScreen({ navigation }) {
  const [playlists, setPlaylists] = useState([]);

  // ── Modal state ─────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('custom');

  // ── Reorder flash animation ──────────────────────────────────────
  // ID of the playlist row that should show the move flash overlay
  const [flashId, setFlashId] = useState(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  /**
   * triggerMoveFlash — briefly highlights a row after a move to confirm
   * the action. Fades an accent overlay from visible to invisible in 400ms.
   * @param {string} id - playlist id of the row that just moved
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
   * Reload playlists every time this screen comes into focus.
   * This keeps the list in sync with changes made on PlaylistDetailScreen
   * (e.g., removing duas, which updates the count).
   */
  useFocusEffect(
    useCallback(() => {
      loadPlaylists().then(setPlaylists);
    }, [])
  );

  /**
   * handleCreate — validates name, creates the playlist, appends it to
   * local state, and resets the modal fields.
   * For 'category' type the name is set later by AddDuasScreen (to the
   * chosen category name), so we pass a placeholder here.
   */
  const handleCreate = async () => {
    const isCategory = newType === 'category';
    const name = isCategory ? 'Category' : newName.trim();
    if (!isCategory && !name) return;
    const created = await createPlaylist(name, newType, [], null);
    setPlaylists(prev => [...prev, created]);
    setNewName('');
    setNewType('custom');
    setModalVisible(false);
    // Send the user straight to AddDuasScreen to populate the new playlist
    navigation.navigate('AddDuas', {
      playlistId: created.id,
      playlistName: created.name,
      playlistType: created.type,
    });
  };

  /**
   * handleDelete — shows a native confirmation dialog before removing.
   * Destructive action uses Alert so the user must explicitly confirm.
   * @param {object} playlist - the playlist object to delete
   */
  const handleDelete = (playlist) => {
    Alert.alert(
      `Delete "${playlist.name}"?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(playlist.id);
            setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
          },
        },
      ]
    );
  };

  /**
   * handleMove — shifts a playlist up or down in the displayed order and persists.
   * Think of it like re-arranging books on a shelf — the shelf is then photographed
   * and saved so the order is remembered next time.
   * @param {number} index - current position in the array
   * @param {-1|1} direction - -1 moves up, 1 moves down
   */
  const handleMove = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= playlists.length) return;
    const next = [...playlists];
    [next[index], next[target]] = [next[target], next[index]];
    setPlaylists(next);
    triggerMoveFlash(next[target].id); // highlight the item that moved
    await savePlaylists(next);
  };

  // ── Empty state ───────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 36, marginBottom: 16 }}>📿</Text>
      <Text style={{
        fontSize: theme.typography.body,
        color: theme.colors.subtle,
        textAlign: 'center',
        lineHeight: 26,
      }}>
        No playlists yet —{'\n'}browse Categories to get started
      </Text>
    </View>
  );

  // ── Playlist row ──────────────────────────────────────────────────
  const renderItem = ({ item, index }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: getCardColor(item.id),
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.between,
      padding: theme.spacing.card,
      overflow: 'hidden',
    }}>

      {/* Move flash overlay — fades in on reorder, invisible otherwise */}
      {item.id === flashId && (
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
          disabled={index === playlists.length - 1}
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{
            fontSize: 13,
            color: index === playlists.length - 1 ? theme.colors.border : theme.colors.subtle,
          }}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Main tap area — name + badges */}
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}>
        <Text style={{
          fontSize: theme.typography.body,
          color: theme.colors.text,
          marginBottom: 5,
        }}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Type badge */}
          <View style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: theme.colors.accent + '22',
          }}>
            <Text style={{
              fontSize: 9,
              color: theme.colors.accent,
              letterSpacing: 1,
              fontFamily: 'Courier New',
            }}>
              {TYPE_BADGE[item.type] ?? item.type.toUpperCase()}
            </Text>
          </View>
          {/* Dua count */}
          <Text style={{
            fontSize: theme.typography.small,
            color: theme.colors.subtle,
          }}>
            {item.duaIds.length} {item.duaIds.length === 1 ? 'section' : 'sections'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Delete button */}
      <TouchableOpacity
        onPress={() => handleDelete(item)}
        style={{ padding: 8 }}>
        <Text style={{ fontSize: 18 }}>🗑️</Text>
      </TouchableOpacity>

    </View>
  );

  // ── Main render ───────────────────────────────────────────────────
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.screen,
    }}>

      {/* Header row — title + New button */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 24,
      }}>
        <Text style={{
          fontSize: theme.typography.heading,
          color: theme.colors.text,
          letterSpacing: 1,
        }}>
          My Playlists
        </Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.button,
          }}>
          <Text style={{
            fontSize: theme.typography.small,
            color: '#fff',
            letterSpacing: 1,
            fontFamily: 'Courier New',
          }}>
            + NEW
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      {/* ── New Playlist Modal (bottom sheet) ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        {/**
         * KeyboardAvoidingView is the outermost wrapper so it can push
         * the sheet up on both iOS (padding) and Android (height).
         * The flex:1 + justifyContent:'flex-end' alignment sits inside it.
         */}
        {/**
         * iOS: KAV behavior='padding' nudges the sheet up by the keyboard height.
         * Android: behavior={undefined} — let the system's windowSoftInputMode
         * handle it natively. Fighting Android with behavior='height' caused
         * the sheet to flicker up/down when the keyboard dismissed.
         */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => { setModalVisible(false); setNewName(''); }}
          />
          {/**
           * ScrollView with keyboardShouldPersistTaps="handled" ensures that
           * tapping the type buttons or confirm button while the keyboard is
           * open registers the tap instead of just dismissing the keyboard.
           */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            contentContainerStyle={{
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 28,
              paddingBottom: 48,
            }}
          >

              <Text style={{
                fontSize: theme.typography.heading,
                color: theme.colors.text,
                marginBottom: 20,
              }}>
                New Playlist
              </Text>

              {/**
               * Name input — hidden for 'category' type because AddDuasScreen
               * will overwrite the name with the chosen category name on save.
               */}
              {newType !== 'category' && (
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Playlist name..."
                  placeholderTextColor={theme.colors.subtle}
                  style={{
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.button,
                    padding: 14,
                    fontSize: theme.typography.body,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    marginBottom: 20,
                  }}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
              )}

              {/* Type selector */}
              <Text style={{
                fontSize: theme.typography.small,
                color: theme.colors.subtle,
                letterSpacing: 2,
                marginBottom: 10,
                fontFamily: 'Courier New',
              }}>
                TYPE
              </Text>
              <View style={{
                flexDirection: 'row',
                gap: 10,
                marginBottom: 24,
              }}>
                {['category', 'single', 'custom'].map(type => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setNewType(type)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: theme.radius.button,
                      borderWidth: 1,
                      borderColor: newType === type
                        ? theme.colors.accent
                        : theme.colors.border,
                      backgroundColor: newType === type
                        ? theme.colors.accent + '18'
                        : 'transparent',
                      alignItems: 'center',
                    }}>
                    <Text style={{
                      fontSize: 11,
                      color: newType === type
                        ? theme.colors.accent
                        : theme.colors.subtle,
                      letterSpacing: 1,
                      fontFamily: 'Courier New',
                      textTransform: 'uppercase',
                    }}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Confirm button — always enabled for category; requires name for single/custom */}
              <TouchableOpacity
                onPress={handleCreate}
                disabled={newType !== 'category' && !newName.trim()}
                style={{
                  backgroundColor: (newType === 'category' || newName.trim())
                    ? theme.colors.accent
                    : theme.colors.border,
                  borderRadius: theme.radius.button,
                  padding: 16,
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                <Text style={{ color: '#fff', fontSize: theme.typography.body }}>
                  Create Playlist
                </Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => { setModalVisible(false); setNewName(''); }}
                style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{
                  color: theme.colors.subtle,
                  fontSize: theme.typography.body,
                }}>
                  Cancel
                </Text>
              </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
