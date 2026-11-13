// Vücut: kas haritası, vücut kompozisyonu ve parametrik vücut prototipi (SVG)
import { Data, Measure, addDays, daysBetween, todayKey } from './model';
import { ANATOMY } from './anatomy';
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
  /** Yağ oranı nereden geldi: çevre ölçüsü, ölçü + sonraki kilo değişimi ya da boy-kilo tahmini */
  source: 'navy' | 'navy-weight' | 'bmi';
  /** source 'navy-weight' ise: ölçünün alındığı gün ve o günkü kilo */
  measuredOn?: { key: string; kg: number; bodyFat: number };
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
  let bodyFat = Math.max(3, Math.min(60, navy ?? bmiBodyFat(p.sex, p.age, bmi)));
  let source: Composition['source'] = navy != null ? 'navy' : 'bmi';
  let measuredOn: Composition['measuredOn'];
  // Ölçüden sonra kilo değiştiyse: yağsız kütle o günkü gibi kabul edilir, değişim yağdan sayılır
  if (navy != null) {
    const mKey = Object.keys(data.measures ?? {}).filter((k) => data.measures![k].waist).sort().pop();
    const wKeys = Object.keys(data.weights).sort();
    const lastW = wKeys[wKeys.length - 1];
    const atMeasure = mKey ? [...wKeys].reverse().find((k) => k <= mKey) ?? wKeys.find((k) => k > mKey && daysBetween(mKey, k) <= 3) : undefined;
    if (mKey && atMeasure && lastW && lastW > mKey && Math.abs(data.weights[atMeasure] - weight) >= 0.1) {
      const kg0 = data.weights[atMeasure];
      const lean = kg0 * (1 - bodyFat / 100);
      measuredOn = { key: mKey, kg: kg0, bodyFat };
      bodyFat = Math.max(3, Math.min(60, ((weight - lean) / weight) * 100));
      source = 'navy-weight';
    }
  }
  const fatKg = (weight * bodyFat) / 100;
  const leanKg = weight - fatKg;
  const ffmi = leanKg / (h * h) + 6.1 * (1.8 - h);
  const whtr = meas.waist ? meas.waist / p.height : null;
  return {
    bmi, bodyFat, source, measuredOn, fatKg, leanKg, ffmi, whtr,
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

const n1 = (v: number) => Math.round(v * 10) / 10;

/** Çizimdeki kas adlarının uygulamadaki kas grupları */
const SLUG: Record<string, Muscle> = {
  chest: 'chest', obliques: 'obliques', abs: 'abs', biceps: 'biceps', triceps: 'triceps', deltoids: 'shoulders',
  trapezius: 'traps', 'upper-back': 'upperback', 'lower-back': 'lowerback', forearm: 'forearms', gluteal: 'glutes',
  hamstring: 'hamstrings', quadriceps: 'quads', adductors: 'adductors', calves: 'calves', tibialis: 'calves',
};
/** Karın ve bel bölgesi: yağ oranı yükseldikçe ayrıca genişler */
const BELLY = new Set(['abs', 'obliques', 'lower-back']);

/** Yağ oranına göre vücut genişlik katsayıları */
export function figureScale(bodyFat: number) {
  const bf = Math.max(5, Math.min(45, bodyFat));
  return {
    body: Math.max(0.9, Math.min(1.32, 1 + (bf - 15) * 0.011)),
    belly: 1 + Math.max(0, bf - 20) * 0.012,
  };
}

/**
 * Anatomik vücut prototipi (SVG). Kaslar haftalık sete göre renklenir; vücut genişliği yağ oranıyla,
 * kas hacmi son 4 haftanın gelişimiyle değişir. Çizimler: react-native-body-highlighter (MIT).
 */
export function bodySvg(o: FigureOptions): string {
  const fig = ANATOMY[o.sex === 'f' ? 'female' : 'male'][o.view];
  const c = o.colors;
  const id = (name: string) => `${name}-${o.sex}-${o.view}`;
  const k = figureScale(o.bodyFat);
  const cx = fig.cx;
  const sx = (f: number) => `translate(${cx} 0) scale(${n1(f * 1000) / 1000} 1) translate(${-cx} 0)`;

  const fill = (m: Muscle) => {
    const st = volumeStatus(o.heat[m] ?? 0);
    return st === 'none' ? c.none : c[st];
  };

  // Kas gruplarına göre topla (tıklama tüm grubu seçer)
  const groups = new Map<Muscle, string[]>();
  let skin = '';
  let head = '';
  for (const [slug, , d, pcx, pcy] of fig.parts) {
    const m = SLUG[slug];
    if (!m) {
      const p = `<path d="${d}" fill="${slug === 'hair' ? c.outline : c.skin}"/>`;
      if (slug === 'head' || slug === 'hair') head += p;
      else skin += p;
      continue;
    }
    const bulge = 1 + 0.07 * (o.dev[m] ?? 0);
    const belly = BELLY.has(slug) ? k.belly : 1;
    const tr = `translate(${pcx} ${pcy}) scale(${n1(bulge * belly * 1000) / 1000} ${n1(bulge * 1000) / 1000}) translate(${-pcx} ${-pcy})`;
    const sel = o.selected === m;
    const path = `<g transform="${tr}"><path d="${d}" fill="${fill(m)}" stroke="${sel ? c.text : c.outline}" stroke-width="${sel ? 5 : 1.4}" stroke-opacity="${sel ? 1 : 0.55}" stroke-linejoin="round"/>`
      + `<path d="${d}" fill="url(#${id('gloss')})" pointer-events="none"/></g>`;
    groups.set(m, [...(groups.get(m) ?? []), path]);
  }
  let muscles = '';
  for (const [m, paths] of groups) {
    muscles += `<g data-muscle="${m}" style="cursor:pointer"><title>${MUSCLES[m]}</title>${paths.join('')}</g>`;
  }

  const [x0, y0, x1, y1] = fig.box;
  const pad = 30;
  const w = (x1 - x0) * k.body + pad * 2;
  const vb = `${n1(cx - w / 2)} ${n1(y0 - pad)} ${n1(w)} ${n1(y1 - y0 + pad * 2 + 20)}`;
  const defs = `<defs>
    <radialGradient id="${id('gloss')}" cx="40%" cy="32%" r="78%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.25"/>
    </radialGradient>
    <radialGradient id="${id('ground')}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#000000" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
  const ground = `<ellipse cx="${cx}" cy="${n1(y1 + 8)}" rx="${n1((x1 - x0) * 0.28 * k.body)}" ry="16" fill="url(#${id('ground')})"/>`;
  // Silüetin içi deri rengiyle doldurulur (kas aralarındaki boşluklar)
  const fill0 = fig.border ? `<path d="${fig.border}" fill="${c.skin}" stroke="none"/>` : '';
  const border = fig.border
    ? `<path d="${fig.border}" fill="none" stroke="${c.outline}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    : '';
  const label = o.label ? `<text x="${cx}" y="${n1(y1 + pad + 10)}" text-anchor="middle" font-size="34" fill="${c.text}">${o.label}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${o.view === 'front' ? 'Önden' : 'Arkadan'} vücut prototipi">`
    + defs + ground
    + `<g transform="${sx(k.body)}">${fill0}${skin}${muscles}${border}</g>`
    + head + label + '</svg>';
}
