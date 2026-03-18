/**
 * screens/AddDuasScreen.js
 * Purpose: Picker for building or editing a playlist's dua content.
 *          Behaviour varies by playlist type:
 *
 *          'category' — flat grid of the 11 category cards; single-select only.
 *            On Save the playlist's duaIds AND name are replaced with the
 *            chosen category's data (e.g. name → "Travel", duaIds → [...]).
 *
 *          'single'   — accordion picker; only one dua checkbox may be checked.
 *            Toast shown if user tries to add a second dua.
 *
 *          'custom'   — accordion picker; unlimited multi-select across all
 *            categories. Existing behaviour preserved.
 *
 *          All types: pre-check already-saved duas (edit flow), intercept back
 *          navigation when there are unsaved changes, SAVE header button.
 *
 * Dependencies: React Native, husn_en.json, data/categories.js,
 *               data/playlistStorage.js, theme.js
 * Context: Navigated to from PlaylistsScreen (after create) and from
 *          PlaylistDetailScreen (Edit Duas header button).
 *          Receives: { playlistId, playlistName, playlistType }
 *          Navigates back on Save or Discard.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import data from '../husn_en.json';
import { CATEGORIES } from '../data/categories';
import { loadPlaylists, updatePlaylist } from '../data/playlistStorage';
import { theme } from '../theme';

/**
 * groupIndex — module-level lookup: group ID → { title, verseCount }.
 * Built once so every render doesn't re-scan the 284-entry dataset.
 * Think of it like a card catalogue: look up any group by its ID instantly.
 */
const groupIndex = Object.fromEntries(
  data.English.map(g => [Number(g.ID), {
    title: g.TITLE,
    verseCount: g.TEXT.length,
  }])
);

export default function AddDuasScreen({ route, navigation }) {
  const { playlistId, playlistName, playlistType } = route.params;

  // ── State ────────────────────────────────────────────────────────

  /**
   * selectedIds — live multi-dua selection for 'single' and 'custom' types.
   * Stored as Set<number> for O(1) toggle / membership checks.
   */
  const [initialIds, setInitialIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());

  /**
   * selectedCatId — the chosen category id string for 'category' type.
   * Only one category may be selected at a time.
   */
  const [initialCatId, setInitialCatId] = useState(null);
  const [selectedCatId, setSelectedCatId] = useState(null);

  /** Set of category IDs (strings) whose accordion rows are currently open. */
  const [expandedCats, setExpandedCats] = useState(new Set());

  /** Toast message — null when hidden. */
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  /**
   * Ref that always holds the latest handleSave function.
   * Needed so the header button (wired up via setOptions) never captures
   * a stale closure over selectedIds / selectedCatId.
   */
  const handleSaveRef = useRef(null);

  /**
   * isSaving — set to true immediately before navigation.goBack() in handleSave.
   * The beforeRemove listener checks this flag so it does not show the discard
   * dialog when the navigation was triggered by the user tapping Save rather than
   * pressing the hardware/gesture back button.
   * Using a ref avoids an extra render cycle.
   */
  const isSaving = useRef(false);

  // ── Load existing playlist state on mount ───────────────────────
  useEffect(() => {
    loadPlaylists().then(all => {
      const pl = all.find(p => p.id === playlistId);
      if (!pl) return;

      if (playlistType === 'category') {
        // Try to find which CATEGORIES entry matches the saved duaIds
        const savedNums = pl.duaIds.map(Number);
        const matchingCat = CATEGORIES.find(cat =>
          cat.duaIds.length === savedNums.length &&
          cat.duaIds.every(id => savedNums.includes(Number(id)))
        );
        if (matchingCat) {
          setSelectedCatId(matchingCat.id);
          setInitialCatId(matchingCat.id);
        }
      } else {
        if (pl.duaIds.length > 0) {
          const ids = new Set(pl.duaIds.map(Number));
          setInitialIds(ids);
          setSelectedIds(new Set(ids));
        }
      }
    });
  }, [playlistId]);

  // ── isDirty — true if the selection differs from the loaded state ─
  const isDirty = playlistType === 'category'
    ? selectedCatId !== initialCatId
    : !(
        initialIds.size === selectedIds.size &&
        [...initialIds].every(id => selectedIds.has(id))
      );

  // ── Update header title + Save button whenever selection changes ─
  useEffect(() => {
    const isSaveable = playlistType === 'category'
      ? selectedCatId !== null
      : true; // single/custom: saving 0 duas is permitted

    const countLabel = playlistType === 'category'
      ? (selectedCatId ? '1 selected' : '0 selected')
      : `${selectedIds.size} selected`;

    navigation.setOptions({
      title: `${playlistName} · ${countLabel}`,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => handleSaveRef.current?.()}
          disabled={!isSaveable}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            backgroundColor: isSaveable ? theme.colors.accent : theme.colors.border,
            borderRadius: theme.radius.button,
            marginRight: 4,
          }}>
          <Text style={{
            color: '#fff',
            fontSize: theme.typography.small,
            letterSpacing: 0.5,
            fontFamily: 'Courier New',
          }}>
            SAVE
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [selectedIds, selectedCatId]);

  // ── Intercept back when there are unsaved changes ────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Allow navigation triggered by handleSave to pass through uninterrupted.
      if (isSaving.current) return;
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes that will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  // ── Toast helpers ────────────────────────────────────────────────
  const showToast = (message) => {
    setToast(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // ── Save ─────────────────────────────────────────────────────────
  /**
   * handleSave — persists the selection, marks state clean, goes back.
   *
   * 'category': overwrites both duaIds and name with the chosen category data.
   * 'single'/'custom': persists the checked duaIds only.
   */
  const handleSave = async () => {
    try {
      if (playlistType === 'category') {
        const cat = CATEGORIES.find(c => c.id === selectedCatId);
        if (!cat) return;
        await updatePlaylist(playlistId, {
          duaIds: cat.duaIds.map(Number),
          name: cat.name,
        });
        setInitialCatId(selectedCatId);
      } else {
        await updatePlaylist(playlistId, { duaIds: [...selectedIds].map(Number) });
        setInitialIds(new Set(selectedIds));
      }
      // Flag must be set before goBack() — beforeRemove fires synchronously
      // during the navigation call, before any state updates are processed.
      isSaving.current = true;
      navigation.goBack();
    } catch (err) {
      // Storage failed — reset flag so the dirty guard stays active
      isSaving.current = false;
      console.error('[AddDuasScreen] save failed:', err);
    }
  };
  handleSaveRef.current = handleSave;

  // ── Toggle helpers (single / custom) ────────────────────────────
  /**
   * toggleDua — checks or unchecks one group ID.
   * Enforces the 1-item cap for 'single' type playlists.
   * @param {number} groupId
   */
  const toggleDua = (groupId) => {
    const numId = Number(groupId);
    if (selectedIds.has(numId)) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(numId);
        return next;
      });
    } else {
      if (playlistType === 'single' && selectedIds.size >= 1) {
        showToast('Single dua playlists can only contain one dua');
        return;
      }
      setSelectedIds(prev => new Set([...prev, numId]));
    }
  };

  /**
   * toggleCat — opens or closes a category accordion row.
   * @param {string} catId
   */
  const toggleCat = (catId) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // ── Render helpers ───────────────────────────────────────────────

  /**
   * renderCategoryGrid — shown for 'category' type.
   * Flat 2-column grid of all 11 categories; single-select.
   * Tapping a selected card deselects it (toggle).
   */
  const renderCategoryGrid = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: theme.spacing.screen,
        gap: 12,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {CATEGORIES.map(cat => {
        const isSelected = selectedCatId === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedCatId(isSelected ? null : cat.id)}
            activeOpacity={0.75}
            style={{
              // Two columns with gap: each card is slightly under half width
              width: '47%',
              padding: 16,
              borderRadius: theme.radius.card,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? theme.colors.accent : theme.colors.border,
              backgroundColor: isSelected
                ? theme.colors.accent + '18'
                : theme.colors.card,
            }}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>{cat.emoji}</Text>
            <Text style={{
              fontSize: theme.typography.small,
              color: isSelected ? theme.colors.text : theme.colors.subtle,
              fontWeight: isSelected ? '600' : '400',
              lineHeight: 20,
            }}>
              {cat.name}
            </Text>
            <Text style={{
              fontSize: 10,
              color: isSelected ? theme.colors.accent : theme.colors.subtle,
              letterSpacing: 1,
              fontFamily: 'Courier New',
              marginTop: 4,
            }}>
              {cat.duaIds.length} DUAS
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  /**
   * renderAccordion — shown for 'single' and 'custom' types.
   * Collapsible categories with individual dua checkboxes.
   */
  const renderAccordion = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {CATEGORIES.map(cat => {
        const isExpanded = expandedCats.has(cat.id);
        const catSelectedCount = cat.duaIds.filter(
          id => selectedIds.has(Number(id))
        ).length;

        return (
          <View key={cat.id}>

            {/* ── Category accordion header ── */}
            <TouchableOpacity
              onPress={() => toggleCat(cat.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: theme.spacing.screen,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
                backgroundColor: isExpanded
                  ? theme.colors.card
                  : theme.colors.background,
              }}>

              {/* Emoji */}
              <Text style={{ fontSize: 22, marginRight: 12 }}>{cat.emoji}</Text>

              {/* Name + sub-label */}
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: theme.typography.body,
                  color: theme.colors.text,
                  fontWeight: '500',
                }}>
                  {cat.name}
                </Text>
                <Text style={{
                  fontSize: 10,
                  color: catSelectedCount > 0
                    ? theme.colors.accent
                    : theme.colors.subtle,
                  letterSpacing: 1,
                  fontFamily: 'Courier New',
                  marginTop: 2,
                }}>
                  {cat.duaIds.length} DUAS
                  {catSelectedCount > 0 ? `  ·  ${catSelectedCount} SELECTED` : ''}
                </Text>
              </View>

              {/* Chevron */}
              <Text style={{
                fontSize: 11,
                color: theme.colors.subtle,
                marginLeft: 8,
              }}>
                {isExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {/* ── Dua rows (visible when expanded) ── */}
            {isExpanded && cat.duaIds.map(groupId => {
              const numId = Number(groupId);
              const group = groupIndex[numId];
              if (!group) return null;
              const isChecked = selectedIds.has(numId);

              return (
                <TouchableOpacity
                  key={numId}
                  onPress={() => toggleDua(numId)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 13,
                    paddingLeft: theme.spacing.screen + 34, // indent past emoji
                    paddingRight: theme.spacing.screen,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                    backgroundColor: isChecked
                      ? theme.colors.accent + '0C'
                      : theme.colors.card,
                  }}>

                  {/* Checkbox */}
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: isChecked
                      ? theme.colors.accent
                      : theme.colors.border,
                    backgroundColor: isChecked
                      ? theme.colors.accent
                      : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    flexShrink: 0,
                  }}>
                    {isChecked && (
                      <Text style={{
                        color: '#fff',
                        fontSize: 13,
                        lineHeight: 16,
                        fontWeight: 'bold',
                      }}>
                        ✓
                      </Text>
                    )}
                  </View>

                  {/* Dua title */}
                  <Text
                    style={{
                      flex: 1,
                      fontSize: theme.typography.small,
                      color: isChecked ? theme.colors.text : theme.colors.subtle,
                      lineHeight: 20,
                    }}
                    numberOfLines={2}>
                    {group.title}
                  </Text>

                  {/* Verse count badge */}
                  <Text style={{
                    fontSize: 10,
                    color: theme.colors.subtle,
                    letterSpacing: 1,
                    fontFamily: 'Courier New',
                    marginLeft: 10,
                    flexShrink: 0,
                  }}>
                    {group.verseCount}V
                  </Text>

                </TouchableOpacity>
              );
            })}

          </View>
        );
      })}
    </ScrollView>
  );

  // ── Main render ──────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {playlistType === 'category'
        ? renderCategoryGrid()
        : renderAccordion()
      }

      {/* ── Toast notification ── */}
      {toast && (
        <Animated.View style={{
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
