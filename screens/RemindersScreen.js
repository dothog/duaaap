/**
 * screens/RemindersScreen.js
 * Purpose: Full Salah reminder configuration screen.
 *
 *   Top section — location inputs (city, country) + "Fetch Prayer Times" button.
 *     On success: displays today's five prayer times and persists city/country.
 *     On failure: shows an inline error message.
 *
 *   Prayer cards (one per prayer) — each contains:
 *     • Toggle switch (enable / disable this reminder)
 *     • Prayer name + fetched time, e.g. "Fajr — 05:23" (or "—" until fetched)
 *     • Offset picker: segmented control with 0 / 5 / 10 / 15 min options
 *     • Playlist picker: opens a modal listing all saved playlists
 *     • Custom Notifications expandable section: add extra notification entries,
 *       each linked to its own playlist
 *     • "Test" button: fires an immediate notification to verify the deep link
 *
 *   "Save All" button fixed at the bottom — persists settings and schedules
 *   (or cancels/reschedules) all notifications via scheduleAllNotifications().
 *   Shows a "Reminders saved" toast on success.
 *
 * Dependencies: React Native, expo-notifications, data/remindersStorage.js,
 *               data/prayerTimesService.js, data/playlistStorage.js, theme.js
 * Context: Navigated to from HomeScreen via 'Reminder' route name.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { loadPlaylists } from '../data/playlistStorage';
import {
  loadReminders,
  saveReminders,
  scheduleAllNotifications,
  loadCustomReminders,
  saveCustomReminder,
  deleteCustomReminder,
  scheduleCustomNotifications,
  PRAYER_NAMES,
} from '../data/remindersStorage';
import {
  fetchPrayerTimes,
  getTodaysPrayerTimes,
} from '../data/prayerTimesService';
import { theme } from '../theme';

/** Offset options shown in the segmented control. */
const OFFSET_OPTIONS = [0, 5, 10, 15];

/** Day abbreviations for the weekly day-picker (0=Sun … 6=Sat). */
const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * BLANK_DRAFT — factory default for a new custom reminder modal.
 * Copied fresh whenever the user opens "+ Add".
 */
const BLANK_DRAFT = {
  id:               null,
  label:            '',
  scheduleType:     'prayer',   // 'prayer' | 'exact'
  anchorPrayer:     'Fajr',
  anchorOffset:     0,
  anchorDirection:  'after',    // 'after' | 'before'
  exactTime:        '06:00',
  repeatType:       'daily',    // 'daily' | 'weekly' | 'once'
  repeatDays:       [0,1,2,3,4,5,6],
  playlistId:       null,
  enabled:          true,
};

/**
 * scheduleSummary — produces a human-readable one-liner for a custom reminder
 * card, e.g. "30 min after Fajr · Daily" or "06:00 · Mon Wed Fri".
 * @param {object} reminder
 * @returns {string}
 */
const scheduleSummary = (reminder) => {
  let timePart = '';
  if (reminder.scheduleType === 'prayer') {
    const offset = reminder.anchorOffset ?? 0;
    timePart = offset === 0
      ? `At ${reminder.anchorPrayer}`
      : `${offset} min ${reminder.anchorDirection} ${reminder.anchorPrayer}`;
  } else if (reminder.scheduleType === 'exact') {
    timePart = reminder.exactTime || '—';
  }

  let repeatPart = '';
  if (reminder.repeatType === 'daily')       repeatPart = 'Daily';
  else if (reminder.repeatType === 'once')   repeatPart = 'Once';
  else repeatPart = (reminder.repeatDays ?? []).map(d => DAY_ABBR[d]).join(' ');

  return `${timePart} · ${repeatPart}`;
};


/**
 * searchCities — queries the Nominatim OpenStreetMap API for cities matching
 * the given query and returns up to 5 formatted suggestions.
 * Throws on network error so callers can distinguish failure from empty results.
 *
 * Nominatim policy requires a User-Agent header identifying the app.
 *
 * @param {string} query - partial city name typed by the user
 * @returns {Promise<Array<{ city: string, country: string, label: string }>>}
 */
const searchCities = async (query) => {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&featuretype=city&limit=5&format=json&addressdetails=1`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'DuaApp/1.0' } });
  if (!resp.ok) throw new Error(`Nominatim HTTP ${resp.status}`);
  const json = await resp.json();
  return json
    .filter(item => item.address?.country)
    .map(item => {
      const addr    = item.address ?? {};
      const cityName =
        addr.city || addr.town || addr.village ||
        addr.municipality || addr.county ||
        item.display_name.split(',')[0].trim();
      return {
        city:    cityName,
        country: addr.country,
        label:   `${cityName}, ${addr.country}`,
      };
    });
};

export default function RemindersScreen() {
  // ── Location inputs (set when user picks a suggestion or uses fallback) ──
  const [city, setCity]       = useState('');
  const [country, setCountry] = useState('');

  // ── City autocomplete ─────────────────────────────────────────────
  // locationQuery — text in the search box (display only).
  // suggestions   — array of { city, country, label } from Nominatim.
  // showDropdown  — controls dropdown visibility.
  // isSearching   — spinner while debounce is pending or fetch is in flight.
  // searchError   — true after a network failure; triggers the two-field fallback.
  const [locationQuery, setLocationQuery] = useState('');
  const [suggestions, setSuggestions]     = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [isSearching, setIsSearching]     = useState(false);
  const [searchError, setSearchError]     = useState(false);
  const debounceRef = useRef(null);

  // ── Prayer times (null until first successful fetch) ─────────────
  const [prayerTimes, setPrayerTimes] = useState(null);

  // ── Reminder settings (null until loaded from storage) ───────────
  const [reminders, setReminders] = useState(null);

  // ── Playlists for the picker ─────────────────────────────────────
  const [playlists, setPlaylists] = useState([]);

  // ── Fetch state ──────────────────────────────────────────────────
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // ── Playlist picker modal ────────────────────────────────────────
  const [pickerVisible, setPickerVisible]   = useState(false);
  /**
   * pickerTarget — identifies which field is being edited.
   * { prayerName: string, field: 'main' | number }
   * 'main' → the prayer's primary playlist
   *  number → index in customNotifications array
   */
  const [pickerTarget, setPickerTarget] = useState(null);

  // ── Custom reminders list ─────────────────────────────────────────
  const [customReminders, setCustomReminders] = useState([]);

  // ── Custom reminder modal ─────────────────────────────────────────
  const [customModalVisible, setCustomModalVisible] = useState(false);
  // customDraft — working copy of the reminder being created / edited.
  const [customDraft, setCustomDraft] = useState({ ...BLANK_DRAFT });
  // (no native time picker — see the inline HH / MM TextInput pair below)

  // ── Toast ────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // ── Load settings + cached prayer times on mount ─────────────────
  useEffect(() => {
    (async () => {
      const [saved, pl, times, customs] = await Promise.all([
        loadReminders(),
        loadPlaylists(),
        getTodaysPrayerTimes(),
        loadCustomReminders(),
      ]);
      setReminders(saved);
      setCity(saved.city ?? '');
      setCountry(saved.country ?? '');
      if (saved.city && saved.country) {
        setLocationQuery(`${saved.city}, ${saved.country}`);
      }
      setPlaylists(pl);
      if (times) setPrayerTimes(times);
      setCustomReminders(customs);
    })();
  }, []);

  // Refresh playlist list whenever the screen gains focus (user may have
  // created / deleted playlists on other screens).
  useFocusEffect(
    useCallback(() => {
      loadPlaylists().then(setPlaylists);
    }, [])
  );

  // ── Toast helpers ────────────────────────────────────────────────
  const showToast = (message) => {
    setToast(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // Cancel any in-flight debounce timer when the screen unmounts
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ── Autocomplete handlers ────────────────────────────────────────

  /**
   * handleLocationQuery — updates the display text and, after a 500ms debounce,
   * calls searchCities(). On network error sets searchError = true and shows
   * the plain two-field fallback. Clears committed city/country on every keystroke.
   * @param {string} text
   */
  const handleLocationQuery = (text) => {
    setLocationQuery(text);
    setCity('');
    setCountry('');
    setShowDropdown(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchCities(text.trim());
        setSuggestions(results);
        setShowDropdown(true);
      } catch {
        // Network unavailable — reveal the plain two-field fallback
        setSearchError(true);
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  /**
   * handleSuggestionTap — commits the chosen city/country into state,
   * fills the display field, and closes the dropdown.
   * @param {{ city: string, country: string, label: string }} suggestion
   */
  const handleSuggestionTap = (suggestion) => {
    setCity(suggestion.city);
    setCountry(suggestion.country);
    setLocationQuery(suggestion.label);
    setSuggestions([]);
    setShowDropdown(false);
  };

  /**
   * clearLocation — resets the search field and all autocomplete state.
   */
  const clearLocation = () => {
    setLocationQuery('');
    setCity('');
    setCountry('');
    setSuggestions([]);
    setShowDropdown(false);
    setIsSearching(false);
    setSearchError(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // ── Custom reminder handlers ─────────────────────────────────────

  /** openAddCustom — opens the modal in "new reminder" mode. */
  const openAddCustom = () => {
    setCustomDraft({ ...BLANK_DRAFT });
    setCustomModalVisible(true);
  };

  /**
   * openEditCustom — opens the modal pre-filled with an existing reminder.
   * @param {object} reminder
   */
  const openEditCustom = (reminder) => {
    setCustomDraft({ ...reminder });
    setCustomModalVisible(true);
  };

  /**
   * handleSaveCustom — upserts the current draft and updates local state.
   * Requires a non-empty label; silently returns if the label is blank.
   */
  const handleSaveCustom = async () => {
    if (!customDraft.label.trim()) return;
    const saved = await saveCustomReminder(customDraft);
    setCustomReminders(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      return idx >= 0
        ? prev.map(r => r.id === saved.id ? saved : r)
        : [...prev, saved];
    });
    setCustomModalVisible(false);
  };

  /**
   * handleDeleteCustom — removes a custom reminder by id.
   * @param {string} id
   */
  const handleDeleteCustom = async (id) => {
    await deleteCustomReminder(id);
    setCustomReminders(prev => prev.filter(r => r.id !== id));
  };

  /**
   * toggleCustomEnabled — flips the enabled flag for a saved custom reminder
   * and persists the change immediately without requiring "Save All".
   * @param {string}  id
   * @param {boolean} enabled
   */
  const toggleCustomEnabled = async (id, enabled) => {
    const updated = customReminders.map(r => r.id === id ? { ...r, enabled } : r);
    setCustomReminders(updated);
    const reminder = updated.find(r => r.id === id);
    if (reminder) await saveCustomReminder(reminder);
  };

  /**
   * handleTestCustom — fires an immediate test notification using the
   * current draft state so the user can verify the deep link before saving.
   */
  const handleTestCustom = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: customDraft.label || 'Time for Dhikr 🤲',
        body:  customDraft.playlistId ? 'Tap to open your playlist' : 'Time to recite',
        data:  { playlistId: customDraft.playlistId ?? null },
      },
      trigger: null, // immediate
    });
    showToast('Test notification sent');
  };

  /**
   * openCustomDraftPicker — opens the playlist picker targeted at the draft's
   * playlistId field (separate from the prayer-card picker path).
   */
  const openCustomDraftPicker = () => {
    setPickerTarget({ type: 'customDraft' });
    setPickerVisible(true);
  };

  // ── Fetch prayer times ───────────────────────────────────────────
  /**
   * handleFetch — calls fetchPrayerTimes with the current city/country inputs,
   * updates state, and persists the city/country into the reminder settings.
   */
  const handleFetch = async () => {
    if (!city.trim() || !country.trim()) return;
    setIsFetching(true);
    setFetchError(null);
    try {
      const times = await fetchPrayerTimes(city.trim(), country.trim());
      setPrayerTimes(times);
      // Persist city/country so they pre-fill on next launch
      setReminders(prev => ({ ...prev, city: city.trim(), country: country.trim() }));
    } catch {
      setFetchError('City not found — check spelling and try again');
    } finally {
      setIsFetching(false);
    }
  };

  // ── Reminder state mutations ─────────────────────────────────────

  /**
   * updatePrayer — immutably updates a single prayer's fields.
   * @param {string} prayerName
   * @param {object} updates - partial prayer fields to merge
   */
  const updatePrayer = (prayerName, updates) => {
    setReminders(prev => ({
      ...prev,
      prayers: {
        ...prev.prayers,
        [prayerName]: { ...prev.prayers[prayerName], ...updates },
      },
    }));
  };

  // ── Playlist picker ──────────────────────────────────────────────

  /**
   * openPicker — records which field is being edited and opens the picker modal.
   * @param {string} prayerName
   * @param {'main' | number} field
   */
  const openPicker = (prayerName, field) => {
    setPickerTarget({ prayerName, field });
    setPickerVisible(true);
  };

  /**
   * handlePickerSelect — applies the chosen playlistId to the target field.
   * Handles three target types:
   *   { type: 'customDraft' }          → updates the custom reminder draft
   *   { prayerName, field: 'main' }    → prayer card primary playlist
   *   { prayerName, field: number }    → prayer card custom notification entry
   * @param {string | null} playlistId - null means "No playlist"
   */
  const handlePickerSelect = (playlistId) => {
    if (!pickerTarget) return;

    // Custom reminder draft
    if (pickerTarget.type === 'customDraft') {
      setCustomDraft(prev => ({ ...prev, playlistId }));
      setPickerVisible(false);
      setPickerTarget(null);
      return;
    }

    const { prayerName, field } = pickerTarget;
    if (field === 'main') {
      updatePrayer(prayerName, { playlistId });
    } else {
      const prayer = reminders.prayers[prayerName];
      const updated = prayer.customNotifications.map((c, i) =>
        i === field ? { ...c, playlistId } : c
      );
      updatePrayer(prayerName, { customNotifications: updated });
    }

    setPickerVisible(false);
    setPickerTarget(null);
  };

  // ── Test notification ────────────────────────────────────────────

  /**
   * handleTest — fires an immediate notification for a prayer so the user
   * can verify that the deep link navigates to the correct playlist.
   * @param {string} prayerName
   */
  const handleTest = async (prayerName) => {
    const prayer = reminders.prayers[prayerName];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time for ${prayerName} 🕌`,
        body:  'Tap to open your playlist',
        data:  { playlistId: prayer.playlistId ?? null, prayerName },
      },
      trigger: null, // null trigger = fire immediately
    });
    showToast(`Test notification sent for ${prayerName}`);
  };

  // ── Save all ─────────────────────────────────────────────────────

  /**
   * handleSaveAll — persists the current settings and reschedules all
   * enabled notifications from scratch.
   */
  const handleSaveAll = async () => {
    const updated = { ...reminders, city: city.trim(), country: country.trim() };
    await saveReminders(updated);
    if (prayerTimes) {
      // Pass customReminders so scheduleAllNotifications handles both types
      await scheduleAllNotifications(updated, prayerTimes, playlists, customReminders);
    }
    showToast('Reminders saved');
  };

  // ── Render helpers ───────────────────────────────────────────────

  /**
   * playlistLabel — returns the display name for a playlistId, or a fallback.
   * @param {string | null} playlistId
   * @returns {string}
   */
  const playlistLabel = (playlistId) => {
    if (!playlistId) return 'No playlist';
    return playlists.find(p => p.id === playlistId)?.name ?? 'Unknown playlist';
  };

  /**
   * renderPrayerCard — full settings card for one of the five prayers.
   * @param {string} prayerName
   */
  const renderPrayerCard = (prayerName) => {
    if (!reminders) return null;
    const prayer  = reminders.prayers[prayerName];
    const timeStr = prayerTimes?.[prayerName] ?? '—';

    return (
      <View
        key={prayerName}
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: theme.spacing.between,
          overflow: 'hidden',
        }}
      >
        {/* ── Card header: toggle + name + time ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: theme.spacing.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}>
          <Switch
            value={prayer.enabled}
            onValueChange={(v) => updatePrayer(prayerName, { enabled: v })}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent + '88' }}
            thumbColor={prayer.enabled ? theme.colors.accent : theme.colors.subtle}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{
              fontSize: theme.typography.body,
              color: prayer.enabled ? theme.colors.text : theme.colors.subtle,
              fontWeight: prayer.enabled ? '600' : '400',
            }}>
              {prayerName}
            </Text>
            <Text style={{
              fontSize: theme.typography.small,
              color: theme.colors.subtle,
              marginTop: 2,
              fontFamily: 'Courier New',
              letterSpacing: 1,
            }}>
              {timeStr}
            </Text>
          </View>
        </View>

        <View style={{ padding: theme.spacing.card, gap: 16 }}>

          {/* ── Offset picker ── */}
          <View>
            <Text style={labelStyle}>NOTIFY BEFORE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {OFFSET_OPTIONS.map(opt => {
                const active = prayer.offsetMinutes === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => updatePrayer(prayerName, { offsetMinutes: opt })}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: theme.radius.button,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                      backgroundColor: active ? theme.colors.accent + '18' : 'transparent',
                      alignItems: 'center',
                    }}>
                    <Text style={{
                      fontSize: theme.typography.small,
                      color: active ? theme.colors.accent : theme.colors.subtle,
                      fontFamily: 'Courier New',
                      letterSpacing: 0.5,
                    }}>
                      {opt === 0 ? 'ON TIME' : `${opt} MIN`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Playlist picker ── */}
          <View>
            <Text style={labelStyle}>PLAYLIST</Text>
            <TouchableOpacity
              onPress={() => openPicker(prayerName, 'main')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.button,
                padding: 12,
                backgroundColor: theme.colors.background,
              }}>
              <Text style={{
                fontSize: theme.typography.small,
                color: prayer.playlistId ? theme.colors.text : theme.colors.subtle,
              }}>
                {playlistLabel(prayer.playlistId)}
              </Text>
              <Text style={{ fontSize: 10, color: theme.colors.subtle }}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* ── Test button ── */}
          <View style={{ alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => handleTest(prayerName)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: theme.radius.button,
                borderWidth: 1,
                borderColor: theme.colors.accent,
                backgroundColor: theme.colors.accent + '10',
              }}>
              <Text style={{
                fontSize: theme.typography.small,
                color: theme.colors.accent,
                letterSpacing: 0.5,
                fontFamily: 'Courier New',
              }}>
                TEST
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    );
  };

  /**
   * renderCustomRemindersSection — the list of saved custom reminder cards
   * plus the "+ Add" header button. Positioned between the prayer times
   * strip and the five prayer cards.
   */
  const renderCustomRemindersSection = () => (
    <View style={{ marginBottom: 24 }}>

      {/* Section header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <Text style={labelStyle}>CUSTOM REMINDERS</Text>
        <TouchableOpacity
          onPress={openAddCustom}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.accent,
            backgroundColor: theme.colors.accent + '10',
          }}>
          <Text style={{
            fontSize: theme.typography.small,
            color: theme.colors.accent,
            letterSpacing: 0.5,
          }}>
            + Add
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reminder cards */}
      {customReminders.length === 0 ? (
        <Text style={{
          fontSize: theme.typography.small,
          color: theme.colors.subtle,
          fontStyle: 'italic',
          paddingVertical: 4,
        }}>
          No custom reminders yet — tap + Add to create one.
        </Text>
      ) : (
        customReminders.map(reminder => (
          <TouchableOpacity
            key={reminder.id}
            onPress={() => openEditCustom(reminder)}
            activeOpacity={0.7}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              marginBottom: theme.spacing.between,
              padding: theme.spacing.card,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}>
            <Switch
              value={reminder.enabled}
              onValueChange={v => toggleCustomEnabled(reminder.id, v)}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent + '88' }}
              thumbColor={reminder.enabled ? theme.colors.accent : theme.colors.subtle}
            />
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: theme.typography.body,
                color: reminder.enabled ? theme.colors.text : theme.colors.subtle,
                fontWeight: reminder.enabled ? '600' : '400',
              }}>
                {reminder.label || '(untitled)'}
              </Text>
              <Text style={{
                fontSize: theme.typography.small,
                color: theme.colors.subtle,
                marginTop: 2,
              }}>
                {scheduleSummary(reminder)}
              </Text>
              {reminder.playlistId && (
                <Text style={{
                  fontSize: theme.typography.small,
                  color: theme.colors.accent,
                  marginTop: 2,
                }}>
                  {playlistLabel(reminder.playlistId)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteCustom(reminder.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 4 }}>
              <Text style={{ fontSize: 16 }}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  /**
   * renderCustomReminderModal — full add/edit modal for a single custom reminder.
   * Fields: label, schedule type, prayer anchor, exact time, repeat, playlists.
   */
  const renderCustomReminderModal = () => {
    const d = customDraft;
    const showPrayer = d.scheduleType === 'prayer';
    const showExact  = d.scheduleType === 'exact';

    return (
      <Modal
        visible={customModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Backdrop */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            activeOpacity={1}
            onPress={() => setCustomModalVisible(false)}
          />

          {/* Sheet */}
          <View style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '88%',
          }}>

            {/* Modal header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: theme.spacing.screen,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
              <Text style={{
                fontSize: theme.typography.body,
                color: theme.colors.text,
                fontWeight: '600',
              }}>
                {d.id ? 'Edit Reminder' : 'New Custom Reminder'}
              </Text>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)}>
                <Text style={{ fontSize: 20, color: theme.colors.subtle }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.screen, paddingBottom: 32, gap: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>

              {/* ── Label ── */}
              <View>
                <Text style={labelStyle}>LABEL</Text>
                <TextInput
                  value={d.label}
                  onChangeText={text => setCustomDraft(prev => ({ ...prev, label: text }))}
                  placeholder="e.g. Morning Recitation"
                  placeholderTextColor={theme.colors.subtle}
                  style={inputStyle}
                  autoCorrect={false}
                />
              </View>

              {/* ── Schedule type ── */}
              <View>
                <Text style={labelStyle}>SCHEDULE TYPE</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { value: 'prayer', label: 'Prayer Anchor' },
                    { value: 'exact',  label: 'Exact Time' },
                  ].map(opt => {
                    const active = d.scheduleType === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setCustomDraft(prev => ({ ...prev, scheduleType: opt.value }))}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: theme.radius.button,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.accent : theme.colors.border,
                          backgroundColor: active ? theme.colors.accent + '18' : 'transparent',
                          alignItems: 'center',
                        }}>
                        <Text style={{
                          fontSize: 10,
                          color: active ? theme.colors.accent : theme.colors.subtle,
                          fontFamily: 'Courier New',
                          letterSpacing: 0.3,
                          textAlign: 'center',
                        }}>
                          {opt.label.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Prayer anchor ── */}
              {showPrayer && (
                <View style={{ gap: 10 }}>
                  <Text style={labelStyle}>PRAYER ANCHOR</Text>

                  {/* Prayer picker */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {PRAYER_NAMES.map(name => {
                      const active = d.anchorPrayer === name;
                      return (
                        <TouchableOpacity
                          key={name}
                          onPress={() => setCustomDraft(prev => ({ ...prev, anchorPrayer: name }))}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: theme.radius.button,
                            borderWidth: 1,
                            borderColor: active ? theme.colors.accent : theme.colors.border,
                            backgroundColor: active ? theme.colors.accent + '18' : 'transparent',
                            alignItems: 'center',
                          }}>
                          <Text style={{
                            fontSize: 9,
                            color: active ? theme.colors.accent : theme.colors.subtle,
                            fontFamily: 'Courier New',
                            letterSpacing: 0.5,
                          }}>
                            {name.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Before / After + offset */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {['before', 'after'].map(dir => {
                      const active = d.anchorDirection === dir;
                      return (
                        <TouchableOpacity
                          key={dir}
                          onPress={() => setCustomDraft(prev => ({ ...prev, anchorDirection: dir }))}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: theme.radius.button,
                            borderWidth: 1,
                            borderColor: active ? theme.colors.accent : theme.colors.border,
                            backgroundColor: active ? theme.colors.accent + '18' : 'transparent',
                          }}>
                          <Text style={{
                            fontSize: theme.typography.small,
                            color: active ? theme.colors.accent : theme.colors.subtle,
                            fontFamily: 'Courier New',
                          }}>
                            {dir.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TextInput
                      value={String(d.anchorOffset ?? 0)}
                      onChangeText={t => {
                        const n = parseInt(t, 10);
                        setCustomDraft(prev => ({ ...prev, anchorOffset: isNaN(n) ? 0 : n }));
                      }}
                      keyboardType="number-pad"
                      style={[inputStyle, { width: 64, textAlign: 'center' }]}
                    />
                    <Text style={{ fontSize: theme.typography.small, color: theme.colors.subtle }}>
                      min
                    </Text>
                  </View>
                </View>
              )}

              {/* ── Exact time ── */}
              {showExact && (
                <View>
                  <Text style={labelStyle}>EXACT TIME</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {/* Hour field */}
                    <TextInput
                      value={d.exactTime.split(':')[0]}
                      onChangeText={hh => {
                        const n = parseInt(hh, 10);
                        const valid = hh === '' ? '00' : (isNaN(n) || n < 0 || n > 23) ? d.exactTime.split(':')[0] : hh;
                        setCustomDraft(prev => ({
                          ...prev,
                          exactTime: `${valid}:${prev.exactTime.split(':')[1]}`,
                        }));
                      }}
                      onBlur={() => {
                        const [hh, mm] = d.exactTime.split(':');
                        const padded = String(Math.min(23, Math.max(0, parseInt(hh, 10) || 0))).padStart(2, '0');
                        setCustomDraft(prev => ({ ...prev, exactTime: `${padded}:${mm}` }));
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                      style={[inputStyle, { width: 56, textAlign: 'center' }]}
                    />
                    <Text style={{ color: theme.colors.subtle, fontSize: 18 }}>:</Text>
                    {/* Minute field */}
                    <TextInput
                      value={d.exactTime.split(':')[1]}
                      onChangeText={mm => {
                        const n = parseInt(mm, 10);
                        const valid = mm === '' ? '00' : (isNaN(n) || n < 0 || n > 59) ? d.exactTime.split(':')[1] : mm;
                        setCustomDraft(prev => ({
                          ...prev,
                          exactTime: `${prev.exactTime.split(':')[0]}:${valid}`,
                        }));
                      }}
                      onBlur={() => {
                        const [hh, mm] = d.exactTime.split(':');
                        const padded = String(Math.min(59, Math.max(0, parseInt(mm, 10) || 0))).padStart(2, '0');
                        setCustomDraft(prev => ({ ...prev, exactTime: `${hh}:${padded}` }));
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                      style={[inputStyle, { width: 56, textAlign: 'center' }]}
                    />
                  </View>
                </View>
              )}

              {/* ── Repeat type ── */}
              <View>
                <Text style={labelStyle}>REPEAT</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { value: 'daily',   label: 'Daily' },
                    { value: 'weekly',  label: 'Specific Days' },
                    { value: 'once',    label: 'Once' },
                  ].map(opt => {
                    const active = d.repeatType === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setCustomDraft(prev => ({ ...prev, repeatType: opt.value }))}
                        style={{
                          flex: 1,
                          paddingVertical: 9,
                          borderRadius: theme.radius.button,
                          borderWidth: 1,
                          borderColor: active ? theme.colors.accent : theme.colors.border,
                          backgroundColor: active ? theme.colors.accent + '18' : 'transparent',
                          alignItems: 'center',
                        }}>
                        <Text style={{
                          fontSize: 10,
                          color: active ? theme.colors.accent : theme.colors.subtle,
                          fontFamily: 'Courier New',
                          letterSpacing: 0.3,
                        }}>
                          {opt.label.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Day picker (weekly only) ── */}
              {d.repeatType === 'weekly' && (
                <View>
                  <Text style={labelStyle}>DAYS</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {DAY_ABBR.map((abbr, idx) => {
                      const active = (d.repeatDays ?? []).includes(idx);
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => {
                            const days = active
                              ? (d.repeatDays ?? []).filter(x => x !== idx)
                              : [...(d.repeatDays ?? []), idx].sort((a, b) => a - b);
                            setCustomDraft(prev => ({ ...prev, repeatDays: days }));
                          }}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: active ? theme.colors.accent : theme.colors.border,
                            backgroundColor: active ? theme.colors.accent : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Text style={{
                            fontSize: theme.typography.small,
                            color: active ? '#fff' : theme.colors.subtle,
                          }}>
                            {abbr}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ── Playlist ── */}
              <View>
                <Text style={labelStyle}>PLAYLIST</Text>
                <TouchableOpacity
                  onPress={openCustomDraftPicker}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.button,
                    padding: 12,
                    backgroundColor: theme.colors.background,
                  }}>
                  <Text style={{
                    fontSize: theme.typography.small,
                    color: d.playlistId ? theme.colors.text : theme.colors.subtle,
                  }}>
                    {playlistLabel(d.playlistId)}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.colors.subtle }}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* ── Action row ── */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                {/* Test */}
                <TouchableOpacity
                  onPress={handleTestCustom}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: theme.radius.button,
                    borderWidth: 1,
                    borderColor: theme.colors.accent,
                    backgroundColor: theme.colors.accent + '10',
                  }}>
                  <Text style={{
                    fontSize: theme.typography.small,
                    color: theme.colors.accent,
                    fontFamily: 'Courier New',
                    letterSpacing: 0.5,
                  }}>
                    TEST
                  </Text>
                </TouchableOpacity>

                {/* Cancel */}
                <TouchableOpacity
                  onPress={() => setCustomModalVisible(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: theme.radius.button,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                  }}>
                  <Text style={{
                    fontSize: theme.typography.small,
                    color: theme.colors.subtle,
                  }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity
                  onPress={handleSaveCustom}
                  disabled={!d.label.trim()}
                  style={{
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: theme.radius.button,
                    backgroundColor: d.label.trim()
                      ? theme.colors.accent
                      : theme.colors.border,
                    alignItems: 'center',
                  }}>
                  <Text style={{
                    fontSize: theme.typography.small,
                    color: '#fff',
                  }}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  /**
   * renderPlaylistPickerModal — full-screen modal that lists all playlists
   * with a "No playlist" option at the top. Tapping any row calls
   * handlePickerSelect() and closes the modal.
   */
  const renderPlaylistPickerModal = () => (
    <Modal
      visible={pickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setPickerVisible(false)}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        activeOpacity={1}
        onPress={() => setPickerVisible(false)}
      />
      <View style={{
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '60%',
        paddingTop: 20,
        paddingBottom: 40,
      }}>
        <Text style={{
          fontSize: theme.typography.body,
          color: theme.colors.text,
          fontWeight: '600',
          paddingHorizontal: theme.spacing.screen,
          marginBottom: 12,
        }}>
          Choose a Playlist
        </Text>

        <FlatList
          data={[{ id: null, name: 'No playlist' }, ...playlists]}
          keyExtractor={(item) => item.id ?? '__none__'}
          renderItem={({ item }) => {
            const isSelected =
              pickerTarget?.field === 'main'
                ? reminders?.prayers[pickerTarget.prayerName]?.playlistId === item.id
                : typeof pickerTarget?.field === 'number'
                  ? reminders?.prayers[pickerTarget.prayerName]
                      ?.customNotifications[pickerTarget.field]?.playlistId === item.id
                  : false;

            return (
              <TouchableOpacity
                onPress={() => handlePickerSelect(item.id)}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: theme.spacing.screen,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor: isSelected
                    ? theme.colors.accent + '12'
                    : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <Text style={{
                  fontSize: theme.typography.body,
                  color: isSelected ? theme.colors.accent : theme.colors.text,
                }}>
                  {item.name}
                </Text>
                {isSelected && (
                  <Text style={{ color: theme.colors.accent, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );

  // ── Loading guard ────────────────────────────────────────────────
  if (!reminders) return null;

  // ── Main render ──────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing.screen, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Location ── */}
        <Text style={labelStyle}>LOCATION</Text>

        {searchError ? (
          /* ── fallback: manual city + country fields ── */
          <>
            <Text style={{
              fontSize: 12,
              color: theme.colors.subtle,
              marginBottom: 8,
              fontFamily: 'Courier New',
            }}>
              Search unavailable — enter city and country manually
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City  (e.g. Jakarta)"
                placeholderTextColor={theme.colors.subtle}
                style={[inputStyle, { flex: 1 }]}
                autoCorrect={false}
                autoCapitalize="words"
              />
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="Country  (e.g. Indonesia)"
                placeholderTextColor={theme.colors.subtle}
                style={[inputStyle, { flex: 1 }]}
                autoCorrect={false}
                autoCapitalize="words"
              />
            </View>
          </>
        ) : (
          /* ── autocomplete search input + dropdown ── */
          <View style={{ marginBottom: 12, zIndex: 20 }}>
            {/* search row */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: 8,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 10,
            }}>
              {isSearching ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.subtle}
                  style={{ marginRight: 6 }}
                />
              ) : (
                <Text style={{ color: theme.colors.subtle, marginRight: 6, fontSize: 14 }}>
                  🔍
                </Text>
              )}
              <TextInput
                value={locationQuery}
                onChangeText={handleLocationQuery}
                placeholder="Search city..."
                placeholderTextColor={theme.colors.subtle}
                style={[inputStyle, {
                  flex: 1,
                  borderWidth: 0,
                  paddingHorizontal: 0,
                  backgroundColor: 'transparent',
                }]}
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="search"
              />
              {locationQuery.length > 0 && (
                <TouchableOpacity onPress={clearLocation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: theme.colors.subtle, fontSize: 16, marginLeft: 6 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* dropdown */}
            {showDropdown && (
              <View style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                marginTop: 4,
                zIndex: 30,
                elevation: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 4,
                overflow: 'hidden',
              }}>
                {suggestions.length === 0 ? (
                  <Text style={{
                    padding: 12,
                    color: theme.colors.subtle,
                    fontSize: 13,
                    fontFamily: 'Courier New',
                    textAlign: 'center',
                  }}>
                    No cities found — try a different name
                  </Text>
                ) : (
                  suggestions.map((s, i) => (
                    <TouchableOpacity
                      key={`${s.city}-${s.country}-${i}`}
                      onPress={() => handleSuggestionTap(s)}
                      style={{
                        paddingVertical: 11,
                        paddingHorizontal: 12,
                        borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                        borderBottomColor: theme.colors.border,
                      }}
                    >
                      <Text style={{
                        fontSize: theme.typography.body,
                        color: theme.colors.text,
                      }}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={handleFetch}
          disabled={isFetching || !city.trim() || !country.trim()}
          style={{
            backgroundColor:
              isFetching || !city.trim() || !country.trim()
                ? theme.colors.border
                : theme.colors.accent,
            borderRadius: theme.radius.button,
            paddingVertical: 12,
            alignItems: 'center',
            marginBottom: fetchError || prayerTimes ? 12 : 24,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}>
          {isFetching && (
            <ActivityIndicator size="small" color="#fff" />
          )}
          <Text style={{
            color: '#fff',
            fontSize: theme.typography.small,
            letterSpacing: 1,
            fontFamily: 'Courier New',
          }}>
            {isFetching ? 'FETCHING…' : 'FETCH PRAYER TIMES'}
          </Text>
        </TouchableOpacity>

        {/* Error message */}
        {fetchError && (
          <Text style={{
            fontSize: theme.typography.small,
            color: '#C0392B',
            marginBottom: 16,
            lineHeight: 18,
          }}>
            {fetchError}
          </Text>
        )}

        {/* Today's times row */}
        {prayerTimes && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.button,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingVertical: 10,
            paddingHorizontal: 14,
            marginBottom: 24,
          }}>
            {PRAYER_NAMES.map(name => (
              <View key={name} style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 9,
                  color: theme.colors.accent,
                  letterSpacing: 1,
                  fontFamily: 'Courier New',
                }}>
                  {name.toUpperCase()}
                </Text>
                <Text style={{
                  fontSize: theme.typography.small,
                  color: theme.colors.text,
                  marginTop: 3,
                  fontFamily: 'Courier New',
                }}>
                  {prayerTimes[name]}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Custom reminders ── */}
        {renderCustomRemindersSection()}

        {/* ── Prayer cards ── */}
        {PRAYER_NAMES.map(renderPrayerCard)}

      </ScrollView>

      {/* ── Fixed Save All button ── */}
      <View style={{
        paddingHorizontal: theme.spacing.screen,
        paddingVertical: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}>
        <TouchableOpacity
          onPress={handleSaveAll}
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.button,
            paddingVertical: 16,
            alignItems: 'center',
          }}>
          <Text style={{
            color: '#fff',
            fontSize: theme.typography.body,
            letterSpacing: 0.5,
          }}>
            Save All
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Playlist picker modal ── */}
      {renderPlaylistPickerModal()}

      {/* ── Custom reminder add/edit modal ── */}
      {renderCustomReminderModal()}

      {/* ── Toast ── */}
      {toast && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 96,
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

// ── Shared style fragments ──────────────────────────────────────────────────

/** Small uppercase label used above form sections. */
const labelStyle = {
  fontSize: 10,
  color: theme.colors.subtle,
  letterSpacing: 2,
  fontFamily: 'Courier New',
  marginBottom: 8,
};

/** Bordered text input matching the app's parchment aesthetic. */
const inputStyle = {
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: theme.radius.button,
  padding: 12,
  fontSize: theme.typography.small,
  color: theme.colors.text,
  backgroundColor: theme.colors.card,
};
