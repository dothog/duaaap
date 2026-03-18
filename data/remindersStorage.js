/**
 * data/remindersStorage.js
 * Purpose: AsyncStorage persistence for Salah reminder settings and custom
 *          reminders, plus the notification scheduling logic that turns those
 *          settings into live notifications via expo-notifications.
 *
 *          Prayer reminders — one per prayer, keyed by name (Fajr … Isha):
 *            - on/off toggle, offset, linked playlist, per-prayer custom entries
 *
 *          Custom reminders — user-defined notifications stored separately:
 *            - label, schedule type (prayer anchor / exact time)
 *            - repeat type (daily / weekly / once), day selection
 *            - linked playlist
 *
 *          scheduleAllNotifications() cancels ALL scheduled notifications first,
 *          then re-schedules prayer reminders and custom reminders together.
 *
 * Storage keys:
 *   'reminderSettings'  — prayer reminder settings
 *   'customReminders'   — custom reminder array
 *
 * Dependencies: @react-native-async-storage/async-storage, expo-notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/** AsyncStorage key for the prayer reminder settings. */
const STORAGE_KEY = 'reminderSettings';

/** AsyncStorage key for the custom reminders array. */
const CUSTOM_KEY = 'customReminders';

/**
 * generateId — lightweight collision-resistant ID.
 * Not cryptographically secure but sufficient for local storage keys.
 * @returns {string}
 */
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

/**
 * PRAYER_NAMES — the five canonical Salah names in chronological order.
 * Used as keys throughout the prayers object and for iteration when scheduling.
 */
export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/**
 * DEFAULT_REMINDERS — factory default returned when nothing is saved yet.
 * All prayers start disabled; city/country default to a sample location.
 * Shape matches the stored data model exactly.
 */
const DEFAULT_REMINDERS = {
  city: '',
  country: '',
  prayers: Object.fromEntries(
    PRAYER_NAMES.map(name => [
      name,
      {
        enabled: false,
        offsetMinutes: 0,
        playlistId: null,
        customNotifications: [],
      },
    ])
  ),
};

/**
 * loadReminders — reads the saved reminder settings from AsyncStorage.
 * Returns DEFAULT_REMINDERS if nothing has been saved yet.
 * @returns {Promise<object>} full reminders settings object
 */
export const loadReminders = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { ...DEFAULT_REMINDERS };
};

/**
 * saveReminders — JSON-serializes and writes the reminder settings.
 * @param {object} reminders - full reminders settings object
 * @returns {Promise<void>}
 */
export const saveReminders = async (reminders) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
};

// ── Private scheduling helpers ──────────────────────────────────────────────

/**
 * parseTimeString — converts "HH:MM" → { hour, minute }.
 * @param {string} timeStr - e.g. "05:23"
 * @returns {{ hour: number, minute: number }}
 */
const parseTimeString = (timeStr) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
};

/**
 * applyOffset — subtracts offsetMinutes from a time and handles midnight
 * wrap-around so the result is always a valid { hour, minute } pair.
 * Example: 00:03 − 5 min → 23:58 (previous day, still valid for daily trigger).
 * @param {number} hour
 * @param {number} minute
 * @param {number} offsetMinutes
 * @returns {{ hour: number, minute: number }}
 */
const applyOffset = (hour, minute, offsetMinutes) => {
  const totalMinutes = ((hour * 60 + minute - offsetMinutes) % 1440 + 1440) % 1440;
  return {
    hour:   Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
};

/**
 * scheduleOneDailyNotification — schedules a single daily repeating notification.
 * @param {{ title: string, body: string, data: object }} content
 * @param {number} hour
 * @param {number} minute
 * @returns {Promise<string>} notification identifier
 */
const scheduleOneDailyNotification = (content, hour, minute) =>
  Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

// ── Public scheduling API ────────────────────────────────────────────────────

/**
 * scheduleAllNotifications — cancels ALL existing scheduled notifications for
 * this app, then re-schedules prayer reminders followed by custom reminders.
 *
 * Like resetting all the alarm clocks in the house at once: clear everything
 * first, then set only the ones you actually want.
 *
 * @param {object}   reminders       - prayer reminder settings (from loadReminders)
 * @param {object}   prayerTimes     - { Fajr, Dhuhr, Asr, Maghrib, Isha } strings
 * @param {Array}    playlists       - saved playlists (passed for future validation)
 * @param {Array}    customReminders - custom reminder objects (from loadCustomReminders)
 * @returns {Promise<void>}
 */
export const scheduleAllNotifications = async (
  reminders,
  prayerTimes,
  playlists,
  customReminders = []
) => {
  // Wipe all existing scheduled notifications first — prevents duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // ── Prayer reminders ──────────────────────────────────────────────────────
  for (const prayerName of PRAYER_NAMES) {
    const prayer = reminders.prayers[prayerName];

    if (!prayer.enabled) continue;

    const rawTime = prayerTimes?.[prayerName];
    if (!rawTime) continue; // prayer times not fetched yet — skip silently

    const { hour: rawHour, minute: rawMinute } = parseTimeString(rawTime);
    const { hour, minute } = applyOffset(rawHour, rawMinute, prayer.offsetMinutes);

    await scheduleOneDailyNotification(
      {
        title: `Time for ${prayerName} 🕌`,
        body:  'Tap to open your playlist',
        data:  { playlistId: prayer.playlistId ?? null, prayerName },
      },
      hour,
      minute
    );

    for (const custom of prayer.customNotifications) {
      await scheduleOneDailyNotification(
        {
          title: `Time for ${prayerName} 🕌`,
          body:  'Tap to open your playlist',
          data:  { playlistId: custom.playlistId ?? null, prayerName },
        },
        hour,
        minute
      );
    }
  }

  // ── Custom reminders ──────────────────────────────────────────────────────
  await scheduleCustomNotifications(customReminders, prayerTimes);
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM REMINDERS — CRUD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * loadCustomReminders — reads the custom reminders array from AsyncStorage.
 * Returns an empty array on first run.
 * @returns {Promise<object[]>}
 */
export const loadCustomReminders = async () => {
  const raw = await AsyncStorage.getItem(CUSTOM_KEY);
  return raw ? JSON.parse(raw) : [];
};

/**
 * saveCustomReminder — upserts a custom reminder.
 * If reminder.id is null/undefined a new ID is generated.
 * Returns the saved object (with ID) so callers can update local state.
 *
 * @param {object} reminder - custom reminder object (id may be null for new)
 * @returns {Promise<object>} the saved reminder with a confirmed ID
 */
export const saveCustomReminder = async (reminder) => {
  const all  = await loadCustomReminders();
  const item = reminder.id ? reminder : { ...reminder, id: generateId() };
  const idx  = all.findIndex(r => r.id === item.id);
  const updated = idx >= 0
    ? all.map(r => r.id === item.id ? item : r)
    : [...all, item];
  await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
  return item;
};

/**
 * deleteCustomReminder — removes a custom reminder by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteCustomReminder = async (id) => {
  const all = await loadCustomReminders();
  await AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(all.filter(r => r.id !== id)));
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM REMINDERS — SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * addMinutesToTime — adds a signed minute delta to { hour, minute } with
 * midnight wrap-around.
 * Positive delta = later (e.g. after prayer); negative = earlier (before prayer).
 * @param {number} hour
 * @param {number} minute
 * @param {number} delta - signed minutes
 * @returns {{ hour: number, minute: number }}
 */
const addMinutesToTime = (hour, minute, delta) => {
  const total = ((hour * 60 + minute + delta) % 1440 + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
};

/**
 * getCustomTimes — resolves the notification time(s) for a single custom
 * reminder. Returns an array (0 or 1 element) based on scheduleType.
 *
 * @param {object} reminder    - custom reminder object
 * @param {object} prayerTimes - { Fajr, Dhuhr, … } strings or null
 * @returns {{ hour: number, minute: number }[]}
 */
const getCustomTimes = (reminder, prayerTimes) => {
  const times = [];

  if (reminder.scheduleType === 'prayer') {
    const rawTime = prayerTimes?.[reminder.anchorPrayer];
    if (rawTime) {
      const { hour: h, minute: m } = parseTimeString(rawTime);
      const delta = reminder.anchorDirection === 'after'
        ? +reminder.anchorOffset
        : -reminder.anchorOffset;
      times.push(addMinutesToTime(h, m, delta));
    }
  }

  if (reminder.scheduleType === 'exact') {
    if (reminder.exactTime) {
      times.push(parseTimeString(reminder.exactTime));
    }
  }

  return times;
};

/**
 * scheduleSingleCustom — schedules one custom reminder at a specific time.
 * Handles daily, weekly (one trigger per selected day), and once (next
 * occurrence from now).
 *
 * @param {object} reminder - custom reminder
 * @param {number} hour
 * @param {number} minute
 * @returns {Promise<void>}
 */
const scheduleSingleCustom = async (reminder, hour, minute) => {
  const content = {
    title: reminder.label || 'Time for Dhikr 🤲',
    body:  reminder.playlistId ? 'Tap to open your playlist' : 'Time to recite',
    data:  { playlistId: reminder.playlistId ?? null, customReminderId: reminder.id },
  };

  if (reminder.repeatType === 'daily') {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });

  } else if (reminder.repeatType === 'weekly') {
    // One notification per selected weekday
    // repeatDays uses 0=Sunday; expo-notifications weekday uses 1=Sunday
    for (const day of (reminder.repeatDays ?? [])) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1,
          hour,
          minute,
        },
      });
    }

  } else if (reminder.repeatType === 'once') {
    // Fire at the next occurrence of hour:minute (today if still in the future,
    // otherwise tomorrow).
    const now       = new Date();
    const scheduled = new Date(now);
    scheduled.setHours(hour, minute, 0, 0);
    if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduled,
      },
    });
  }
};

/**
 * scheduleCustomNotifications — schedules notifications for all enabled
 * custom reminders. Called by scheduleAllNotifications() after the cancel
 * step; does NOT cancel existing notifications itself.
 *
 * @param {object[]} customReminders - from loadCustomReminders()
 * @param {object}   prayerTimes     - { Fajr, Dhuhr, … } or null
 * @returns {Promise<void>}
 */
export const scheduleCustomNotifications = async (customReminders, prayerTimes) => {
  for (const reminder of customReminders) {
    if (!reminder.enabled) continue;
    const times = getCustomTimes(reminder, prayerTimes);
    for (const { hour, minute } of times) {
      await scheduleSingleCustom(reminder, hour, minute);
    }
  }
};
