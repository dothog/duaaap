/**
 * data/categories.js
 * Purpose: Canonical, deduplicated list of dua category definitions.
 * Single source of truth — imported by CategoriesScreen.
 *
 * Deduplication decisions:
 *   - IDs 47, 48 → Milestones only  (removed from Social)
 *   - ID  67     → Nature only       (removed from Milestones)
 *   - ID  76     → Home only         (removed from Milestones)
 *   - ID  107    → Dhikr only        (removed from Social)
 */
export const CATEGORIES = [
  { id: 'daily-routine', name: 'Daily Routine',         emoji: '🌅', duaIds: [1,2,3,4,5,27,28,29,30,31] },
  { id: 'salah',         name: 'Salah & Worship',        emoji: '🕌', duaIds: [8,9,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,32,33] },
  { id: 'home',          name: 'Home & Daily Life',      emoji: '🏠', duaIds: [6,7,10,11,69,70,71,72,73,74,75,76,84,85] },
  { id: 'protection',    name: 'Protection & Hardship',  emoji: '🛡️', duaIds: [34,35,36,37,38,39,40,41,42,43,44,45,46,82,88,92,94,126,128] },
  { id: 'social',        name: 'Social & Blessings',     emoji: '🤲', duaIds: [86,87,89,90,91,93,108,109,112,113,114] },
  { id: 'sickness',      name: 'Sickness & Death',       emoji: '🌿', duaIds: [49,50,51,52,53,54,55,56,57,58,59,60] },
  { id: 'travel',        name: 'Travel',                  emoji: '✈️', duaIds: [95,96,97,98,99,100,101,102,103,104,105] },
  { id: 'nature',        name: 'Nature & Weather',        emoji: '🌦️', duaIds: [61,62,63,64,65,66,67,110,111] },
  { id: 'hajj',          name: 'Hajj & Umrah',            emoji: '🕋', duaIds: [115,116,117,118,119,120,121] },
  { id: 'milestones',    name: 'Milestones & Occasions',  emoji: '💍', duaIds: [47,48,68,79,80,81,127] },
  { id: 'dhikr',         name: 'Dhikr & Glorification',   emoji: '📿', duaIds: [107,129,130,131,132] },
];
