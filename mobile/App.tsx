import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Data, addWater, dateKey, dayLabel, keyToDate, loadData, saveData, todayKey } from './src/data';
import { hasPermission, requestPermission, reschedule, sendTest, setupNotifications } from './src/notifications';
import ProgressScreen from './src/screens/ProgressScreen';
import WorkoutScreen, { RestTimer, RestTimerBar } from './src/screens/WorkoutScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TodayScreen from './src/screens/TodayScreen';
import { ThemeContext, dark, light } from './src/ui';

type Tab = 'today' | 'workout' | 'progress' | 'settings';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'today', label: 'Bugün', icon: '◉' },
  { key: 'workout', label: 'Antrenman', icon: '⚑' },
  { key: 'progress', label: 'İlerleme', icon: '↗' },
  { key: 'settings', label: 'Ayarlar', icon: '⚙' },
];

export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? dark : light;
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [dayKey, setDayKey] = useState(todayKey());
  const [permission, setPermission] = useState(false);
  const dataRef = useRef<Data | null>(null);
  const [toast, setToast] = useState('');
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Her değişiklikte kaydet ve bildirimleri yeniden planla
  const commit = useCallback((next: Data, msg?: string) => {
    dataRef.current = next;
    setData(next);
    saveData(next).catch(() => {});
    reschedule(next);
    if (msg) {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 2400);
    }
  }, []);

  const addWaterToday = useCallback((ml: number) => {
    if (!dataRef.current) return;
    commit(addWater(dataRef.current, todayKey(), ml), `💧 ${ml} ml eklendi`);
  }, [commit]);

  // Bildirimdeki "+200 ml içtim" butonları
  const handled = useRef(new Set<string>());
  const handleResponse = useCallback((resp: Notifications.NotificationResponse | null) => {
    if (!resp) return;
    const id = resp.notification.request.identifier + resp.actionIdentifier;
    if (handled.current.has(id)) return;
    handled.current.add(id);
    const m = /^water(\d+)$/.exec(resp.actionIdentifier);
    if (m) {
      addWaterToday(Number(m[1]));
      setDayKey(todayKey());
      setTab('today');
    }
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [addWaterToday]);

  useEffect(() => {
    let responseSub: { remove: () => void } | undefined;
    (async () => {
      const d = await loadData();
      dataRef.current = d;
      setData(d);
      if (Platform.OS === 'web') return; // web'de yerel bildirim yok
      const granted = await setupNotifications().catch(() => false);
      setPermission(granted);
      reschedule(d);
      // Uygulama bildirim butonuyla açıldıysa ve açıkken basılırsa
      handleResponse(await Notifications.getLastNotificationResponseAsync().catch(() => null));
      responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    })();
    // Uygulamaya dönülünce gün değişmiş olabilir; planları tazele
    const sub = AppState.addEventListener('change', async (st) => {
      if (st !== 'active') return;
      setDayKey((k) => (k > todayKey() ? todayKey() : k));
      if (Platform.OS === 'web') return;
      setPermission(await hasPermission());
      if (dataRef.current) reschedule(dataRef.current);
    });
    return () => {
      sub.remove();
      responseSub?.remove();
    };
  }, [handleResponse]);

  const askPermission = async () => {
    const ok = await requestPermission();
    setPermission(ok);
    if (ok && dataRef.current) reschedule(dataRef.current);
  };

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.leaf} />
      </View>
    );
  }

  const shift = (delta: number) => {
    const d = keyToDate(dayKey);
    d.setDate(d.getDate() + delta);
    const k = dateKey(d);
    if (k <= todayKey()) setDayKey(k);
  };
  const viewDate = keyToDate(dayKey);
  const title = dayLabel(dayKey);

  return (
    <ThemeContext.Provider value={theme}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'left', 'right']}>
          {tab === 'today' && (
            <View style={styles.header}>
              <Pressable onPress={() => shift(-1)} style={[styles.navBtn, { borderColor: theme.line, backgroundColor: theme.card }]} accessibilityLabel="Önceki gün">
                <Text style={[styles.navText, { color: theme.text }]}>‹</Text>
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                <Text style={{ color: theme.muted, fontSize: 13 }}>
                  {viewDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <Pressable
                onPress={() => shift(1)}
                disabled={dayKey >= todayKey()}
                style={[styles.navBtn, { borderColor: theme.line, backgroundColor: theme.card, opacity: dayKey >= todayKey() ? 0.35 : 1 }]}
                accessibilityLabel="Sonraki gün"
              >
                <Text style={[styles.navText, { color: theme.text }]}>›</Text>
              </Pressable>
            </View>
          )}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {tab === 'today' && <TodayScreen data={data} dayKey={dayKey} commit={commit} />}
              {tab === 'workout' && <WorkoutScreen data={data} commit={commit} startTimer={setRestTimer} />}
              {tab === 'progress' && <ProgressScreen data={data} commit={commit} />}
              {tab === 'settings' && (
                <SettingsScreen
                  data={data}
                  permission={permission}
                  onSave={commit}
                  onRequestPermission={askPermission}
                  onTest={async () => {
                    if (!permission) await askPermission();
                    await sendTest();
                  }}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
          {toast ? (
            <View pointerEvents="none" style={styles.toastWrap}>
              <Text style={[styles.toast, { backgroundColor: theme.text, color: theme.bg }]}>{toast}</Text>
            </View>
          ) : null}
        </SafeAreaView>
        {restTimer && <RestTimerBar timer={restTimer} onChange={setRestTimer} />}
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.tabbar, { backgroundColor: theme.card, borderColor: theme.line }]}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
              <Text style={{ fontSize: 20, color: tab === t.key ? theme.leaf : theme.muted }}>{t.icon}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: tab === t.key ? theme.leaf : theme.muted }}>{t.label}</Text>
            </Pressable>
          ))}
        </SafeAreaView>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  navBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 24, lineHeight: 26 },
  title: { fontSize: 21, fontWeight: '800', textTransform: 'capitalize' },
  scroll: { padding: 16, paddingTop: 4, paddingBottom: 32 },
  tabbar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 12, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, overflow: 'hidden', fontSize: 14, textAlign: 'center' },
});
