/**
 * data/playlistStorage.js
 * Purpose: AsyncStorage CRUD utilities for the user's saved playlists.
 *          All persistence for the playlist feature passes through here.
 *          Playlist shape:
 *            { id, name, type: 'category'|'single'|'custom', duaIds: number[], categoryId: string|null }
 * Dependencies: @react-native-async-storage/async-storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage key under which the playlists array is stored. */
const STORAGE_KEY = 'playlists';

/**
 * generateId — creates a lightweight unique string ID.
 * Combines a timestamp base-36 string with random characters.
 * Not cryptographically secure but sufficient for local storage keys.
 * @returns {string} unique id string
 */
const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

/**
 * loadPlaylists — reads and JSON-parses the playlists array from AsyncStorage.
 * Returns an empty array if nothing has been saved yet.
 * @returns {Promise<Array>} array of playlist objects
 */
export const loadPlaylists = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

/**
 * savePlaylists — JSON-serializes and writes the full playlists array to AsyncStorage.
 * This is the single write path — all mutations ultimately call this.
 * Think of it like a save button that always writes the whole document.
 * @param {Array} playlists - the complete array to persist
 * @returns {Promise<void>}
 */
export const savePlaylists = async (playlists) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
};

/**
 * createPlaylist — builds a new playlist object, appends it to the saved list, and saves.
 * @param {string} name - display name shown in the UI
 * @param {'category'|'single'|'custom'} type - how the playlist was created
 * @param {number[]} duaIds - array of dua IDs to include (can be empty initially)
 * @param {string|null} categoryId - source category id for 'category' type, or null
 * @returns {Promise<object>} the newly created playlist object
 */
export const createPlaylist = async (name, type, duaIds = [], categoryId = null) => {
  const playlists = await loadPlaylists();
  const newPlaylist = { id: generateId(), name, type, duaIds, categoryId };
  await savePlaylists([...playlists, newPlaylist]);
  return newPlaylist;
};

/**
 * deletePlaylist — removes a playlist by id and persists the change.
 * @param {string} id - the playlist id to remove
 * @returns {Promise<void>}
 */
export const deletePlaylist = async (id) => {
  const playlists = await loadPlaylists();
  await savePlaylists(playlists.filter(p => p.id !== id));
};

/**
 * removeDuaFromPlaylist — removes a single dua ID from a playlist's duaIds array and saves.
 * No-ops silently if the playlist or dua is not found.
 * @param {string} playlistId - the id of the playlist to update
 * @param {number} duaId - the dua ID to remove
 * @returns {Promise<void>}
 */
export const removeDuaFromPlaylist = async (playlistId, duaId) => {
  const playlists = await loadPlaylists();
  const updated = playlists.map(p =>
    p.id === playlistId
      ? { ...p, duaIds: p.duaIds.filter(id => id !== duaId) }
      : p
  );
  await savePlaylists(updated);
};

/**
 * addDuaToPlaylist — appends a dua ID to a playlist if not already present.
 * Idempotent — safe to call multiple times with the same arguments.
 * @param {string} playlistId - the id of the playlist to update
 * @param {number} duaId - the dua ID to add
 * @returns {Promise<void>}
 */
export const addDuaToPlaylist = async (playlistId, duaId) => {
  const playlists = await loadPlaylists();
  const updated = playlists.map(p =>
    p.id === playlistId && !p.duaIds.includes(duaId)
      ? { ...p, duaIds: [...p.duaIds, duaId] }
      : p
  );
  await savePlaylists(updated);
};

/**
 * updatePlaylist — shallow-merges a partial updates object into a playlist and saves.
 * Use for renaming, reordering duaIds, or changing the type field.
 * @param {string} id - the id of the playlist to update
 * @param {object} updates - partial fields to merge (e.g. { name: 'New name' })
 * @returns {Promise<void>}
 */
export const updatePlaylist = async (id, updates) => {
  const playlists = await loadPlaylists();
  const updated = playlists.map(p => p.id === id ? { ...p, ...updates } : p);
  await savePlaylists(updated);
};
