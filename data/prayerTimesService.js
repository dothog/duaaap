/**
 * data/prayerTimesService.js
 * Purpose: Fetches the five daily Salah prayer times from the Aladhan API
 *          and caches the result in AsyncStorage under 'prayerTimesCache'.
 *          On each call to getTodaysPrayerTimes() the cache date is compared
 *          to today's date; if stale, fresh data is fetched automatically
 *          using the previously cached city and country.
 *
 *          API endpoint:
 *            https://api.aladhan.com/v1/timingsByCity
 *            ?city={city}&country={country}&method=11
 *          Method 11 = Moonsighting Committee Worldwide (Khalid Shawkany).
 *
 * Cache shape (AsyncStorage key: 'prayerTimesCache'):
 *   { date: "2026-03-17", city: "Palembang", country: "Indonesia",
 *     times: { Fajr: "05:23", Dhuhr: "12:06", Asr: "15:22",
 *              Maghrib: "18:14", Isha: "19:27" } }
 *
 * Dependencies: @react-native-async-storage/async-storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage key for the prayer times cache. */
const CACHE_KEY = 'prayerTimesCache';

/** Aladhan API base URL. */
const API_BASE = 'https://api.aladhan.com/v1/timingsByCity';

/**
 * getTodayDateString — returns today's date as an ISO date string "YYYY-MM-DD".
 * Used to validate whether the cached data is still current.
 * @returns {string} e.g. "2026-03-17"
 */
const getTodayDateString = () => new Date().toISOString().split('T')[0];

/**
 * fetchPrayerTimes — fetches the five daily prayer times from the Aladhan API
 * for the given city and country, caches the result in AsyncStorage, and
 * returns an object containing only the five prayer time strings.
 *
 * Like calling the local mosque for today's schedule and writing it on
 * the fridge so you don't have to call again tomorrow.
 *
 * @param {string} city    - e.g. "Palembang"
 * @param {string} country - e.g. "Indonesia"
 * @returns {Promise<{ Fajr: string, Dhuhr: string, Asr: string, Maghrib: string, Isha: string }>}
 * @throws {Error} if the network request fails or the API returns an error status
 */
export const fetchPrayerTimes = async (city, country) => {
  const url =
    `${API_BASE}?city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}&method=11`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Aladhan API error: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 200 || !json.data?.timings) {
    throw new Error('Invalid response from prayer times API');
  }

  const { Fajr, Dhuhr, Asr, Maghrib, Isha } = json.data.timings;

  // The API sometimes appends a timezone offset, e.g. "05:23 (+07)".
  // Strip everything after (and including) the first space so we store "05:23".
  const clean = (t) => (t ?? '').split(' ')[0].trim();

  const times = {
    Fajr:    clean(Fajr),
    Dhuhr:   clean(Dhuhr),
    Asr:     clean(Asr),
    Maghrib: clean(Maghrib),
    Isha:    clean(Isha),
  };

  const cache = { date: getTodayDateString(), city, country, times };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));

  return times;
};

/**
 * getTodaysPrayerTimes — returns cached prayer times if they are from today,
 * otherwise fetches fresh data using the city and country stored in the cache.
 * Returns null when there is no cache at all (first run, never fetched).
 *
 * Think of it like a daily newspaper: if today's edition is already on the
 * table, read it; if it's yesterday's, go get a fresh copy.
 *
 * @returns {Promise<{ Fajr: string, Dhuhr: string, Asr: string, Maghrib: string, Isha: string } | null>}
 */
export const getTodaysPrayerTimes = async () => {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  const cache = JSON.parse(raw);

  // Cache is still valid for today — return immediately
  if (cache.date === getTodayDateString()) return cache.times;

  // Cache is stale — refresh silently using previously saved city/country
  if (cache.city && cache.country) {
    try {
      return await fetchPrayerTimes(cache.city, cache.country);
    } catch {
      // Network unavailable — return stale data rather than nothing
      return cache.times;
    }
  }

  return null;
};
