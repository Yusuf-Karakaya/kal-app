// Vücut: kas haritası, vücut kompozisyonu ve parametrik vücut prototipi (SVG)
import { Data, Measure, addDays, todayKey } from './model';
import { Focus, PROGRAMS, programIndex, resolveExercise } from './workout';

/* ===================== Kaslar ===================== */
export type Muscle =
  | 'chest' | 'shoulders' | 'traps' | 'upperback' | 'lowerback' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves';

export const MUSCLES: Record<Muscle, string> = {
  chest: 'Göğüs', shoulders: 'Omuz', traps: 'Trapez', upperback: 'Sırt (kanat)', lowerback: 'Bel',
  biceps: 'Biseps', triceps: 'Triseps', forearms: 'Ön kol', abs: 'Karın', obliques: 'Yan karın',
  glutes: 'Kalça', quads: 'Ön bacak', hamstrings: 'Arka bacak', adductors: 'İç bacak', calves: 'Baldır',
};
export const MUSCLE_ORDER = Object.keys(MUSCLES) as Muscle[];

/**
 * Hareket → kas katkısı. 1 = ana kas, 0,5 = yardımcı kas, 0,25 = mobilite/hafif.
 * "Etkili set" = yapılan set × katkı. EMOM gibi kısa setler 0,5 ile çarpılır.
 */
const MAP: Record<string, { m: Partial<Record<Muscle, number>>; f?: number }> = {
  'Tempolu Goblet Squat': { m: { quads: 1, glutes: 1, adductors: 0.5, abs: 0.5 } },
  'Tek Bacak RDL': { m: { hamstrings: 1, glutes: 1, lowerback: 0.5, forearms: 0.5 } },
  'Bulgarian Split Squat': { m: { quads: 1, glutes: 1, adductors: 0.5 } },
  'Tek Kol Swing': { m: { glutes: 1, hamstrings: 1, lowerback: 0.5, shoulders: 0.5, forearms: 0.5, obliques: 0.5 } },
  'Cossack Squat': { m: { adductors: 1, quads: 1, glutes: 0.5 } },
  'Tek Bacak Glute Bridge': { m: { glutes: 1, hamstrings: 0.5 } },
  'Tek Kol Floor Press': { m: { chest: 1, triceps: 1, shoulders: 0.5 } },
  'Tek Kol Row': { m: { upperback: 1, biceps: 0.5, traps: 0.5, forearms: 0.5 } },
  'Tek Kol Overhead Press': { m: { shoulders: 1, triceps: 0.5, traps: 0.5, obliques: 0.5 } },
  'Ayak Yüksek Push-up': { m: { chest: 1, shoulders: 0.5, triceps: 0.5, abs: 0.5 } },
  'Plank Pull-through': { m: { abs: 1, obliques: 1, shoulders: 0.5 } },
  'Kettlebell Pullover': { m: { upperback: 1, chest: 0.5, triceps: 0.5 } },
  'Tempolu Yürüyüş': { m: { calves: 0.5, quads: 0.25, glutes: 0.25 } },
  'Kettlebell Halo': { m: { shoulders: 0.5, abs: 0.25, traps: 0.25 } },
  '90/90 Kalça Geçişi': { m: { glutes: 0.25, adductors: 0.25 } },
  'Goblet Squat Bekleme': { m: { quads: 0.5, adductors: 0.5 } },
  'Cat-Cow + Thread the Needle': { m: { lowerback: 0.25, upperback: 0.25 } },
  'Tek Kol Clean & Press': { m: { shoulders: 1, glutes: 0.5, hamstrings: 0.5, triceps: 0.5, traps: 0.5 } },
  'Goblet Thruster': { m: { quads: 1, shoulders: 1, glutes: 0.5, triceps: 0.5 } },
  'Swing EMOM': { m: { glutes: 1, hamstrings: 1, lowerback: 0.5, forearms: 0.5 }, f: 0.5 },
  'Suitcase Carry': { m: { obliques: 1, forearms: 1, traps: 0.5 } },
  'Turkish Get-up': { m: { shoulders: 1, abs: 1, obliques: 0.5, glutes: 0.5 } },
  'Bottoms-up Carry': { m: { forearms: 1, shoulders: 0.5 } },
  'Dead Bug (KB tutarak)': { m: { abs: 1 } },
  'Wrist Curl': { m: { forearms: 1 } },
  'Reverse Wrist Curl': { m: { forearms: 1 } },
  'Hammer Curl': { m: { biceps: 1, forearms: 1 } },
  'Waiter Walk': { m: { shoulders: 1, traps: 0.5, abs: 0.5 } },
  'Swing → Clean → Press → Squat': { m: { glutes: 1, shoulders: 1, quads: 1, hamstrings: 0.5, forearms: 0.5 } },
  'Kettlebell Snatch': { m: { shoulders: 1, glutes: 0.5, hamstrings: 0.5, traps: 0.5, forearms: 0.5 } },
  'Burpee': { m: { chest: 0.5, quads: 0.5, shoulders: 0.5 } },
  'Hollow Hold': { m: { abs: 1 } },
  'Overhead Triceps Extension': { m: { triceps: 1 } },
  'Kettlebell High Pull': { m: { upperback: 1, traps: 1, shoulders: 0.5, biceps: 0.5 } },
  'Kettlebell Curl': { m: { biceps: 1, forearms: 0.5 } },
  'Close-grip Push-up': { m: { triceps: 1, chest: 0.5, shoulders: 0.5 } },
  'Clean → Press → Push-up': { m: { shoulders: 1, chest: 0.5, triceps: 0.5, forearms: 0.5, glutes: 0.25 } },
  'Goblet Squat (hafif)': { m: { quads: 1, glutes: 0.5 } },
};

/** Alt vücut kasları (üst vücut odağında büyütülmez, korunur) */
export const LOWER_BODY: Muscle[] = ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'];

export function musclesFor(exercise: string) {
  return MAP[exercise]?.m ?? {};
}

/** Kas başına haftalık hedef etkili set aralığı (kas gelişimi için yaygın öneri: 10–20) */
export const SET_TARGET = { min: 10, max: 20 };

const emptyVolume = () => Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<Muscle, number>;

/** Bir günde yapılan setlerden kas başına etkili set (hangi programla yapıldığından bağımsız) */
export function dayVolume(data: Data, key: string): Record<Muscle, number> {
  const out = emptyVolume();
  for (const [ek, arr] of Object.entries(data.workouts?.[key] ?? {})) {
    const x = resolveExercise(key, ek);
    const n = arr.filter(Boolean).length;
    const map = x && MAP[x.n];
    if (!map || !n) continue;
    for (const [m, w] of Object.entries(map.m) as [Muscle, number][]) out[m] += n * w * (map.f ?? 1);
  }
  return out;
}

/** Haftanın (Pzt–Paz) kas başına etkili seti */
export function weekVolume(data: Data, key = todayKey()): Record<Muscle, number> {
  const monday = addDays(key, -programIndex(key));
  const out = emptyVolume();
  for (let i = 0; i < 7; i++) {
    const v = dayVolume(data, addDays(monday, i));
    for (const m of MUSCLE_ORDER) out[m] += v[m];
  }
  return out;
}

/** Program eksiksiz yapılırsa kas başına haftalık etkili set */
export function plannedVolume(focus: Focus = 'balanced'): Record<Muscle, number> {
  const out = emptyVolume();
  PROGRAMS[focus].forEach((p) => (p.blocks ?? []).forEach((b) => b.ex.forEach((x) => {
    const map = MAP[x.n];
    if (!map) return;
    for (const [m, w] of Object.entries(map.m) as [Muscle, number][]) out[m] += x.s * w * (map.f ?? 1);
  })));
  return out;
}

/**
 * Kas gelişim düzeyi (0–1): son 4 haftanın ortalama haftalık etkili setinin 15'e oranı.
 * Prototipteki kas hacmi bununla şekillenir.
 */
export function development(data: Data, key = todayKey()): Record<Muscle, number> {
  const out = emptyVolume();
  for (let w = 0; w < 4; w++) {
    const v = weekVolume(data, addDays(key, -7 * w));
    for (const m of MUSCLE_ORDER) out[m] += v[m] / 4;
  }
  for (const m of MUSCLE_ORDER) out[m] = Math.min(1, out[m] / 15);
  return out;
}

export type VolumeStatus = 'none' | 'low' | 'building' | 'ideal' | 'high';
export function volumeStatus(sets: number): VolumeStatus {
  if (sets < 0.5) return 'none';
  if (sets < 4) return 'low';
  if (sets < SET_TARGET.min) return 'building';
  if (sets <= SET_TARGET.max) return 'ideal';
  return 'high';
}
export const STATUS_LABEL: Record<VolumeStatus, string> = {
  none: 'çalışılmadı', low: 'az', building: 'gelişiyor', ideal: 'ideal aralıkta', high: 'yüksek',
};

/** Bir kası en çok çalıştıran program hareketleri */
export function exercisesFor(muscle: Muscle, focus: Focus = 'balanced'): { name: string; day: string; weight: number }[] {
  const out: { name: string; day: string; weight: number }[] = [];
  PROGRAMS[focus].forEach((p) => (p.blocks ?? []).forEach((b) => b.ex.forEach((x) => {
    const w = MAP[x.n]?.m[muscle];
    if (w && w >= 0.5 && !out.some((o) => o.name === x.n)) out.push({ name: x.n, day: p.k, weight: w });
  })));
  return out.sort((a, b) => b.weight - a.weight);
}

/** Programın az çalıştırdığı kaslar için eklenebilecek hareketler */
export const EXTRA_SUGGEST: Partial<Record<Muscle, string>> = {
  calves: 'Programda baldır hareketi yok. Pazartesi sonuna tek bacak kettlebell calf raise ekle: 3 × 15 / bacak, üstte 1 sn bekle.',
  lowerback: 'Bel için Pazartesi ya da Perşembe sonuna 3 × 12 kettlebell good morning ya da superman ekleyebilirsin.',
  chest: 'Göğüs için Salı günü floor press setlerine 1 set ekle ya da push-up’ı 4 sete çıkar.',
  biceps: 'Biseps için Cuma hammer curl’e ek olarak 2 × 12 tek kol kettlebell curl ekleyebilirsin.',
};

/** Seçili programın az çalıştırdığı kaslar için öneriler (en fazla 3) */
export function muscleAdvice(data: Data): { muscle: Muscle; text: string }[] {
  const focus: Focus = data.programFocus ?? 'balanced';
  const planned = plannedVolume(focus);
  const out: { muscle: Muscle; text: string }[] = [];
  if (focus === 'upper') {
    out.push({ muscle: 'quads', text: 'Üst vücut odağındasın: bacaklar haftada birkaç setle yalnızca korunuyor. Bacakların, toplam yağ oranın düştükçe incelir; bölgesel yağ yakmak mümkün değil.' });
  }
  for (const m of MUSCLE_ORDER) {
    if (planned[m] >= SET_TARGET.min * 0.6) continue;
    if (focus === 'upper' && LOWER_BODY.includes(m)) continue;
    out.push({ muscle: m, text: EXTRA_SUGGEST[m] ?? `${MUSCLES[m]} programda az çalışılıyor (haftada ~${Math.round(planned[m])} set).` });
  }
  return out.slice(0, 3);
}

/* ===================== Vücut kompozisyonu ===================== */
export function latestMeasure(data: Data, until = todayKey()): { key: string; m: Measure } | null {
  const keys = Object.keys(data.measures ?? {}).filter((k) => k <= until).sort();
  if (!keys.length) return null;
  // Her alan için en güncel değeri birleştir
  const m: Measure = {};
  for (const k of keys) Object.assign(m, Object.fromEntries(Object.entries(data.measures![k]).filter(([, v]) => v != null && v > 0)));
  return { key: keys[keys.length - 1], m };
}

export function setMeasure(data: Data, key: string, m: Measure): Data {
  const clean = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'number' && v > 0)) as Measure;
  const measures = { ...(data.measures ?? {}) };
  if (Object.keys(clean).length) measures[key] = { ...(measures[key] ?? {}), ...clean };
  return { ...data, measures };
}

/** ABD Donanması çevre ölçüsü yöntemi (Hodgdon & Beckett, 1984) */
export function navyBodyFat(sex: 'f' | 'm', heightCm: number, m: Measure): number | null {
  const lg = Math.log10;
  if (!m.waist || !m.neck) return null;
  if (sex === 'm') {
    if (m.waist <= m.neck) return null;
    return 495 / (1.0324 - 0.19077 * lg(m.waist - m.neck) + 0.15456 * lg(heightCm)) - 450;
  }
  if (!m.hip || m.waist + m.hip <= m.neck) return null;
  return 495 / (1.29579 - 0.35004 * lg(m.waist + m.hip - m.neck) + 0.221 * lg(heightCm)) - 450;
}

/** Ölçü yoksa BMI'den kaba tahmin (Deurenberg, 1991) */
export function bmiBodyFat(sex: 'f' | 'm', age: number, bmi: number): number {
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'm' ? 1 : 0) - 5.4;
}

export interface Composition {
  bmi: number;
  bodyFat: number;
  /** Yağ oranı nereden geldi */
  source: 'navy' | 'bmi';
  fatKg: number;
  leanKg: number;
  /** Boya göre düzeltilmiş yağsız kütle indeksi */
  ffmi: number;
  /** Bel / boy oranı (ölçü varsa) */
  whtr: number | null;
  bmiLabel: string;
  fatLabel: string;
  whtrLabel: string | null;
}

export function composition(data: Data, weight = data.profile.weight): Composition {
  const p = data.profile;
  const h = p.height / 100;
  const bmi = weight / (h * h);
  const meas = latestMeasure(data)?.m ?? {};
  const navy = navyBodyFat(p.sex, p.height, meas);
  const bodyFat = Math.max(3, Math.min(60, navy ?? bmiBodyFat(p.sex, p.age, bmi)));
  const fatKg = (weight * bodyFat) / 100;
  const leanKg = weight - fatKg;
  const ffmi = leanKg / (h * h) + 6.1 * (1.8 - h);
  const whtr = meas.waist ? meas.waist / p.height : null;
  return {
    bmi, bodyFat, source: navy != null ? 'navy' : 'bmi', fatKg, leanKg, ffmi, whtr,
    bmiLabel: bmi < 18.5 ? 'zayıf' : bmi < 25 ? 'normal' : bmi < 30 ? 'fazla kilolu' : 'obez',
    fatLabel: fatCategory(p.sex, bodyFat),
    whtrLabel: whtr == null ? null : whtr < 0.4 ? 'çok ince' : whtr < 0.5 ? 'sağlıklı' : whtr < 0.6 ? 'artmış risk' : 'yüksek risk',
  };
}

/** ACE yağ oranı sınıfları */
export function fatCategory(sex: 'f' | 'm', bf: number): string {
  const t = sex === 'm' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (bf < t[0]) return 'temel yağ';
  if (bf < t[1]) return 'atletik';
  if (bf < t[2]) return 'fit';
  if (bf < t[3]) return 'ortalama';
  return 'yüksek';
}

/** Hedef kiloya yağsız kütle korunarak inilirse/çıkılırsa yağ oranı */
export function projectedBodyFat(c: Composition, targetWeight: number): number {
  return Math.max(4, Math.min(60, ((targetWeight - c.leanKg) / targetWeight) * 100));
}

/* ===================== Vücut prototipi (SVG) ===================== */
export interface FigureOptions {
  sex: 'f' | 'm';
  bodyFat: number;
  /** 0–1 kas gelişimi (şekil) */
  dev: Record<Muscle, number>;
  /** Bu haftanın etkili setleri (renk) */
  heat: Record<Muscle, number>;
  view: 'front' | 'back';
  /** Renkler (temaya göre) */
  colors: { skin: string; outline: string; none: string; low: string; building: string; ideal: string; high: string; text: string };
  /** Vurgulanan kas */
  selected?: Muscle | null;
  label?: string;
}

const avg = (...v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const n1 = (v: number) => Math.round(v * 10) / 10;

/** Parametreler: omuz, bel, kalça, kol ve bacak genişlikleri */
export function figureShape(o: Pick<FigureOptions, 'sex' | 'bodyFat' | 'dev'>) {
  const f = o.sex === 'f';
  const bf = Math.max(5, Math.min(45, o.bodyFat));
  const d = o.dev;
  const upper = avg(d.shoulders, d.chest, d.upperback);
  return {
    S: (f ? 40 : 46) + 9 * upper + (bf - 15) * 0.15, // omuz yarı genişliği
    W: (f ? 20 : 23) + Math.max(0, bf - 8) * 0.85 - 2 * d.abs, // bel
    H: (f ? 33 : 29) + bf * 0.3 + 2 * d.glutes, // kalça
    A: 7 + 4 * avg(d.biceps, d.triceps) + bf * 0.12, // üst kol
    F: 6 + 2.5 * d.forearms + bf * 0.05, // ön kol
    T: 12.5 + 5 * avg(d.quads, d.glutes, d.hamstrings) + bf * 0.2, // uyluk
    C: 7.5 + 2.5 * d.calves + bf * 0.07, // baldır
    belly: Math.max(0, bf - (f ? 25 : 18)) * 1.1, // karın çıkıntısı
  };
}

type Pt = [number, number];

/** Noktalardan geçen yumuşak kapalı eğri (Catmull-Rom → kübik Bézier) */
function smooth(pts: Pt[], closed = true): string {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const f = (p: Pt) => `${n1(p[0])},${n1(p[1])}`;
  let d = `M${f(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d + (closed ? ' Z' : '');
}

export function bodySvg(o: FigureOptions): string {
  const s = figureShape(o);
  const c = o.colors;
  const d = o.dev;
  const cx = 100;
  const id = (name: string) => `${name}-${o.view}`;
  // Sağ yarı için yazılan göreli noktaları (x: merkezden uzaklık) iki yana çevir
  const side = (pts: Pt[], g: number): Pt[] => pts.map(([x, y]) => [cx + g * x, y]);
  const both = (pts: Pt[]) => smooth(side(pts, 1)) + ' ' + smooth(side(pts, -1));
  /** Sağ yarı noktalarından tek parça simetrik şekil (üstten alta sağ, alttan üste sol) */
  const sym = (right: Pt[]) => smooth([...side(right, 1), ...side([...right].reverse(), -1)]);

  const fill = (m: Muscle) => {
    const st = volumeStatus(o.heat[m] ?? 0);
    return st === 'none' ? c.none : c[st];
  };
  const sel = (m: Muscle) => o.selected === m;
  const part = (m: Muscle, dPath: string) =>
    `<g data-muscle="${m}" style="cursor:pointer"><title>${MUSCLES[m]}</title>`
    + `<path d="${dPath}" fill="${fill(m)}" stroke="${sel(m) ? c.text : c.outline}" stroke-width="${sel(m) ? 2 : 0.6}" stroke-opacity="${sel(m) ? 1 : 0.7}" stroke-linejoin="round"/>`
    + `<path d="${dPath}" fill="url(#${id('gloss')})" pointer-events="none"/></g>`;

  // ---- Ölçüler ----
  const S = s.S, A = s.A, F = s.F, H = s.H, T = s.T, C = s.C;
  const wb = s.W + s.belly * 0.9; // karın hizasında yarı genişlik
  const nw = 7 + 1.5 * d.traps; // boyun
  const lx = H * 0.5 + 2; // bacak ekseni
  const lat = 3 * d.upperback;

  // ---- Silüet ----
  const torsoR: Pt[] = [
    [nw + 1, 52], [S - 7, 64], [S - 1, 72], [S - 6, 96], [S - 9 + lat, 116], [wb, 150], [H + 1, 178], [H, 196], [6, 207],
  ];
  const torso = smooth([...side(torsoR, 1), [cx, 210], ...side([...torsoR].reverse(), -1)]);
  const armR: Pt[] = [
    [S - 5, 66], [S + A * 0.95, 82], [S + A * 0.95 + 1, 114], [S + F * 0.9 + 6, 148], [S + F + 9, 170], [S + 14, 204],
    [S + 16, 215], [S + 11, 228], [S + 5.5, 216], [S + 6.5, 204], [S + F * 0.15, 172], [S - 2, 148], [S - A * 0.5 - 3, 112], [S - 8, 94],
  ];
  const legR: Pt[] = [
    [H, 186], [H + T * 0.12 + 1, 222], [lx + T * 0.62, 262], [lx + T * 0.45, 292], [lx + C + 1.5, 322], [lx + 5, 372],
    [lx + 10, 393], [lx - 5, 395], [lx - 4.5, 374], [lx - C * 0.75, 330], [lx - T * 0.42, 294], [3, 236], [1.5, 206],
  ];
  const head = smooth([[cx, 11], [cx + 10.5, 14.5], [cx + 14, 26], [cx + 12.5, 38], [cx + 7, 46.5], [cx, 49], [cx - 7, 46.5], [cx - 12.5, 38], [cx - 14, 26], [cx - 10.5, 14.5]]);
  const neck = smooth([[cx - nw, 40], [cx + nw, 40], [cx + nw + 1.5, 60], [cx - nw - 1.5, 60]]);
  const skinParts = [head, neck, torso, smooth(side(armR, 1)), smooth(side(armR, -1)), smooth(side(legR, 1)), smooth(side(legR, -1))];
  const skin = skinParts.map((p) =>
    `<path d="${p}" fill="${c.skin}" stroke="${c.outline}" stroke-width="0.9" stroke-linejoin="round"/>`
    + `<path d="${p}" fill="url(#${id('shade')})" pointer-events="none"/>`).join('');

  // ---- Kaslar ----
  const aw = Math.min(12, s.W * 0.45) + s.belly * 0.25; // karın kası yarı genişliği
  let muscles = '';
  let lines = '';
  const line = (dPath: string, op = 0.35) => `<path d="${dPath}" fill="none" stroke="${c.outline}" stroke-width="0.7" stroke-opacity="${op}" stroke-linecap="round"/>`;

  if (o.view === 'front') {
    muscles += part('traps', both([[nw, 50], [S - 8, 63], [S - 12, 67], [nw + 1, 58]]));
    muscles += part('chest', both([
      [1.5, 70], [S - 12, 68], [S - 5, 80], [S - 8, 94], [S - 15, 103 + 3 * d.chest], [8, 106 + 2 * d.chest], [1.5, 100],
    ]));
    muscles += part('shoulders', both([
      [S - 9, 66], [S - 2, 67], [S + A * 0.92 + 1.5 * d.shoulders, 82], [S + A * 0.75, 100], [S + 1, 106], [S - 5, 92],
    ]));
    muscles += part('biceps', both([
      [S - 3, 100], [S + A * 0.75 + 1, 106], [S + A * 0.8 + 1.5, 126], [S + 5, 145], [S - 2, 136], [S - A * 0.4 - 2, 118],
    ]));
    muscles += part('forearms', both([[S, 152], [S + F + 7, 162], [S + F + 7, 182], [S + 13, 202], [S + 7.5, 202], [S + F * 0.15 + 1, 176]]));
    // karın: 3 sıra paket + alt karın
    const rows: [number, number][] = [[108, 122], [124, 138], [140, 154]];
    let absD = '';
    for (const [y0, y1] of rows) {
      const y0b = y0 + s.belly * 0.1, y1b = y1 + s.belly * 0.15;
      absD += ' ' + both([[1.5, y0b], [aw, y0b + 1], [aw + 0.5, (y0b + y1b) / 2], [aw - 0.5, y1b], [1.5, y1b]]);
    }
    absD += ' ' + sym([[1.5, 156 + s.belly * 0.15], [aw - 1, 157 + s.belly * 0.2], [aw - 4, 176 + s.belly * 0.4], [2, 184 + s.belly * 0.4]]);
    muscles += part('abs', absD.trim());
    muscles += part('obliques', both([[aw + 1.5, 110], [S - 11, 112], [wb - 0.5, 146], [H - 3, 176], [aw + 2, 172]]));
    muscles += part('adductors', both([[2.5, 208], [lx - 4, 206], [lx - T * 0.3, 236], [lx - T * 0.38, 258], [4, 236]]));
    muscles += part('quads', both([
      [H - 3, 194], [H + T * 0.1, 224], [lx + T * 0.55, 262], [lx + T * 0.28, 288], [lx - T * 0.35, 290], [lx - T * 0.42, 268], [lx - T * 0.12, 232], [lx - 3, 204],
    ]));
    muscles += part('calves', both([[lx + C, 312], [lx + C + 1, 330], [lx + 3, 360], [lx - C * 0.6, 334], [lx - C * 0.7, 316], [lx + 1, 302]]));
    lines += line(`M${cx},72 V104`) + line(`M${cx},108 V${n1(180 + s.belly * 0.4)}`, 0.25);
    for (const g of [1, -1]) {
      lines += line(`M${n1(cx + g * (lx + 1))},226 Q${n1(cx + g * (lx + T * 0.1))},258 ${n1(cx + g * (lx - 1))},284`, 0.3); // ön bacak ayrımı
      lines += line(`M${n1(cx + g * (S - 3))},80 Q${n1(cx + g * (S + 2))},92 ${n1(cx + g * (S + 1))},104`, 0.3); // omuz-göğüs
      lines += line(`M${n1(cx + g * (lx - T * 0.3))},298 Q${n1(cx + g * (lx - 1))},304 ${n1(cx + g * (lx + T * 0.3))},298`, 0.3); // diz
    }
    lines += `<circle cx="${cx}" cy="${n1(146 + s.belly * 0.2)}" r="1.2" fill="${c.outline}" fill-opacity="0.5"/>`; // göbek
  } else {
    muscles += part('traps', sym([[0, 46], [nw + 2, 52], [S - 7, 65], [S - 12, 70], [10, 92], [0, 112]]));
    muscles += part('shoulders', both([
      [S - 9, 66], [S - 2, 67], [S + A * 0.92 + 1.5 * d.shoulders, 82], [S + A * 0.75, 100], [S + 1, 104], [S - 6, 90],
    ]));
    muscles += part('upperback', both([[6, 94], [S - 11, 80], [S - 7 + lat, 104], [wb - 1, 138], [11, 150], [4, 128]]));
    muscles += part('lowerback', both([[2, 138], [10, 136], [13, 160], [9, 182 + s.belly * 0.2], [2, 182 + s.belly * 0.2]]));
    muscles += part('triceps', both([
      [S - 3, 96], [S + A * 0.8 + 1, 102], [S + A * 0.8 + 1.5, 126], [S + 5, 146], [S - 1, 138], [S - A * 0.45 - 2, 114],
    ]));
    muscles += part('forearms', both([[S, 152], [S + F + 7, 162], [S + F + 7, 182], [S + 13, 202], [S + 7.5, 202], [S + F * 0.15 + 1, 176]]));
    const gb = 2 * d.glutes;
    muscles += part('glutes', both([[1.5, 180], [H * 0.6, 175], [H + 1 + gb * 0.5, 188], [H - 1 + gb * 0.5, 206 + gb], [H * 0.5, 214 + gb], [2, 207]]));
    muscles += part('hamstrings', both([
      [3, 216], [lx, 214], [H + T * 0.05, 232], [lx + T * 0.4, 272], [lx + 2, 290], [lx - T * 0.35, 284], [lx - T * 0.42, 252],
    ]));
    muscles += part('calves', both([[lx - C * 0.8, 300], [lx + C + 0.5, 300], [lx + C + 1.5, 322], [lx + 3, 354], [lx - C * 0.8, 328]]));
    lines += line(`M${cx},58 V186`, 0.35); // omurga
    for (const g of [1, -1]) {
      lines += line(`M${n1(cx + g * (lx + 1))},300 V330`, 0.3); // baldır başları
      lines += line(`M${n1(cx + g * (lx - 1))},244 Q${n1(cx + g * lx)},266 ${n1(cx + g * (lx + 1))},286`, 0.3); // arka bacak ayrımı
    }
  }

  const defs = `<defs>
    <radialGradient id="${id('gloss')}" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
    </radialGradient>
    <linearGradient id="${id('shade')}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000000" stop-opacity="0.16"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="0.7" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="${id('ground')}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  const ground = `<ellipse cx="${cx}" cy="398" rx="${n1(lx + 26)}" ry="7" fill="url(#${id('ground')})"/>`;
  const label = o.label ? `<text x="${cx}" y="414" text-anchor="middle" font-size="11" fill="${c.text}">${o.label}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 ${o.label ? 420 : 406}" role="img" aria-label="${o.view === 'front' ? 'Önden' : 'Arkadan'} vücut prototipi">`
    + defs + ground + skin + muscles + lines + label + '</svg>';
}
