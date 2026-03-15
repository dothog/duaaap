import * as Notifications from 'expo-notifications';
import data from './husn_en.json';

// Tell the app how to show notifications when open
// Like setting your phone to show banners
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Flatten all duas into one list
const ALL_DUAS = data.English.flatMap((section) =>
  section.TEXT.map((dua) => ({
    ...dua,
    SECTION_TITLE: section.TITLE,
  }))
);

// Ask user permission for local notifications
export const requestPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// Pick a random dua
const getRandomDua = () => {
  const index = Math.floor(Math.random() * ALL_DUAS.length);
  return ALL_DUAS[index];
};

// Schedule a daily local notification
export const scheduleDailyReminder = async (hour, minute) => {
  // Cancel existing reminders first
  await Notifications.cancelAllScheduledNotificationsAsync();

  const dua = getRandomDua();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🤲 Daily Dua Reminder',
      body: dua.TRANSLATED_TEXT?.slice(0, 100) + '...',
      // Local only — no push server needed
      data: { duaId: dua.ID },
    },
    trigger: {
      type: 'daily',
      hour: hour,
      minute: minute,
    },
  });
};