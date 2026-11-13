import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  Data, addDays, bmrTdee, estimateTdee, etaToTarget, fmt, fmt1, keyToDate, logStreak, macroGoals, setWeight,
  todayKey, totals, waterStreak, weeklyRate, weightTrend,
} from '../data';
import { Btn, Card, Input, styles as ui, useTheme } from '../ui';

const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function ProgressScreen({ data, commit }: { data: Data; commit: (d: Data, msg?: string) => void }) {
  const c = useTheme();
  const tk = todayKey();
  const [w, setW] = useState('');
  useEffect(() => setW(data.weights[tk] != null ? fmt1(data.weights[tk]) : ''), [data.weights, tk]);

  const trend = weightTrend(data.weights);
  const rate = weeklyRate(trend);
  const cur = trend.length ? trend[trend.length - 1].trend : data.profile.weight;
  const target = data.profile.targetWeight;
  const eta = etaToTarget(cur, target, rate);
  const est = estimateTdee(data);
  const formula = bmrTdee(data.profile).tdee;

  const rows = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(tk, i - 6);
    return { key: k, label: DAYS[keyToDate(k).getDay()], ...totals(data, k) };
  });
  const logged = rows.filter((r) => r.cal > 0 || r.water > 0);
  const n = logged.length || 1;
  const avg = (k: 'cal' | 'p' | 'water') => logged.reduce((s, r) => s + r[k], 0) / n;

  const saveWeight = () => {
    const v = Number(w.replace(',', '.'));
    if (!(v >= 30 && v <= 300)) return;
    commit(setWeight(data, tk, v), `${fmt1(v)} kg kaydedildi`);
  };

  let loggedDays = 0;
  for (let i = 1; i <= 21; i++) if (totals(data, addDays(tk, -i)).cal >= 800) loggedDays++;

  const bars = (field: 'cal' | 'water', goal: number, color: string) => {
    const max = Math.max(goal * 1.15, ...rows.map((r) => r[field]));
    return (
      <View style={s.bars}>
        {rows.map((r) => (
          <View key={r.key} style={s.col}>
            <Text style={[s.val, { color: c.muted }]}>{r[field] ? fmt(r[field]) : ''}</Text>
            <View style={s.track}>
              <View style={[s.bar, { height: `${Math.max((r[field] / max) * 100, 1.5)}%`, backgroundColor: field === 'cal' && r.cal > goal ? c.over : color }]} />
              <View style={[s.goalTick, { bottom: `${(goal / max) * 100}%`, borderColor: c.muted }]} />
            </View>
            <Text style={[s.day, { color: c.muted }]}>{r.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={[ui.cardTitle, { color: c.text }]}>Kilo</Text>
          {rate != null && (
            <Text style={{ color: c.muted, fontVariant: ['tabular-nums'] }}>
              {rate > 0 ? '+' : rate < 0 ? '−' : ''}{fmt1(Math.abs(rate))} kg/hafta
            </Text>
          )}
        </View>
        <View style={ui.row}>
          <Input value={w} onChangeText={setW} placeholder={`Son: ${fmt1(data.profile.weight)} kg`} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Btn label="Kaydet" onPress={saveWeight} />
        </View>
        <WeightChart data={data} />
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {trend.length ? `Trend kilon ${fmt1(cur)} kg.` : 'Kilonu her gün girersen günlük dalgalanmalardan arındırılmış trendini gösteririm.'}
          {target ? ` Hedefe ${fmt1(Math.abs(target - cur))} kg var.` : ''}
          {eta ? ` Bu hızla ${eta} civarında ulaşırsın.` : ''}
        </Text>
      </Card>

      <Card title="Gerçek harcaman">
        {est ? (
          <>
            <View style={ui.row}>
              <Big value={fmt(est.tdee)} label="kcal/gün tahmini harcama" />
              <Big value={fmt(est.avgIntake)} label="kcal/gün ortalama alım" />
            </View>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              Son {est.days} günlük kayıtların ve kilo trendinden hesaplandı. Formülle bulunan değer {fmt(formula)} kcal idi.
            </Text>
            {Math.abs(est.suggestedCal - data.goals.cal) >= 50 ? (
              <Btn
                label={`Kalori hedefini ${fmt(est.suggestedCal)} kcal yap`}
                onPress={() => commit(
                  { ...data, goals: { ...data.goals, cal: est.suggestedCal, ...macroGoals(est.suggestedCal, data.profile.weight, data.profile.goal) } },
                  `Kalori hedefi ${fmt(est.suggestedCal)} kcal oldu`,
                )}
              />
            ) : (
              <Text style={{ color: c.muted, fontSize: 13 }}>Mevcut hedefin bu tahminle uyumlu.</Text>
            )}
          </>
        ) : (
          <>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
              Formüle göre günlük harcaman {fmt(formula)} kcal. Herkesin metabolizması farklıdır. En az 10 gün eksiksiz kayıt ve iki
              haftaya yayılmış tartılarla gerçek harcamanı hesaplayıp hedefini ona göre önereceğim.
            </Text>
            <Text style={{ color: c.leaf, fontWeight: '700' }}>
              Kayıtlı gün: {Math.min(loggedDays, 10)}/10 · Tartı: {Math.min(Object.keys(data.weights).length, 2)}/2
            </Text>
          </>
        )}
      </Card>

      <Card title="Son 7 gün: kalori">{bars('cal', data.goals.cal, c.leaf)}</Card>
      <Card title="Son 7 gün: su">{bars('water', data.goals.water, c.water)}</Card>
      <Card>
        <View style={s.stats}>
          <Stat value={fmt(avg('cal'))} label="ort. kcal / gün" />
          <Stat value={`${fmt(avg('p'))} g`} label="ort. protein / gün" />
          <Stat value={fmt(avg('water'))} label="ort. ml sıvı / gün" />
          <Stat value={`${rows.filter((r) => r.cal > 0 && r.cal <= data.goals.cal).length}/7`} label="kalori hedefinde" />
          <Stat value={String(waterStreak(data))} label="gün su serisi" />
          <Stat value={String(logStreak(data))} label="gün kayıt serisi" />
        </View>
      </Card>
    </View>
  );
}

function WeightChart({ data }: { data: Data }) {
  const c = useTheme();
  const trend = weightTrend(data.weights).slice(-60);
  if (trend.length < 2) {
    return (
      <Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 12, fontSize: 13 }}>
        Grafik için en az iki gün tartıl. Her sabah aynı koşullarda tartılmak en doğru sonucu verir.
      </Text>
    );
  }
  const W = 320, H = 150, L = 34, R = 8, T = 10, B = 22;
  const vals = trend.flatMap((p) => (p.raw != null ? [p.raw, p.trend] : [p.trend]));
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 2) { const mid = (max + min) / 2; min = mid - 1; max = mid + 1; }
  min = Math.floor(min * 2) / 2; max = Math.ceil(max * 2) / 2;
  const x = (i: number) => L + (i / (trend.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const target = data.profile.targetWeight;
  const short = (k: string) => keyToDate(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const d = trend.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join('');
  const last = trend[trend.length - 1];
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={undefined} style={{ aspectRatio: W / H }}>
      {[min, (min + max) / 2, max].map((v) => (
        <React.Fragment key={v}>
          <Line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} strokeWidth={1} />
          <SvgText x={L - 4} y={y(v) + 3} fill={c.muted} fontSize={9} textAnchor="end">{fmt1(v)}</SvgText>
        </React.Fragment>
      ))}
      {target && target >= min && target <= max ? (
        <>
          <Line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke={c.water} strokeWidth={1.2} strokeDasharray="4 3" />
          <SvgText x={W - R} y={y(target) - 3} fill={c.muted} fontSize={9} textAnchor="end">hedef</SvgText>
        </>
      ) : null}
      <SvgText x={L} y={H - 6} fill={c.muted} fontSize={9}>{short(trend[0].key)}</SvgText>
      <SvgText x={W - R} y={H - 6} fill={c.muted} fontSize={9} textAnchor="end">{short(last.key)}</SvgText>
      <Path d={d} stroke={c.leaf} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {trend.map((p, i) => (p.raw != null ? <Circle key={p.key} cx={x(i)} cy={y(p.raw)} r={2.6} fill={c.muted} opacity={0.55} /> : null))}
      <Circle cx={x(trend.length - 1)} cy={y(last.trend)} r={4} fill={c.leaf} stroke={c.card} strokeWidth={2} />
    </Svg>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  const c = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const c = useTheme();
  return (
    <View style={s.stat}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 170, paddingTop: 6 },
  col: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  track: { flex: 1, width: '100%', maxWidth: 34, justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  goalTick: { position: 'absolute', left: -3, right: -3, borderTopWidth: 1.5, borderStyle: 'dashed', opacity: 0.6 },
  val: { fontSize: 10, marginBottom: 2, height: 14 },
  day: { fontSize: 12, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  stat: { width: '33.33%', alignItems: 'center' },
});
