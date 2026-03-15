import AsyncStorage from '@react-native-async-storage/async-storage';

// The key we use to store favorites in the phone's memory
// Like the label on a filing cabinet drawer
const FAVORITES_KEY = 'dua_favorites';

// Get all saved favorite IDs from the phone
export const getFavorites = async () => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    // If nothing saved yet, return empty array
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save a new favorite ID to the phone
export const addFavorite = async (id) => {
  try {
    const current = await getFavorites();
    // Only add if not already saved
    if (!current.includes(id)) {
      await AsyncStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify([...current, id])
      );
    }
  } catch (error) {
    console.log('Error saving favorite:', error);
  }
};

// Remove a favorite ID from the phone
export const removeFavorite = async (id) => {
  try {
    const current = await getFavorites();
    const updated = current.filter((favId) => favId !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.log('Error removing favorite:', error);
  }
};