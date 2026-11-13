// Yerel (cihaz üstü) bildirim planlaması.
// Bildirimler işletim sistemine önceden planlatılır; böylece uygulama tamamen kapalıyken de gelir.
// Her veri değişikliğinde bugün + yarın için tüm hatırlatmalar yeniden hesaplanır.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Data, dateKey, fmt, minutesOf, todayKey, totals, waterGoalOn } from './data';

export const WATER_CATEGORY = 'water-reminder';
const CHANNEL = 'reminders';
const MAX_SCHEDULED = 56; // iOS en fazla 64 bekleyen bildirime izin verir

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Hatırlatmalar',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
    });
  }
  await Notifications.setNotificationCategoryAsync(WATER_CATEGORY, [
    { identifier: 'water200', buttonTitle: '+200 ml içtim', options: { opensAppToForeground: true } },
    { identifier: 'water500', buttonTitle: '+500 ml içtim', options: { opensAppToForeground: true } },
  ]);
  return hasPermission();
}

export async function hasPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

const labels = { kahvalti: 'Kahvaltı', ogle: 'Öğle yemeği', aksam: 'Akşam yemeği' };

interface Planned {
  at: Date;
  title: string;
  body: string;
  water?: boolean;
}

function at(day: Date, time: string): Date {
  const m = minutesOf(time);
  const d = new Date(day);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

// Bugün ve yarın için gönderilecek bildirimlerin listesi
export function planReminders(data: Data, now = new Date()): Planned[] {
  const r = data.reminders;
  const out: Planned[] = [];
  const tk = todayKey();

  for (let offset = 0; offset < 2; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    const key = dateKey(day);
    const isToday = key === tk;
    const { cal, water, p: protein } = totals(data, key);
    const dayData = data.days[key];
    const waterGoal = waterGoalOn(data, key);

    // Su: aktif saatlerde, son içilen sudan itibaren belirli aralıkla, hedefe ulaşılana kadar
    if (r.waterOn && water < waterGoal) {
      const start = at(day, r.start);
      let end = at(day, r.end);
      if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // gece yarısını geçen aralık
      const lastDrink = isToday ? Math.max(0, ...(dayData?.water ?? []).map((w) => w.t)) : 0;
      const step = r.waterEvery * 60 * 1000;
      let t = Math.max(start.getTime(), lastDrink ? lastDrink + step : start.getTime());
      if (t < now.getTime() + 60 * 1000) t = now.getTime() + 5 * 60 * 1000; // gecikmişse 5 dk sonra hatırlat
      for (; t < end.getTime(); t += step) {
        const left = waterGoal - water;
        out.push({
          at: new Date(t),
          title: '💧 Su içme zamanı',
          body: isToday
            ? `Bugün ${fmt(water)} ml içtin, hedefe ${fmt(left)} ml kaldı.`
            : `Günlük hedefin ${fmt(data.goals.water)} ml. Bir bardak suyla başla.`,
          water: true,
        });
      }
    }

    // Öğünler: o öğün henüz girilmemişse
    if (r.mealOn) {
      const meals: [keyof typeof labels, string][] = [
        ['kahvalti', r.breakfast], ['ogle', r.lunch], ['aksam', r.dinner],
      ];
      for (const [meal, time] of meals) {
        if (dayData?.food.some((f) => f.meal === meal)) continue;
        out.push({
          at: at(day, time),
          title: `🍽️ ${labels[meal]} vakti`,
          body: isToday
            ? `Ne yediğini tek cümleyle yazman yeterli. Bugün şu ana kadar ${fmt(cal)} kcal.`
            : 'Ne yediğini tek cümleyle yazman yeterli.',
        });
      }
    }

    // Tartılma (o gün tartı girilmediyse)
    if (r.weighOn && r.weigh && data.weights[key] == null) {
      out.push({ at: at(day, r.weigh), title: '⚖️ Tartılma zamanı', body: 'Kahvaltıdan önce tartılıp kilonu İlerleme ekranına gir.' });
    }

    // Gün sonu özeti (içerik planlama anındaki değerlerle yazılır, her kayıtta güncellenir)
    if (r.summaryOn) {
      const calMsg = cal > data.goals.cal
        ? `${fmt(cal - data.goals.cal)} kcal hedefin üstünde`
        : `${fmt(data.goals.cal - cal)} kcal hedefin altında`;
      const waterMsg = water >= waterGoal ? 'su hedefi tamam ✓' : `suda ${fmt(waterGoal - water)} ml eksik`;
      out.push({
        at: at(day, r.summary),
        title: '📊 Günün özeti',
        body: isToday
          ? `${fmt(cal)} kcal (${calMsg}), protein ${fmt(protein)}/${fmt(data.goals.p)} g, ${waterMsg}.`
          : 'Bugünkü kayıtlarına bir göz at.',
      });
    }
  }

  return out
    .filter((p) => p.at.getTime() > now.getTime() + 30 * 1000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}


let running: Promise<void> = Promise.resolve();

// Tüm planlı bildirimleri silip yeniden kurar (çakışmasın diye sıraya alınır)
export function reschedule(data: Data): Promise<void> {
  running = running.then(async () => {
    if (Platform.OS === 'web' || !(await hasPermission())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of planReminders(data)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: p.title,
          body: p.body,
          sound: 'default',
          categoryIdentifier: p.water ? WATER_CATEGORY : undefined,
          data: { kind: p.water ? 'water' : 'other' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: p.at,
          channelId: CHANNEL,
        },
      });
    }
  }).catch((e) => console.warn('Bildirimler planlanamadı', e));
  return running;
}

export async function sendTest(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💧 Test bildirimi',
      body: 'Hatırlatmalar çalışıyor. Butonla su ekleyebilirsin.',
      sound: 'default',
      categoryIdentifier: WATER_CATEGORY,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL },
  });
}
