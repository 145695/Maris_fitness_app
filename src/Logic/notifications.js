import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { QUOTES } from "../constants/quotes";

// Show notifications even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
f
// Ask for permission once. Returns true if granted.
export async function requestPermission() {
  if (!Device.isDevice) {
    // Simulators/emulators can't get permission — just skip.
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }

  // Android needs a channel or the notification won't show.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return status === "granted";
}

// Deterministic, same as home.js getQuote().
function quoteForDate(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// Cancel everything we've scheduled before, so a re-run doesn't duplicate.
async function clearOurNotifications() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.identifier.startsWith("maris-")) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// Schedule the next `days` morning quote notifications, one per day,
// each carrying that day's correct quote.
async function scheduleDailyQuotes(days = 7) {
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(8, 0, 0, 0);

    // If 8 AM has already passed for today, start tomorrow instead.
    if (date <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `maris-quote-${date.toISOString().slice(0, 10)}`,
      content: {
        title: "Today's quote 🌿",
        body: quoteForDate(date),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
  }
}

// Repeating daily reminders use a DAILY trigger — no need to schedule
// 365 one-shots for something with a fixed message.
async function scheduleDailyAt(hour, minute, id, title, body) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

// Entry point — call once after login/onboarding.
export async function setupNotifications() {
  const ok = await requestPermission();
  if (!ok) return { ok: false, reason: "permission_denied" };

  await clearOurNotifications();

  // 6 AM — workout ready
  await scheduleDailyAt(
    6,
    0,
    "maris-workout",
    "Good morning ☀️",
    "Your workout is ready. Let's get started.",
  );

  // 8 AM — today's quote (next 7 days, each with its own quote)
  await scheduleDailyQuotes(7);

  // 10 PM — sleep reminder
  await scheduleDailyAt(
    22,
    0,
    "maris-sleep",
    "Time to wind down 🌙",
    "Aim for 7–8 hours tonight. Your body repairs while you sleep.",
  );

  return { ok: true };
}

// Handy for testing — schedules a notification 5 seconds from now.
export async function testNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: "Test", body: "Notifications are working." },
    trigger: { seconds: 5 },
  });
}
