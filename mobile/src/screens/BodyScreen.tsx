import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  Data, EXTRA_SUGGEST, MUSCLES, MUSCLE_ORDER, Measure, Muscle, SET_TARGET, STATUS_LABEL, bodySvg, composition, development,
  exercisesFor, fmt1, latestMeasure, muscleAdvice, plannedVolume, projectedBodyFat, setMeasure, todayKey, volumeStatus, weekVolume,
} from '../data';
import { Btn, Card, Input, Segmented, styles as ui, useTheme } from '../ui';

const HEAT = {
  light: { skin: '#efe6dc', outline: '#a79c92', none: '#e3dad0', low: '#cfe6d6', building: '#7fbf95', ideal: '#2f7d4f', high: '#c98a1f' },
  dark: { skin: '#2c2a27', outline: '#5d5650', none: '#3a3631', low: '#29453a', building: '#3f8d5f', ideal: '#5cbf84', high: '#e3a640' },
};
type Field = keyof Measure;
const FIELDS: [Field, string][] = [['waist', 'Bel'], ['neck', 'Boyun'], ['hip', 'Kalça'], ['chest', 'Göğüs'], ['arm', 'Pazı'], ['thigh', 'Uyluk']];

export default function BodyScreen({ data, commit }: { data: Data; commit: (d: Data, msg?: string) => void }) {
  const c = useTheme();
  const scheme = useColorScheme();
  const [mode, setMode] = useState<'now' | 'goal'>('now');
  const [selected, setSelected] = useState<Muscle | null>(null);
  const last = latestMeasure(data)?.m ?? {};
  const [form, setForm] = useState<Record<Field, string>>(
    Object.fromEntries(FIELDS.map(([k]) => [k, last[k] ? fmt1(last[k]!) : ''])) as Record<Field, string>,
  );

  const comp = composition(data);
  const week = useMemo(() => weekVolume(data), [data]);
  const planned = useMemo(() => plannedVolume(data.programFocus ?? 'balanced'), [data.programFocus]);
  const target = data.profile.targetWeight;
  const goal = mode === 'goal';
  const bf = goal && target ? projectedBodyFat(comp, target) : comp.bodyFat;
  const dev = goal
    ? (Object.fromEntries(MUSCLE_ORDER.map((m) => [m, Math.min(1, planned[m] / 15)])) as Record<Muscle, number>)
    : development(data);
  const heat = goal ? planned : week;
  const colors = { ...(scheme === 'dark' ? HEAT.dark : HEAT.light), text: c.text };
  const svg = (view: 'front' | 'back') => bodySvg({ sex: data.profile.sex, bodyFat: bf, dev, heat, view, colors, selected });
  const advice = muscleAdvice(data);
  const male = data.profile.sex === 'm';

  const save = () => {
    const m: Measure = {};
    for (const [k] of FIELDS) {
      const v = Number(form[k].replace(',', '.'));
      if (v > 0 && v < 300) m[k] = v;
    }
    if (!Object.keys(m).length) return Alert.alert('Ölçü yok', 'En az bir ölçü gir.');
    if (m.waist && m.neck && m.neck >= m.waist) return Alert.alert('Ölçü hatalı', 'Boyun ölçüsü belden küçük olmalı.');
    commit(setMeasure(data, todayKey(), m), 'Ölçüler kaydedildi');
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <View style={s.head}>
          <Text style={[ui.cardTitle, { color: c.text }]}>Vücut prototipin</Text>
          <Text style={{ color: c.muted }}>%{fmt1(bf)} yağ{comp.source === 'bmi' && !goal ? ' (tahmini)' : ''}</Text>
        </View>
        <Segmented options={[{ value: 'now' as const, label: 'Şimdi' }, { value: 'goal' as const, label: 'Hedef' }]} value={mode} onChange={setMode} />
        <View style={s.figures}>
          {(['front', 'back'] as const).map((v) => (
            <View key={v} style={{ flex: 1, alignItems: 'center' }}>
              <SvgXml xml={svg(v)} width="100%" height={undefined} style={{ aspectRatio: 0.52 }} />
              <Text style={{ color: c.muted, fontSize: 11, letterSpacing: 0.8 }}>{v === 'front' ? 'ÖNDEN' : 'ARKADAN'}</Text>
            </View>
          ))}
        </View>
        <View style={s.legend}>
          {(['none', 'low', 'building', 'ideal', 'high'] as const).map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors[k] }} />
              <Text style={{ color: c.muted, fontSize: 11 }}>{k === 'none' ? 'çalışılmadı' : k === 'ideal' ? 'ideal' : STATUS_LABEL[k]}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>
          {goal
            ? target
              ? `Hedef: ${fmt1(target)} kg, yağsız kütle korunursa yaklaşık %${fmt1(bf)} yağ. Program her hafta eksiksiz yapılırsa kaslar bu renklere ulaşır.`
              : "Ayarlar'dan hedef kilonu girersen o kilodaki görünümünü gösteririm."
            : `Şekil son 4 haftadaki antrenmanlarına ve yağ oranına, renkler bu haftaki etkili setlere göre. Aşağıdan bir kas seç.${comp.measuredOn ? ` Son bel ölçünden (${fmt1(comp.measuredOn.kg)} kg, %${fmt1(comp.measuredOn.bodyFat)}) bu yana kilo değişimi yağ olarak sayıldı; yeni bel ölçüsü girersen kesinleşir.` : ''}`}
        </Text>
        {selected && (
          <View style={[s.detail, { backgroundColor: c.sunk }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{MUSCLES[selected]}</Text>
            <Text style={{ color: c.text }}>
              Bu hafta {fmt1(week[selected])} etkili set ({STATUS_LABEL[volumeStatus(week[selected])]}). Program eksiksiz yapılırsa haftada {fmt1(planned[selected])} set.
            </Text>
            {exercisesFor(selected, data.programFocus ?? 'balanced').slice(0, 5).map((e) => (
              <Text key={e.name} style={{ color: c.muted, fontSize: 13 }}>• {e.name} ({e.day}{e.weight < 1 ? ', yardımcı' : ''})</Text>
            ))}
            {EXTRA_SUGGEST[selected] && planned[selected] < 6 ? <Text style={{ color: c.text, fontSize: 13 }}>{EXTRA_SUGGEST[selected]}</Text> : null}
          </View>
        )}
      </Card>

      <Card>
        <View style={s.head}>
          <Text style={[ui.cardTitle, { color: c.text }]}>Kaslar: bu hafta</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>hedef 10–20 set</Text>
        </View>
        {MUSCLE_ORDER.map((m) => {
          const v = week[m];
          const st = volumeStatus(v);
          const max = 30;
          return (
            <Pressable key={m} onPress={() => setSelected(selected === m ? null : m)} style={[s.mRow, { borderColor: c.line }]}
              accessibilityState={{ selected: selected === m }}>
              <Text style={{ color: selected === m ? c.leaf : c.text, fontWeight: '600', width: 88, fontSize: 13 }}>{MUSCLES[m]}</Text>
              <View style={[s.track, { backgroundColor: c.sunk }]}>
                <View style={[s.band, { left: `${(SET_TARGET.min / max) * 100}%`, width: `${((SET_TARGET.max - SET_TARGET.min) / max) * 100}%`, backgroundColor: c.leafSoft }]} />
                <View style={[s.fill, { width: `${Math.min(1, v / max) * 100}%`, backgroundColor: st === 'none' ? 'transparent' : colors[st] }]} />
              </View>
              <Text style={{ color: c.muted, fontSize: 11, width: 92, textAlign: 'right' }}>{fmt1(v)} set · {STATUS_LABEL[st]}</Text>
            </Pressable>
          );
        })}
        {advice.map((a) => (
          <View key={a.muscle} style={[s.advice, { borderLeftColor: c.water, backgroundColor: c.sunk }]}>
            <Text style={{ color: c.text, fontSize: 13 }}>{a.text}</Text>
          </View>
        ))}
      </Card>

      <Card title="Vücut ölçülerin">
        <View style={s.comp}>
          <Stat value={`%${fmt1(comp.bodyFat)}`} label={`yağ oranı${comp.source === 'bmi' ? ' (tahmini)' : comp.source === 'navy-weight' ? ' (ölçü + kilo)' : ''}`} tag={comp.fatLabel} />
          <Stat value={`${fmt1(comp.leanKg)} kg`} label="yağsız kütle" tag={`yağ ${fmt1(comp.fatKg)} kg`} />
          <Stat value={fmt1(comp.bmi)} label="beden kitle indeksi" tag={comp.bmiLabel} />
          <Stat value={fmt1(comp.ffmi)} label="FFMI (kas indeksi)" tag={comp.ffmi < (male ? 18 : 14) ? 'düşük' : comp.ffmi < (male ? 22 : 17) ? 'ortalama' : 'kaslı'} />
          <Stat value={comp.whtr ? (Math.round(comp.whtr * 100) / 100).toLocaleString('tr-TR') : '—'} label="bel / boy" tag={comp.whtrLabel ?? 'beli ölç'} />
          <Stat value={`${fmt1(data.profile.weight)} kg`} label="kilo" tag={target ? `hedef ${fmt1(target)} kg` : ''} />
        </View>
        <View style={s.formGrid}>
          {FIELDS.map(([k, label]) => (
            <View key={k} style={{ width: '31%' }}>
              <Text style={[ui.label, { color: c.muted }]}>{label} (cm)</Text>
              <Input value={form[k]} onChangeText={(t) => setForm((f) => ({ ...f, [k]: t }))} keyboardType="decimal-pad" />
            </View>
          ))}
        </View>
        <Btn label="Ölçüleri kaydet" onPress={save} />
        <Text style={{ color: c.muted, fontSize: 12 }}>
          Sabah, aç karnına, mezurayı sıkmadan ölç. Yağ oranı bel ve boyundan (kadınlarda kalça da) ABD Donanması yöntemiyle hesaplanır; ölçü girmezsen boy-kilodan kaba tahmin yapılır.
        </Text>
      </Card>
    </View>
  );
}

function Stat({ value, label, tag }: { value: string; label: string; tag: string }) {
  const c = useTheme();
  return (
    <View style={{ width: '33.33%', paddingVertical: 6 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text>
      {tag ? <Text style={{ color: c.leaf, fontSize: 11, fontWeight: '700' }}>{tag}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  figures: { flexDirection: 'row', gap: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  detail: { borderRadius: 12, padding: 12, gap: 4 },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  advice: { borderLeftWidth: 4, borderRadius: 10, padding: 10, marginTop: 6 },
  comp: { flexDirection: 'row', flexWrap: 'wrap' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
});
