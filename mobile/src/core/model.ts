// Ortak veri modeli ve saf (yan etkisiz) işlemler. Web ve mobil sürüm aynı JSON yapısını kullanır.
import { FOOD_BY_ID } from './foods';
import { ParsedItem } from './parse';

export type Meal = 'kahvalti' | 'ogle' | 'aksam' | 'ara';
export const MEALS: Record<Meal, string> = { kahvalti: 'Kahvaltı', ogle: 'Öğle', aksam: 'Akşam', ara: 'Ara öğün' };
export const MEAL_ORDER: Meal[] = ['kahvalti', 'ogle', 'aksam', 'ara'];

export interface FoodEntry {
  id: string;
  name: string;
  cal: number;
  meal: Meal;
  t: number;
  p?: number;
  c?: number;
  f?: number;
  grams?: number;
  foodId?: string;
}

export interface WaterEntry {
  id: string;
  /** Sıvı dengesine sayılan miktar (ml) */
  ml: number;
  t: number;
  /** İçecek türü (foods.ts kimliği); boşsa sade su */
  drink?: string;
  /** İçilen gerçek hacim (ml) */
  vol?: number;
}

export interface Day { food: FoodEntry[]; water: WaterEntry[] }

export interface Profile {
  sex: 'f' | 'm';
  age: number;
  height: number;
  weight: number;
  activity: number;
  /** Günlük kalori farkı: -500 / -250 / 0 / +300 */
  goal: number;
  targetWeight?: number;
}

export interface Goals {
  cal: number;
  water: number;
  p: number;
  c: number;
  f: number;
}

export interface Reminders {
  waterOn: boolean;
  waterEvery: number;
  start: string;
  end: string;
  mealOn: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  summaryOn: boolean;
  summary: string;
  weighOn?: boolean;
  weigh?: string;
}

export interface Data {
  version: 2;
  profile: Profile;
  goals: Goals;
  reminders: Reminders;
  days: Record<string, Day>;
  /** Kullanıcının kendi yemekleri: ad -> 1 porsiyon kcal */
  customFoods: Record<string, number>;
  /** Tarih -> kilo (kg) */
  weights: Record<string, number>;
  /** Su için hızlı içecek düğmeleri (foods.ts kimlikleri) */
  favDrinks?: string[];
  /** Antrenman: tarih -> hareket ("blok-hareket") -> setler */
  workouts?: Record<string, Record<string, boolean[]>>;
  /** Kettlebell ağırlığı (kg) */
  kbWeight?: number;
}

export const DEFAULT_DATA: Data = {
  version: 2,
  profile: { sex: 'f', age: 30, height: 165, weight: 65, activity: 1.375, goal: 0 },
  goals: { cal: 2000, water: 2300, p: 110, c: 230, f: 65 },
  reminders: {
    waterOn: true, waterEvery: 60, start: '09:00', end: '22:00',
    mealOn: true, breakfast: '09:30', lunch: '13:30', dinner: '20:00',
    summaryOn: true, summary: '21:30',
    weighOn: false, weigh: '08:00',
  },
  days: {},
  customFoods: {},
  weights: {},
  favDrinks: ['cay', 'filtre-kahve', 'ayran'],
  workouts: {},
  kbWeight: 12,
};

/** Eski (v1) veya eksik verileri güncel yapıya taşır */
export function migrate(raw: unknown): Data {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Data>;
  const base = structuredClone(DEFAULT_DATA);
  const profile = { ...base.profile, ...d.profile };
  const goals = { ...base.goals, ...d.goals } as Goals;
  // v1'de makro hedefi yoktu: kalori hedefinden üret
  if (!d.goals || d.goals.p == null) Object.assign(goals, macroGoals(goals.cal, profile.weight, profile.goal));
  return {
    ...base,
    ...d,
    version: 2,
    profile,
    goals,
    reminders: { ...base.reminders, ...d.reminders },
    days: d.days ?? {},
    customFoods: d.customFoods ?? {},
    weights: d.weights ?? {},
    favDrinks: d.favDrinks ?? base.favDrinks,
    workouts: d.workouts ?? {},
    kbWeight: d.kbWeight ?? base.kbWeight,
  };
}

/* ---------- tarih yardımcıları ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const keyToDate = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = keyToDate(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const daysBetween = (a: string, b: string) => Math.round((keyToDate(b).getTime() - keyToDate(a).getTime()) / 86400000);
export const hhmm = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const minutesOf = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
export const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');
export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('tr-TR');
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function guessMeal(date = new Date()): Meal {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'kahvalti';
  if (h >= 11 && h < 16) return 'ogle';
  if (h >= 18 && h < 23) return 'aksam';
  return 'ara';
}

/* ---------- hesaplar ---------- */
export interface Totals { cal: number; p: number; c: number; f: number; water: number }

export function totals(data: Data, key: string): Totals {
  const d = data.days[key];
  const t: Totals = { cal: 0, p: 0, c: 0, f: 0, water: 0 };
  if (!d) return t;
  for (const e of d.food) {
    t.cal += e.cal;
    t.p += e.p ?? 0;
    t.c += e.c ?? 0;
    t.f += e.f ?? 0;
  }
  for (const w of d.water) t.water += w.ml;
  return t;
}

export function mealTotals(day: Day | undefined, meal: Meal): number {
  return day ? day.food.filter((f) => f.meal === meal).reduce((s, f) => s + f.cal, 0) : 0;
}

/** Mifflin-St Jeor BMR × aktivite katsayısı */
export function bmrTdee(p: Profile) {
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * p.activity) };
}

/**
 * Makro hedefleri. Protein kilo başına (kilo verirken 1,8 g/kg, diğer durumlarda 1,6 g/kg; ISSN önerileri),
 * yağ kalorinin %28'i, kalan karbonhidrat.
 */
export function macroGoals(cal: number, weight: number, goal: number) {
  const perKg = goal < 0 ? 1.8 : 1.6;
  let p = Math.round(weight * perKg);
  p = Math.min(p, Math.round((cal * 0.35) / 4));
  const f = Math.round((cal * 0.28) / 9);
  const c = Math.max(50, Math.round((cal - p * 4 - f * 9) / 4));
  return { p, c, f };
}

/** Su hedefi: kilo başına 35 ml, aktiviteye göre artı (50 ml'ye yuvarlanır) */
export function waterGoalFor(p: Profile) {
  const extra = p.activity >= 1.725 ? 500 : p.activity >= 1.55 ? 250 : 0;
  return Math.round((p.weight * 35 + extra) / 50) * 50;
}

export function calcGoals(p: Profile): Goals & { bmr: number; tdee: number } {
  const { bmr, tdee } = bmrTdee(p);
  const minCal = p.sex === 'm' ? 1500 : 1200;
  const cal = Math.max(minCal, Math.round((tdee + p.goal) / 10) * 10);
  return { bmr, tdee, cal, water: waterGoalFor(p), ...macroGoals(cal, p.weight, p.goal) };
}

/* ---------- değişiklikler: hepsi yeni nesne döndürür ---------- */
function withDay(data: Data, key: string, fn: (d: Day) => Day): Data {
  const day = data.days[key] ?? { food: [], water: [] };
  return { ...data, days: { ...data.days, [key]: fn(day) } };
}

function entryTime(key: string) {
  return key === todayKey() ? Date.now() : keyToDate(key).setHours(12);
}

export function addWater(data: Data, key: string, ml: number, drink?: string, vol?: number): Data {
  return withDay(data, key, (d) => ({
    ...d,
    water: [...d.water, { id: uid(), ml: Math.round(ml), t: entryTime(key), ...(drink ? { drink, vol } : {}) }],
  }));
}

/** İçecek ekler: sıvı dengesine oranı kadar sayılır, kalorisi varsa yemeklere de eklenir */
export function addDrink(data: Data, key: string, drinkId: string, vol: number, meal: Meal = guessMeal()): Data {
  const food = FOOD_BY_ID[drinkId];
  if (!food) return addWater(data, key, vol);
  let next = data;
  if (food.hydration) next = addWater(next, key, vol * food.hydration, drinkId === 'su' ? undefined : drinkId, vol);
  const kcal = Math.round((food.kcal * vol) / 100);
  if (kcal > 0) {
    next = addFoodEntry(next, key, {
      name: `${food.name} (${vol} ml)`, cal: kcal, meal, foodId: drinkId, grams: vol,
      p: round1((food.p * vol) / 100), c: round1((food.c * vol) / 100), f: round1((food.f * vol) / 100),
    });
  }
  return next;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function addFoodEntry(data: Data, key: string, e: Omit<FoodEntry, 'id' | 't'>): Data {
  return withDay(data, key, (d) => ({ ...d, food: [...d.food, { id: uid(), t: entryTime(key), ...e }] }));
}

/** Basit (yalnızca kalori) yemek ekleme; bilinmeyen adları kişisel listeye kaydeder */
export function addFood(data: Data, key: string, name: string, cal: number, meal: Meal): Data {
  const next = addFoodEntry(data, key, { name, cal, meal });
  return { ...next, customFoods: { ...next.customFoods, [name]: cal } };
}

/** Tanınmayan bir yemeği kişisel listeye öğretir (1 porsiyonun kalorisi) */
export function learnFood(data: Data, name: string, kcalPerPortion: number): Data {
  const n = name.trim().toLocaleLowerCase('tr-TR');
  if (!n || !(kcalPerPortion > 0)) return data;
  return { ...data, customFoods: { ...data.customFoods, [n]: Math.round(kcalPerPortion) } };
}

/** Ayrıştırıcıdan gelen kalemleri ekler (yemekler + içeceklerin sıvı katkısı) */
export function addParsedItems(data: Data, key: string, items: ParsedItem[], meal: Meal): Data {
  let next = data;
  for (const it of items) {
    if (!it.food) continue;
    if (it.kcal > 0 || !it.hydrationMl) {
      next = addFoodEntry(next, key, {
        name: it.label, cal: it.kcal, meal, p: it.p, c: it.c, f: it.f, grams: it.grams, foodId: it.food.id,
      });
    }
    if (it.hydrationMl > 0) {
      next = addWater(next, key, it.hydrationMl, it.food.id === 'su' ? undefined : it.food.id, it.grams);
    }
  }
  return next;
}

/** Bir yemek kaydının porsiyonunu çarpanla değiştirir ("1 porsiyon Mantı" → "1,5 porsiyon Mantı") */
export function scaleEntry(data: Data, key: string, id: string, factor: number): Data {
  if (!(factor > 0)) return data;
  return withDay(data, key, (d) => ({
    ...d,
    food: d.food.map((e) => {
      if (e.id !== id) return e;
      const words: Record<string, number> = { yarım: 0.5, çeyrek: 0.25 };
      const m = /^(\d+(?:[.,]\d+)?|yarım|çeyrek)\s+/.exec(e.name);
      let name: string;
      if (m) {
        const q = (words[m[1]] ?? Number(m[1].replace(',', '.'))) * factor;
        const qText = q === 0.5 ? 'yarım' : q === 0.25 ? 'çeyrek' : (Math.round(q * 100) / 100).toLocaleString('tr-TR');
        name = qText + ' ' + e.name.slice(m[0].length);
      } else {
        name = `${(Math.round(factor * 100) / 100).toLocaleString('tr-TR')}× ${e.name}`;
      }
      const sc = (v?: number) => (v == null ? v : Math.round(v * factor * 10) / 10);
      return { ...e, name, cal: Math.round(e.cal * factor), p: sc(e.p), c: sc(e.c), f: sc(e.f), grams: e.grams == null ? undefined : Math.round(e.grams * factor) };
    }),
  }));
}

/** Kaydı başka öğüne taşır */
export function moveEntry(data: Data, key: string, id: string, meal: Meal): Data {
  return withDay(data, key, (d) => ({ ...d, food: d.food.map((e) => (e.id === id ? { ...e, meal } : e)) }));
}

export function removeEntry(data: Data, key: string, type: 'food' | 'water', id: string): Data {
  return withDay(data, key, (d) =>
    type === 'food' ? { ...d, food: d.food.filter((e) => e.id !== id) } : { ...d, water: d.water.filter((e) => e.id !== id) },
  );
}

/** Bir günün bir öğününü başka güne kopyalar ("dünkü kahvaltıyı tekrarla") */
export function copyMeal(data: Data, fromKey: string, toKey: string, meal: Meal): Data {
  const src = data.days[fromKey]?.food.filter((f) => f.meal === meal) ?? [];
  let next = data;
  for (const { id: _id, t: _t, ...rest } of src) next = addFoodEntry(next, toKey, rest);
  return next;
}

export function setWeight(data: Data, key: string, kg: number | null): Data {
  const weights = { ...data.weights };
  if (kg == null) delete weights[key];
  else weights[key] = Math.round(kg * 10) / 10;
  // Profil kilosu en güncel ölçümü izler
  const latestKey = Object.keys(weights).sort().pop();
  const profile = latestKey ? { ...data.profile, weight: weights[latestKey] } : data.profile;
  return { ...data, weights, profile };
}
