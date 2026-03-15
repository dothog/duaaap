import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { requestPermissions, scheduleDailyReminder } from './notifications';

// Preset times for the user to choose from
const REMINDER_TIMES = [ 
  { id: 1, label: 'Fajr Time', hour: 5, minute: 0 },
  { id: 2, label: 'Morning', hour: 7, minute: 0 },
  { id: 3, label: 'Dhuhr Time', hour: 12, minute: 0 },
  { id: 4, label: 'Asr Time', hour: 15, minute: 30 },
  { id: 5, label: 'Maghrib Time', hour: 18, minute: 0 },
  { id: 6, label: 'Isha Time', hour: 20, minute: 0 },
];

export default function ReminderScreen() {
  // Tracks which time the user selected
  const [selected, setSelected] = useState(null);
  // Tracks if reminder was saved successfully
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    // Step 1 — ask for permission
    const granted = await requestPermissions();

    if (!granted) {
      alert('Please enable notifications in your phone settings!');
      return;
    }

    // Step 2 — schedule the reminder
    await scheduleDailyReminder(selected.hour, selected.minute);
    setSaved(true);
  };

  return (
    <ScrollView style={{ padding: 20, marginTop: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>
        🔔 Daily Dua Reminder
      </Text>

      <Text style={{ color: 'gray', marginBottom: 20 }}>
        Choose a time to receive a daily dua reminder
      </Text>

      {/* Render each time option as a tappable card */}
      {REMINDER_TIMES.map((time) => (
        <TouchableOpacity
          key={time.id}
          onPress={() => { setSelected(time); setSaved(false); }}
          style={{
            padding: 15,
            marginBottom: 12,
            borderRadius: 12,
            // Highlight selected time in green
            backgroundColor: selected?.id === time.id ? '#2d6a4f' : '#f0f4f0',
          }}>
          <Text style={{
            fontSize: 16,
            color: selected?.id === time.id ? 'white' : 'black',
          }}>
            {time.label} — {time.hour}:{time.minute === 0 ? '00' : time.minute}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Only show save button when a time is selected */}
      {selected && !saved && (
        <TouchableOpacity
          onPress={handleSave}
          style={{
            padding: 15,
            marginTop: 10,
            backgroundColor: '#c9184a',
            borderRadius: 12,
          }}>
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
            Save Reminder
          </Text>
        </TouchableOpacity>
      )}

      {/* Confirmation message after saving */}
      {saved && (
        <Text style={{ color: '#2d6a4f', textAlign: 'center',
          marginTop: 20, fontSize: 16 }}>
          ✅ Reminder set for {selected.label}!
        </Text>
      )}

    </ScrollView>
  );
}