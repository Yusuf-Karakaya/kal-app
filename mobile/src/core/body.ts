// Vücut: kas haritası, vücut kompozisyonu ve parametrik vücut prototipi (SVG)
import { Data, Measure, addDays, todayKey } from './model';
import { PROGRAM, exKey, programFor, programIndex } from './workout';

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
  'Kettlebell Snatch': { m: { shoulders: 1, glutes: 1, hamstrings: 0.5, traps: 0.5, forearms: 0.5 } },
  'Burpee': { m: { chest: 0.5, quads: 0.5, shoulders: 0.5 } },
  'Hollow Hold': { m: { abs: 1 } },
};

export function musclesFor(exercise: string) {
  return MAP[exercise]?.m ?? {};
}

/** Kas başına haftalık hedef etkili set aralığı (kas gelişimi için yaygın öneri: 10–20) */
export const SET_TARGET = { min: 10, max: 20 };

const emptyVolume = () => Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<Muscle, number>;

/** Bir günde yapılan setlerden kas başına etkili set */
export function dayVolume(data: Data, key: string): Record<Muscle, number> {
  const out = emptyVolume();
  const p = programFor(key);
  const sets = data.workouts?.[key] ?? {};
  (p.blocks ?? []).forEach((b, bi) => b.ex.forEach((x, ei) => {
    const n = (sets[exKey(bi, ei)] ?? []).filter(Boolean).length;
    if (!n) return;
    const map = MAP[x.n];
    if (!map) return;
    for (const [m, w] of Object.entries(map.m) as [Muscle, number][]) out[m] += n * w * (map.f ?? 1);
  }));
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
export function plannedVolume(): Record<Muscle, number> {
  const out = emptyVolume();
  PROGRAM.forEach((p) => (p.blocks ?? []).forEach((b) => b.ex.forEach((x) => {
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
export function exercisesFor(muscle: Muscle): { name: string; day: string; weight: number }[] {
  const out: { name: string; day: string; weight: number }[] = [];
  PROGRAM.forEach((p) => (p.blocks ?? []).forEach((b) => b.ex.forEach((x) => {
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

/** Haftalık hacmi düşük kaslar için öneri metinleri (en fazla 3) */
export function muscleAdvice(data: Data, key = todayKey()): { muscle: Muscle; text: string }[] {
  const planned = plannedVolume();
  const out: { muscle: Muscle; text: string }[] = [];
  for (const m of MUSCLE_ORDER) {
    if (planned[m] >= SET_TARGET.min * 0.6) continue;
    out.push({ muscle: m, text: EXTRA_SUGGEST[m] ?? `${MUSCLES[m]} programda az çalışılıyor (haftada ~${Math.round(planned[m])} set).` });
  }
  void data; void key;
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

export function bodySvg(o: FigureOptions): string {
  const s = figureShape(o);
  const c = o.colors;
  const cx = 100;
  const fill = (m: Muscle) => {
    const st = volumeStatus(o.heat[m] ?? 0);
    return st === 'none' ? c.none : c[st];
  };
  const stroke = (m: Muscle) => (o.selected === m ? `stroke="${c.text}" stroke-width="2.2"` : `stroke="${c.outline}" stroke-width="0.8"`);
  const part = (m: Muscle, shape: string) => `<g data-muscle="${m}" ${stroke(m)} fill="${fill(m)}" style="cursor:pointer"><title>${MUSCLES[m]}</title>${shape}</g>`;
  const mirror = (fn: (sign: number) => string) => fn(-1) + fn(1);
  const ell = (x: number, y: number, rx: number, ry: number, rot = 0) =>
    `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(rx)}" ry="${n1(ry)}"${rot ? ` transform="rotate(${rot} ${n1(x)} ${n1(y)})"` : ''}/>`;

  // Gövde silüeti (deri)
  const wb = s.W + s.belly * 0.9; // karın hizasında genişlik
  const torso = `M${n1(cx - s.S + 6)},66 C${n1(cx - s.S - 2)},74 ${n1(cx - s.W - 6)},104 ${n1(cx - wb)},148 `
    + `C${n1(cx - wb - 1)},168 ${n1(cx - s.H - 2)},176 ${n1(cx - s.H)},194 L${n1(cx + s.H)},194 `
    + `C${n1(cx + s.H + 2)},176 ${n1(cx + wb + 1)},168 ${n1(cx + wb)},148 `
    + `C${n1(cx + s.W + 6)},104 ${n1(cx + s.S + 2)},74 ${n1(cx + s.S - 6)},66 Z`;
  const skin = `fill="${c.skin}" stroke="${c.outline}" stroke-width="1"`;
  let base = `<circle cx="${cx}" cy="32" r="17" ${skin}/>`
    + `<rect x="${cx - 8}" y="46" width="16" height="16" rx="5" ${skin}/>`
    + `<path d="${torso}" ${skin}/>`
    // kollar
    + mirror((g) => ell(cx + g * (s.S + 3), 108, s.A + 1, 30, g * -6) + ell(cx + g * (s.S + 9), 160, s.F + 1, 26, g * -4) + ell(cx + g * (s.S + 12), 192, 6, 8))
    // bacaklar
    + mirror((g) => ell(cx + g * (s.H * 0.5), 240, s.T + 1, 50) + ell(cx + g * (s.H * 0.5 + 1), 322, s.C + 1, 36) + ell(cx + g * (s.H * 0.5 + 3), 364, 9, 5));
  base = base.replace(/<ellipse /g, `<ellipse ${skin} `);

  let muscles = '';
  if (o.view === 'front') {
    muscles += part('traps', mirror((g) => `<path d="M${cx + g * 9},56 L${n1(cx + g * (s.S - 10))},66 L${cx + g * 9},64 Z"/>`));
    muscles += part('shoulders', mirror((g) => ell(cx + g * (s.S - 3), 78, 10 + 3 * o.dev.shoulders, 13)));
    muscles += part('chest', mirror((g) => `<path d="M${cx + g * 2},70 L${n1(cx + g * (s.S - 12))},70 Q${n1(cx + g * (s.S - 6))},92 ${n1(cx + g * (s.S - 14))},104 Q${cx + g * 14},${n1(110 + 3 * o.dev.chest)} ${cx + g * 2},104 Z"/>`));
    muscles += part('biceps', mirror((g) => ell(cx + g * (s.S + 4), 110, s.A, 18, g * -6)));
    muscles += part('forearms', mirror((g) => ell(cx + g * (s.S + 9), 160, s.F, 22, g * -4)));
    muscles += part('abs', `<rect x="${n1(cx - Math.min(13, s.W * 0.5) - s.belly * 0.3)}" y="110" width="${n1(2 * Math.min(13, s.W * 0.5) + s.belly * 0.6)}" height="${n1(60 + s.belly * 0.4)}" rx="${n1(6 + s.belly * 0.5)}"/>`
      + `<path d="M${cx},112 V${n1(168 + s.belly * 0.4)} M${n1(cx - 12)},128 H${n1(cx + 12)} M${n1(cx - 12)},144 H${n1(cx + 12)} M${n1(cx - 12)},158 H${n1(cx + 12)}" fill="none" stroke="${c.outline}" stroke-width="0.8"/>`);
    muscles += part('obliques', mirror((g) => `<path d="M${n1(cx + g * Math.min(14, s.W * 0.5 + 1))},112 L${n1(cx + g * (s.W + 1))},116 Q${n1(cx + g * (wb - 2))},146 ${n1(cx + g * (wb - 4))},162 L${n1(cx + g * Math.min(14, s.W * 0.5 + 1))},172 Z"/>`));
    muscles += part('adductors', mirror((g) => ell(cx + g * 6, 214, 5, 22, g * 8)));
    muscles += part('quads', mirror((g) => ell(cx + g * (s.H * 0.5 + 1), 240, s.T - 1, 44)));
    muscles += part('calves', mirror((g) => ell(cx + g * (s.H * 0.5 + 3), 322, s.C * 0.6, 28)));
  } else {
    muscles += part('traps', `<path d="M${cx},50 L${n1(cx + s.S - 10)},68 L${cx},104 L${n1(cx - s.S + 10)},68 Z"/>`);
    muscles += part('shoulders', mirror((g) => ell(cx + g * (s.S - 3), 78, 10 + 3 * o.dev.shoulders, 12)));
    muscles += part('upperback', mirror((g) => `<path d="M${cx + g * 4},92 L${n1(cx + g * (s.S - 8))},84 Q${n1(cx + g * (s.S - 4 + 3 * o.dev.upperback))},110 ${n1(cx + g * (s.W + 1))},140 L${cx + g * 4},140 Z"/>`));
    muscles += part('lowerback', `<rect x="${cx - 13}" y="142" width="26" height="${n1(26 + s.belly * 0.2)}" rx="5"/>`);
    muscles += part('triceps', mirror((g) => ell(cx + g * (s.S + 4), 108, s.A, 19, g * -6)));
    muscles += part('forearms', mirror((g) => ell(cx + g * (s.S + 9), 160, s.F, 22, g * -4)));
    muscles += part('glutes', mirror((g) => ell(cx + g * (s.H * 0.45), 196, s.H * 0.5 + 2 * o.dev.glutes, 17)));
    muscles += part('hamstrings', mirror((g) => ell(cx + g * (s.H * 0.5 + 1), 252, s.T - 2, 36)));
    muscles += part('calves', mirror((g) => ell(cx + g * (s.H * 0.5 + 1), 318, s.C, 30)));
  }

  const label = o.label ? `<text x="${cx}" y="392" text-anchor="middle" font-size="11" fill="${c.text}">${o.label}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400" role="img" aria-label="${o.view === 'front' ? 'Önden' : 'Arkadan'} vücut prototipi">${base}${muscles}${label}</svg>`;
}
