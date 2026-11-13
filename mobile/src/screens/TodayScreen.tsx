import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Data, FOOD_BY_ID, MEALS, MEAL_ORDER, Meal, ParseResult, addDays, addDrink, addFoodEntry, addParsedItems, addWater,
  copyMeal, dailyInsights, fmt, fmt1, guessMeal, hhmm, learnFood, logStreak, mealTotals, moveEntry, parseMealText,
  recentFoods, removeEntry, scaleEntry, sumItems, totals, waterGoalOn, waterStreak,
} from '../data';
import { Btn, Card, Chip, Input, MacroBars, Ring, Segmented, styles as ui, useTheme } from '../ui';

interface Props {
  data: Data;
  dayKey: string;
  commit: (next: Data, msg?: string) => void;
}

const MEAL_OPTIONS = MEAL_ORDER.map((m) => ({ value: m, label: MEALS[m] }));
const DRINKS = ['cay', 'filtre-kahve', 'turk-kahvesi', 'ayran', 'sut', 'portakal-suyu', 'kola', 'zero-kola'];
const EMPTY: ParseResult = { items: [], unknown: [], unknownItems: [] };

export default function TodayScreen({ data, dayKey, commit }: Props) {
  const c = useTheme();
  const t = totals(data, dayKey);
  const g = { ...data.goals, water: waterGoalOn(data, dayKey) };
  const day = data.days[dayKey] ?? { food: [], water: [] };

  const [text, setText] = useState('');
  const [meal, setMeal] = useState<Meal>(guessMeal());
  const [mealPinned, setMealPinned] = useState(false);
  const [parsed, setParsed] = useState<ParseResult>(EMPTY);
  const [unknownKcal, setUnknownKcal] = useState<Record<string, string>>({});
  const [customMl, setCustomMl] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  // Yazdıkça ayrıştır
  useEffect(() => {
    const h = setTimeout(() => {
      const r = parseMealText(text, data.customFoods);
      setParsed(r);
      if (r.meal && !mealPinned) setMeal(r.meal);
    }, 150);
    return () => clearTimeout(h);
  }, [text, data.customFoods, mealPinned]);

  const insights = useMemo(() => dailyInsights(data, dayKey), [data, dayKey]);
  const recent = useMemo(() => recentFoods(data, 10), [data]);
  const sum = sumItems(parsed.items);
  const extra = parsed.unknownItems.reduce((s, u) => s + (Number(unknownKcal[u.text]) || 0), 0);
  const count = parsed.items.length + parsed.unknownItems.filter((u) => Number(unknownKcal[u.text]) > 0).length;
  const prevKey = addDays(dayKey, -1);
  const prevDay = data.days[prevKey];
  const copyable = MEAL_ORDER.filter((m) => prevDay?.food.some((f) => f.meal === m) && !day.food.some((f) => f.meal === m));
  const ls = logStreak(data);
  const ws = waterStreak(data);

  const submit = () => {
    if (!count) return;
    let next = addParsedItems(data, dayKey, parsed.items, meal);
    let learned = 0;
    for (const u of parsed.unknownItems) {
      const kcal = Math.round(Number(unknownKcal[u.text]));
      if (!(kcal > 0)) continue;
      next = addFoodEntry(next, dayKey, { name: u.text.charAt(0).toLocaleUpperCase('tr-TR') + u.text.slice(1), cal: kcal, meal });
      next = learnFood(next, u.name, kcal / (u.qty || 1));
      learned++;
    }
    setText('');
    setParsed(EMPTY);
    setUnknownKcal({});
    setMealPinned(false);
    commit(next, `Eklendi: ${fmt(sum.kcal + extra)} kcal${sum.hydrationMl ? `, ${fmt(sum.hydrationMl)} ml sıvı` : ''}${learned ? '. Yeni yemeği öğrendim.' : ''}`);
  };

  const addWaterMl = (ml: number) => {
    const before = t.water;
    commit(addWater(data, dayKey, ml), before < g.water && before + ml >= g.water ? '🎉 Su hedefine ulaştın!' : `💧 ${ml} ml eklendi`);
  };

  const confirmRemove = (type: 'food' | 'water', id: string) =>
    Alert.alert('Kayıt silinsin mi?', undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => commit(removeEntry(data, dayKey, type, id)) },
    ]);

  return (
    <View style={{ gap: 14 }}>
      <View style={ui.row}>
        <Ring
          ratio={t.cal / g.cal}
          color={t.cal > g.cal ? c.over : c.leaf}
          value={fmt(t.cal)}
          unit={`/ ${fmt(g.cal)} kcal`}
          label="Kalori"
          sub={t.cal <= g.cal ? `${fmt(g.cal - t.cal)} kcal kaldı` : `${fmt(t.cal - g.cal)} kcal fazla`}
        />
        <Ring
          ratio={t.water / g.water}
          color={c.water}
          value={fmt(t.water)}
          unit={`/ ${fmt(g.water)} ml`}
          label="Su"
          sub={t.water < g.water ? `${fmt(g.water - t.water)} ml kaldı${g.water > data.goals.water ? ' · antrenman +500' : ''}` : 'Hedef tamam ✓'}
        />
      </View>

      <MacroBars values={t} goals={g} />

      {insights.map((i, k) => (
        <View key={k} style={[s.insight, { backgroundColor: c.card, borderLeftColor: i.tone === 'good' ? c.leaf : i.tone === 'warn' ? c.warn : c.water }]}>
          <Text style={{ color: c.text, lineHeight: 20 }}>{i.text}</Text>
        </View>
      ))}

      <Card>
        <View style={s.head}>
          <Text style={[ui.cardTitle, { color: c.text }]}>Ne yedin, ne içtin?</Text>
          {ls >= 2 ? <Text style={{ color: c.leaf, fontWeight: '700', fontSize: 13 }}>🔥 {ls} gün seri</Text> : null}
        </View>
        <Input
          value={text}
          onChangeText={setText}
          placeholder="örn. 2 yumurta, 1 dilim peynir, yarım ekmek ve 2 bardak çay"
          multiline
          style={{ minHeight: 64, textAlignVertical: 'top' }}
        />
        <Segmented options={MEAL_OPTIONS} value={meal} onChange={(m) => { setMeal(m); setMealPinned(true); }} />

        {(parsed.items.length > 0 || parsed.unknownItems.length > 0) && (
          <View style={[s.preview, { borderColor: c.line }]}>
            {parsed.items.map((it, i) => (
              <View key={i} style={[s.pvItem, { borderColor: c.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>{it.label}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    {it.food?.id.startsWith('custom:')
                      ? 'Kişisel yemeğin'
                      : `${fmt(it.grams)} ${it.food?.group === 'icecek' ? 'ml' : 'g'} · P ${fmt1(it.p)} · K ${fmt1(it.c)} · Y ${fmt1(it.f)}${it.hydrationMl ? ` · 💧 ${fmt(it.hydrationMl)} ml` : ''}`}
                  </Text>
                </View>
                <Text style={{ color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{fmt(it.kcal)} kcal</Text>
                <Pressable hitSlop={10} onPress={() => setParsed((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}>
                  <Text style={{ color: c.muted }}>✕</Text>
                </Pressable>
              </View>
            ))}
            {parsed.unknownItems.map((u) => (
              <View key={u.text} style={[s.pvItem, { borderColor: c.line, backgroundColor: c.sunk }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>{u.text}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>Bunu tanımadım. Toplam kalorisini yaz, “{u.name}” adıyla öğrenirim.</Text>
                </View>
                <TextInput
                  value={unknownKcal[u.text] ?? ''}
                  onChangeText={(v) => setUnknownKcal((m) => ({ ...m, [u.text]: v }))}
                  placeholder="kcal"
                  placeholderTextColor={c.muted}
                  keyboardType="number-pad"
                  style={[s.kcalInput, { borderColor: c.line, color: c.text, backgroundColor: c.card }]}
                />
              </View>
            ))}
            <View style={[s.total, { backgroundColor: c.leafSoft }]}>
              <Text style={{ color: c.leaf, fontWeight: '700' }}>Toplam</Text>
              <Text style={{ color: c.leaf, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {fmt(sum.kcal + extra)} kcal · P {fmt(sum.p)} g{sum.hydrationMl ? ` · 💧 ${fmt(sum.hydrationMl)} ml` : ''}
              </Text>
            </View>
          </View>
        )}
        <Btn
          label={count ? `${count} kalemi ${MEALS[meal].toLocaleLowerCase('tr-TR')} olarak ekle` : 'Ekle'}
          onPress={submit}
          style={{ opacity: count ? 1 : 0.5 }}
        />
        <Text style={{ color: c.muted, fontSize: 12 }}>
          Değerler porsiyon başına tahmindir. Su, çay, ayran gibi içecekler su hedefine de sayılır.
        </Text>

        {recent.length > 0 && (
          <>
            <Text style={[s.subHead, { color: c.muted }]}>SON YEDİKLERİN</Text>
            <View style={ui.chips}>
              {recent.map((r) => (
                <Chip
                  key={r.name}
                  label={r.name}
                  sub={fmt(r.cal)}
                  onPress={() => commit(addFoodEntry(data, dayKey, { name: r.name, cal: r.cal, p: r.p, c: r.c, f: r.f, grams: r.grams, foodId: r.foodId, meal }), `${r.name} eklendi`)}
                />
              ))}
            </View>
          </>
        )}
        {copyable.length > 0 && (
          <View style={ui.chips}>
            {copyable.map((m) => (
              <Btn
                key={m}
                kind="ghost"
                label={`↻ Dün: ${MEALS[m]} · ${fmt(mealTotals(prevDay, m))} kcal`}
                onPress={() => commit(copyMeal(data, prevKey, dayKey, m), `Dünkü ${MEALS[m].toLocaleLowerCase('tr-TR')} eklendi`)}
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <View style={s.head}>
          <Text style={[ui.cardTitle, { color: c.text }]}>Su ekle</Text>
          {ws >= 2 ? <Text style={{ color: c.leaf, fontWeight: '700', fontSize: 13 }}>🔥 {ws} gün seri</Text> : null}
        </View>
        <View style={ui.row}>
          <Btn kind="water" label="+200 ml" sub="bardak" onPress={() => addWaterMl(200)} style={{ flex: 1 }} />
          <Btn kind="water" label="+330 ml" sub="kutu" onPress={() => addWaterMl(330)} style={{ flex: 1 }} />
          <Btn kind="water" label="+500 ml" sub="şişe" onPress={() => addWaterMl(500)} style={{ flex: 1 }} />
        </View>
        <View style={ui.chips}>
          {DRINKS.map((id) => {
            const f = FOOD_BY_ID[id];
            return (
              <Chip
                key={id}
                label={f.name.split(' / ')[0]}
                sub={`${f.grams} ml`}
                onPress={() => commit(addDrink(data, dayKey, id, f.grams, meal), `${f.name.split(' / ')[0]} eklendi (${fmt(f.grams * (f.hydration ?? 0))} ml sıvı)`)}
              />
            );
          })}
        </View>
        <View style={ui.row}>
          <Input value={customMl} onChangeText={setCustomMl} placeholder="Özel miktar (ml)" keyboardType="number-pad" style={{ flex: 1 }} />
          <Btn
            label="Ekle"
            onPress={() => {
              const v = Math.round(Number(customMl));
              if (v > 0 && v <= 5000) { addWaterMl(v); setCustomMl(''); }
            }}
          />
        </View>
      </Card>

      <Card title="Kayıtlar">
        {day.food.length === 0 && day.water.length === 0 && (
          <Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 8 }}>Henüz kayıt yok. Yukarıya ne yediğini yazarak başla.</Text>
        )}
        {MEAL_ORDER.map((m) => {
          const items = day.food.filter((f) => f.meal === m).sort((a, b) => a.t - b.t);
          if (!items.length) return null;
          return (
            <View key={m}>
              <View style={[s.groupHead, { borderColor: c.line }]}>
                <Text style={[s.groupText, { color: c.muted }]}>{MEALS[m].toLocaleUpperCase('tr-TR')}</Text>
                <Text style={[s.groupText, { color: c.muted }]}>{fmt(items.reduce((x, f) => x + f.cal, 0))} KCAL</Text>
              </View>
              {items.map((f) => (
                <View key={f.id}>
                  <Row
                    time={hhmm(f.t)}
                    name={f.name}
                    sub={f.p != null ? `P ${fmt1(f.p)} · K ${fmt1(f.c ?? 0)} · Y ${fmt1(f.f ?? 0)}` : undefined}
                    value={fmt(f.cal)}
                    active={editId === f.id}
                    onPress={() => setEditId(editId === f.id ? null : f.id)}
                    onDelete={() => confirmRemove('food', f.id)}
                  />
                  {editId === f.id && (
                    <View style={[ui.chips, s.editBar, { borderColor: c.line }]}>
                      {[[0.5, '½×'], [1.5, '1,5×'], [2, '2×']].map(([v, l]) => (
                        <Chip key={String(v)} label={String(l)} onPress={() => commit(scaleEntry(data, dayKey, f.id, Number(v)), 'Porsiyon güncellendi')} />
                      ))}
                      {MEAL_ORDER.filter((x) => x !== f.meal).map((x) => (
                        <Chip key={x} label={`→ ${MEALS[x]}`} onPress={() => { setEditId(null); commit(moveEntry(data, dayKey, f.id, x), `${MEALS[x]} öğününe taşındı`); }} />
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
        {day.water.length > 0 && (
          <View>
            <View style={[s.groupHead, { borderColor: c.line }]}>
              <Text style={[s.groupText, { color: c.muted }]}>SIVI</Text>
              <Text style={[s.groupText, { color: c.muted }]}>{fmt(t.water)} ML</Text>
            </View>
            {[...day.water].sort((a, b) => a.t - b.t).map((w) => {
              const f = w.drink ? FOOD_BY_ID[w.drink] : undefined;
              return (
                <Row
                  key={w.id}
                  time={hhmm(w.t)}
                  name={f ? f.name.split(' / ')[0] : '💧 Su'}
                  sub={f ? `${fmt(w.vol ?? w.ml)} ml içildi, ${fmt(w.ml)} ml sayıldı` : undefined}
                  value={`${fmt(w.ml)} ml`}
                  onDelete={() => confirmRemove('water', w.id)}
                />
              );
            })}
          </View>
        )}
      </Card>
    </View>
  );
}

function Row({ time, name, sub, value, onDelete, onPress, active }: {
  time: string; name: string; sub?: string; value: string; onDelete: () => void; onPress?: () => void; active?: boolean;
}) {
  const c = useTheme();
  return (
    <View style={[s.item, { borderColor: c.line }]}>
      <Text style={{ color: c.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>{time}</Text>
      <Pressable style={{ flex: 1 }} onPress={onPress} disabled={!onPress} accessibilityHint={onPress ? 'Porsiyonu veya öğünü değiştir' : undefined}>
        <Text style={{ color: active ? c.leaf : c.text }}>{name}</Text>
        {sub ? <Text style={{ color: c.muted, fontSize: 11 }}>{sub}</Text> : null}
      </Pressable>
      <Text style={{ color: c.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Sil">
        <Text style={{ color: c.muted, fontSize: 16 }}>✕</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  insight: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderLeftWidth: 4 },
  preview: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  pvItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  kcalInput: { width: 76, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15 },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 12, gap: 8, flexWrap: 'wrap' },
  subHead: { fontSize: 11, letterSpacing: 0.6, marginTop: 6 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1 },
  groupText: { fontSize: 11, letterSpacing: 0.6 },
  editBar: { paddingLeft: 46, paddingBottom: 10, paddingTop: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
});
