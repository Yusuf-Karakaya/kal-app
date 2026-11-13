import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  Data, PROGRAM, PROGRESSION_NOTES, addDays, burnedKcal, dayProgress, exKey, fmt, keyToDate, programFor,
  resetWorkoutDay, todayKey, toggleSet, videoUrl, weekProgress,
} from '../data';
import { Card, styles as ui, useTheme } from '../ui';

export interface RestTimer { end: number; total: number; label: string }
interface Props { data: Data; commit: (d: Data, msg?: string) => void; startTimer: (t: RestTimer) => void }

export default function WorkoutScreen({ data, commit, startTimer }: Props) {
  const c = useTheme();
  const tk = todayKey();
  const [key, setKey] = useState(tk);
  const [openTip, setOpenTip] = useState<string | null>(null);

  const kb = data.kbWeight ?? 12;
  const week = weekProgress(data, key);
  const p = programFor(key);
  const prog = dayProgress(data, key);
  const burn = burnedKcal(data, key);
  const sets = data.workouts?.[key] ?? {};

  const onSet = (ek: string, si: number, rest: number, name: string, of: number) => {
    const wasOn = !!sets[ek]?.[si];
    commit(toggleSet(data, key, ek, si));
    if (!wasOn && rest && key === tk) startTimer({ end: Date.now() + rest * 1000, total: rest, label: `${name} · set ${si + 1}/${of}` });
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.text }]}>Kettlebell Haftası</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            Tek {kb} kg kettlebell · bu hafta {week.sessions}/{week.planned} antrenman
          </Text>
        </View>
        <View style={s.weekNav}>
          <Pressable onPress={() => setKey(addDays(key, -7))} style={[s.navBtn, { borderColor: c.line, backgroundColor: c.card }]} accessibilityLabel="Önceki hafta">
            <Text style={{ color: c.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center', minWidth: 48 }}>
            <Text style={{ color: c.muted, fontSize: 10, letterSpacing: 1 }}>HAFTA</Text>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{Math.round(week.ratio * 100)}%</Text>
          </View>
          <Pressable
            onPress={() => { const k = addDays(key, 7); setKey(k > tk ? tk : k); }}
            disabled={addDays(week.monday, 7) > tk}
            style={[s.navBtn, { borderColor: c.line, backgroundColor: c.card, opacity: addDays(week.monday, 7) > tk ? 0.35 : 1 }]}
            accessibilityLabel="Sonraki hafta"
          >
            <Text style={{ color: c.text, fontSize: 18 }}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.rail}>
        {PROGRAM.map((d, i) => {
          const k = addDays(week.monday, i);
          const dp = dayProgress(data, k);
          const on = k === key;
          return (
            <Pressable key={d.k} onPress={() => setKey(k)} style={[s.day, { borderColor: on ? c.text : c.line, backgroundColor: on ? c.text : c.card }]}
              accessibilityState={{ selected: on }}>
              {k === tk && <View style={[s.todayDot, { backgroundColor: c.warn }]} />}
              <Text style={{ color: on ? c.bg : c.text, fontWeight: '800', fontSize: 13 }}>{d.k}</Text>
              <Text style={{ color: on ? c.bg : c.muted, fontSize: 9 }}>{d.rest ? '—' : `${dp.total} set`}</Text>
              <View style={[s.dayBar, { backgroundColor: c.line }]}>
                <View style={{ width: `${dp.ratio * 100}%`, height: '100%', backgroundColor: c.leaf }} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={s.dayHead}>
        <View style={{ flex: 1 }}>
          <Text style={[s.dayTitle, { color: c.text }]}>{p.name}</Text>
          <Text style={[s.focus, { color: c.muted, backgroundColor: c.sunk }]}>
            {p.focus.toLocaleUpperCase('tr-TR')} · {keyToDate(key).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
          </Text>
          <Text style={{ color: c.muted, marginTop: 6 }}>{p.intro}</Text>
        </View>
        {!p.rest && (
          <View style={{ alignItems: 'center' }}>
            <ProgressRing ratio={prog.ratio} />
            <Text style={{ color: c.muted, fontSize: 11 }}>{prog.done}/{prog.total} set</Text>
            {burn > 0 && <Text style={{ color: c.warn, fontSize: 12, fontWeight: '700' }}>~{fmt(burn)} kcal</Text>}
          </View>
        )}
      </View>

      {p.rest ? (
        <Card>
          <Text style={[ui.cardTitle, { color: c.text, textAlign: 'center' }]}>Bugün dinlen</Text>
          <Text style={{ color: c.muted, textAlign: 'center' }}>
            7–9 saat uyku · {fmt(data.goals.p)} g protein hedefin · {fmt(data.goals.water)} ml su
          </Text>
        </Card>
      ) : (
        (p.blocks ?? []).map((b, bi) => (
          <View key={b.t} style={{ gap: 10 }}>
            <Text style={[s.blockT, { color: c.muted }]}>{b.t.toLocaleUpperCase('tr-TR')}</Text>
            {b.ex.map((x, ei) => {
              const ek = exKey(bi, ei);
              const arr = sets[ek] ?? [];
              const all = arr.filter(Boolean).length === x.s;
              const vid = videoUrl(x.n);
              return (
                <View key={ek} style={[s.ex, { backgroundColor: c.card, borderColor: all ? c.leaf : c.line }]}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{x.n}</Text>
                      <Text style={{ color: c.muted, fontSize: 12 }}>
                        <Text style={{ color: c.text, fontWeight: '700' }}>{x.s} × {x.r}</Text>{x.rest ? ` · ${x.rest} sn dinlenme` : ''}
                      </Text>
                    </View>
                    {vid ? (
                      <Pressable onPress={() => Linking.openURL(vid)} style={[s.mini, { borderColor: c.warn }]}>
                        <Text style={{ color: c.warn, fontSize: 12 }}>▶ Video</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => setOpenTip(openTip === ek ? null : ek)} style={[s.mini, { borderColor: c.line }]}>
                      <Text style={{ color: c.muted, fontSize: 12 }}>Form</Text>
                    </Pressable>
                  </View>
                  {openTip === ek && <Text style={[s.tip, { backgroundColor: c.sunk, color: c.text }]}>{x.tip}</Text>}
                  <View style={s.sets}>
                    {Array.from({ length: x.s }, (_, si) => {
                      const on = !!arr[si];
                      return (
                        <Pressable
                          key={si}
                          onPress={() => onSet(ek, si, x.rest, x.n, x.s)}
                          accessibilityLabel={`Set ${si + 1}`}
                          accessibilityState={{ checked: on }}
                          style={[s.set, { borderColor: on ? c.leaf : c.line, borderStyle: on ? 'solid' : 'dashed', backgroundColor: on ? c.leafSoft : 'transparent' }]}
                        >
                          <Text style={{ color: on ? c.leaf : c.muted, fontWeight: '700' }}>{si + 1}</Text>
                        </Pressable>
                      );
                    })}
                    <Text style={{ marginLeft: 'auto', color: c.muted, fontSize: 12 }}>{x.kg ? `${kb} kg` : 'vücut ağırlığı'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      {!p.rest && (
        <Pressable
          onPress={() => Alert.alert('Günün setleri sıfırlansın mı?', undefined, [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Sıfırla', style: 'destructive', onPress: () => commit(resetWorkoutDay(data, key), 'Gün sıfırlandı') },
          ])}
        >
          <Text style={{ color: c.muted, textDecorationLine: 'underline' }}>Günü sıfırla</Text>
        </Pressable>
      )}

      <Card title="Nasıl ilerlersin">
        {[...PROGRESSION_NOTES, 'Set kutusuna dokunduğunda dinlenme sayacı başlar. Antrenman yaptığın gün su hedefin 500 ml artar.'].map((n) => (
          <Text key={n} style={{ color: c.muted, fontSize: 13 }}>• {n}</Text>
        ))}
      </Card>

    </View>
  );
}

/** Ekranın altına sabitlenen dinlenme sayacı (App içinde gösterilir) */
export function RestTimerBar({ timer, onChange }: { timer: RestTimer; onChange: (t: RestTimer | null) => void }) {
  const c = useTheme();
  const [, force] = useState(0);
  const buzzed = useRef(false);
  useEffect(() => {
    buzzed.current = false;
    const iv = setInterval(() => {
      force((x) => x + 1);
      if (Date.now() >= timer.end && !buzzed.current) {
        buzzed.current = true;
        Vibration.vibrate([0, 300, 150, 300]);
        setTimeout(() => onChange(null), 4000);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [timer, onChange]);
  const remain = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
  const ratio = timer.total ? 1 - Math.max(0, timer.end - Date.now()) / (timer.total * 1000) : 0;
  return (
    <View style={[s.timer, { backgroundColor: c.text }]}>
      <View style={[s.tprog, { width: `${Math.min(1, ratio) * 100}%`, backgroundColor: c.warn }]} />
      <Text style={[s.clock, { color: remain === 0 ? c.warn : c.bg }]}>
        {remain === 0 ? 'Hazır' : `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}`}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.bg, fontWeight: '700' }}>Dinlenme</Text>
        <Text style={{ color: c.bg, opacity: 0.7, fontSize: 12 }} numberOfLines={1}>{timer.label}</Text>
      </View>
      <Pressable onPress={() => onChange({ ...timer, end: Math.max(timer.end, Date.now()) + 15000, total: timer.total + 15 })} style={[s.tbtn, { borderColor: c.muted }]}>
        <Text style={{ color: c.bg, fontSize: 12 }}>+15 sn</Text>
      </Pressable>
      <Pressable onPress={() => onChange(null)} style={[s.tbtn, { backgroundColor: c.warn, borderColor: c.warn }]}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Geç</Text>
      </Pressable>
    </View>
  );
}

function ProgressRing({ ratio }: { ratio: number }) {
  const c = useTheme();
  const r = 22, len = 2 * Math.PI * r;
  return (
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={28} cy={28} r={r} stroke={c.sunk} strokeWidth={5} fill="none" />
        <Circle cx={28} cy={28} r={r} stroke={c.leaf} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - ratio)} />
      </Svg>
      <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{Math.round(ratio * 100)}%</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  title: { fontSize: 24, fontWeight: '800' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rail: { flexDirection: 'row', gap: 5 },
  day: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 7, alignItems: 'center', gap: 2 },
  todayDot: { position: 'absolute', top: 4, right: 5, width: 6, height: 6, borderRadius: 3 },
  dayBar: { width: '70%', height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  dayHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dayTitle: { fontSize: 21, fontWeight: '800' },
  focus: { alignSelf: 'flex-start', fontSize: 10, letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4, overflow: 'hidden' },
  blockT: { fontSize: 11, letterSpacing: 1, marginTop: 6 },
  ex: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  mini: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  tip: { marginTop: 8, padding: 10, borderRadius: 8, fontSize: 13, overflow: 'hidden' },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 },
  set: { minWidth: 44, height: 40, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  tprog: { position: 'absolute', left: 0, top: 0, height: 3 },
  clock: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 70 },
  tbtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
});
