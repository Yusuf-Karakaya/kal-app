// Tema ve ortak arayüz bileşenleri
import React, { createContext, useContext } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const light = {
  bg: '#f3f5f1', card: '#ffffff', sunk: '#eef1ec', text: '#1c2420', muted: '#66716b', line: '#e1e6df',
  leaf: '#2f7d4f', leafSoft: '#e1efe5', water: '#1b7fbf', waterSoft: '#ddeef9', over: '#c2412d', onAccent: '#ffffff',
  protein: '#b4562f', carb: '#c99a1e', fat: '#7a5bb5', warn: '#c99a1e',
};
export const dark: typeof light = {
  bg: '#111613', card: '#1a201c', sunk: '#141a16', text: '#e6ebe7', muted: '#94a199', line: '#29312c',
  leaf: '#5cbf84', leafSoft: '#1d3326', water: '#5bb6ec', waterSoft: '#15303f', over: '#ef7a63', onAccent: '#111613',
  protein: '#ef8d66', carb: '#e3bd4f', fat: '#a98be0', warn: '#e3bd4f',
};
export type Theme = typeof light;
export const ThemeContext = createContext<Theme>(light);
export const useTheme = () => useContext(ThemeContext);

export function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card }, style]}>
      {title ? <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

type BtnKind = 'primary' | 'ghost' | 'danger' | 'water';
export function Btn({ label, sub, onPress, kind = 'primary', style }: {
  label: string; sub?: string; onPress: () => void; kind?: BtnKind; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const bg = { primary: c.leaf, ghost: c.leafSoft, danger: 'transparent', water: c.waterSoft }[kind];
  const fg = { primary: c.onAccent, ghost: c.leaf, danger: c.over, water: c.water }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: kind === 'danger' ? c.over : 'transparent', opacity: pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
      {sub ? <Text style={[styles.btnSub, { color: fg }]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const c = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      style={[styles.input, { backgroundColor: c.sunk, borderColor: c.line, color: c.text }, props.style]}
    />
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: c.sunk, borderColor: c.line }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && { backgroundColor: c.card }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={{ color: active ? c.leaf : c.muted, fontWeight: active ? '700' : '500', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Ring({ ratio, color, value, unit, label, sub }: {
  ratio: number; color: string; value: string; unit: string; label: string; sub: string;
}) {
  const c = useTheme();
  const r = 50;
  const len = 2 * Math.PI * r;
  return (
    <View style={[styles.ringCard, { backgroundColor: c.card }]}>
      <View style={styles.ringWrap}>
        <Svg viewBox="0 0 120 120" width="100%" height="100%" style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={60} cy={60} r={r} stroke={c.line} strokeWidth={10} fill="none" />
          <Circle
            cx={60} cy={60} r={r} stroke={color} strokeWidth={10} fill="none" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len * (1 - Math.min(Math.max(ratio, 0), 1))}
          />
        </Svg>
        <View style={styles.ringText}>
          <Text style={[styles.ringValue, { color: c.text }]}>{value}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{unit}</Text>
        </View>
      </View>
      <Text style={[styles.ringLabel, { color: c.text }]}>{label}</Text>
      <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{sub}</Text>
    </View>
  );
}

export function MacroBars({ values, goals }: { values: { p: number; c: number; f: number }; goals: { p: number; c: number; f: number } }) {
  const c = useTheme();
  const rows: [keyof typeof values, string, string][] = [['p', 'Protein', c.protein], ['c', 'Karbonhidrat', c.carb], ['f', 'Yağ', c.fat]];
  return (
    <View style={[styles.card, { backgroundColor: c.card, flexDirection: 'row', gap: 14 }]}>
      {rows.map(([k, label, color]) => {
        const ratio = goals[k] ? values[k] / goals[k] : 0;
        return (
          <View key={k} style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
            <Text style={{ color: c.muted, fontSize: 12, fontVariant: ['tabular-nums'], marginBottom: 6 }}>
              {Math.round(values[k])} / {Math.round(goals[k])} g
            </Text>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: ratio > 1.1 ? c.over : color, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function Chip({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, { borderColor: c.line, backgroundColor: c.sunk, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={1}>
        {label}
        {sub ? <Text style={{ color: c.muted }}> {sub}</Text> : null}
      </Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, maxWidth: '100%' },
  card: { borderRadius: 18, padding: 16, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  btn: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnText: { fontWeight: '700', fontSize: 15 },
  btnSub: { fontSize: 12, opacity: 0.8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minWidth: 0 },
  seg: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  ringCard: { flex: 1, borderRadius: 18, padding: 12, alignItems: 'center' },
  ringWrap: { width: '100%', maxWidth: 150, aspectRatio: 1 },
  ringText: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLabel: { fontWeight: '700', marginTop: 6 },
  row: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 13, marginBottom: 4 },
});
