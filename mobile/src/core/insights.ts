// Analizler: kilo trendi, uyarlanır harcama tahmini, seriler, son yenenler, günlük öneriler
import { FOODS, Food } from './foods';
import {
  Data, FoodEntry, Meal, Totals, addDays, daysBetween, fmt, fmt1, keyToDate, minutesOf, todayKey, totals,
} from './model';
import { burnedKcal, dayProgress, isTrainingDay, programFor, waterGoalOn } from './workout';

/* ---------- kilo trendi ---------- */
export interface TrendPoint { key: string; raw?: number; trend: number }

/**
 * Günlük tartılardaki su/sindirim dalgalanmasını yumuşatan üstel hareketli ortalama (α = 0,1).
 * Ölçüm olmayan günler doğrusal ara değerle doldurulur.
 */
export function weightTrend(weights: Record<string, number>, until = todayKey()): TrendPoint[] {
  const keys = Object.keys(weights).filter((k) => k <= until).sort();
  if (!keys.length) return [];
  const out: TrendPoint[] = [];
  let trend = weights[keys[0]];
  let prevKey = keys[0];
  let prevVal = weights[keys[0]];
  let ki = 0;
  for (let k = keys[0]; k <= until; k = addDays(k, 1)) {
    let raw: number | undefined;
    let val: number;
    if (ki < keys.length && keys[ki] === k) {
      raw = weights[k];
      val = raw;
      prevKey = k;
      prevVal = raw;
      ki++;
    } else if (ki < keys.length) {
      const nextKey = keys[ki];
      const span = daysBetween(prevKey, nextKey);
      val = prevVal + ((weights[nextKey] - prevVal) * daysBetween(prevKey, k)) / span;
    } else {
      val = prevVal;
    }
    trend = trend + 0.1 * (val - trend);
    out.push({ key: k, raw, trend: Math.round(trend * 100) / 100 });
  }
  return out;
}

/** Haftalık kilo değişim hızı (trende göre, kg/hafta) */
export function weeklyRate(points: TrendPoint[], days = 14): number | null {
  if (points.length < 7) return null;
  const end = points[points.length - 1];
  const start = points[Math.max(0, points.length - 1 - days)];
  const span = daysBetween(start.key, end.key);
  if (span < 6) return null;
  return ((end.trend - start.trend) / span) * 7;
}

/* ---------- uyarlanır harcama (TDEE) ---------- */
export interface TdeeEstimate {
  tdee: number;
  /** Hesaba katılan kayıtlı gün sayısı */
  days: number;
  avgIntake: number;
  /** Önerilen yeni kalori hedefi (amaçtaki fark eklenmiş) */
  suggestedCal: number;
}

/**
 * Son 3 haftadaki ortalama alım ve kilo trendindeki değişimden gerçek günlük harcamayı tahmin eder:
 * harcama = ortalama alım − (trenddeki değişim × 7700 kcal/kg) / gün sayısı.
 * Yeterli veri yoksa (en az 10 kayıtlı gün ve 10 güne yayılmış 2 tartı) null döner.
 */
export function estimateTdee(data: Data, today = todayKey(), windowDays = 21): TdeeEstimate | null {
  const end = addDays(today, -1);
  const start = addDays(end, -(windowDays - 1));
  const wKeys = Object.keys(data.weights).filter((k) => k >= addDays(start, -7) && k <= end).sort();
  if (wKeys.length < 2 || daysBetween(wKeys[0], wKeys[wKeys.length - 1]) < 10) return null;

  const intakes: number[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) {
    const cal = totals(data, k).cal;
    // Çok düşük günler büyük olasılıkla eksik kayıttır, hesaba katılmaz
    if (cal >= 800) intakes.push(cal);
  }
  if (intakes.length < 10) return null;

  const trend = weightTrend(data.weights, end);
  const at = (k: string) => trend.find((p) => p.key === k)?.trend ?? trend[0].trend;
  const from = start < trend[0].key ? trend[0].key : start;
  const span = daysBetween(from, end);
  if (span < 7) return null;
  const delta = at(end) - at(from);
  const avgIntake = intakes.reduce((s, x) => s + x, 0) / intakes.length;
  const tdee = Math.round(avgIntake - (delta * 7700) / span);
  const minCal = data.profile.sex === 'm' ? 1500 : 1200;
  return {
    tdee,
    days: intakes.length,
    avgIntake: Math.round(avgIntake),
    suggestedCal: Math.max(minCal, Math.round((tdee + data.profile.goal) / 10) * 10),
  };
}

/** Hedef kiloya tahmini varış tarihi */
export function etaToTarget(current: number, target: number | undefined, ratePerWeek: number | null): string | null {
  if (!target || ratePerWeek == null || Math.abs(ratePerWeek) < 0.05) return null;
  const diff = target - current;
  if (Math.sign(diff) !== Math.sign(ratePerWeek)) return null;
  const weeks = diff / ratePerWeek;
  if (weeks > 104) return null;
  const d = new Date();
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------- seriler ---------- */
/** Bugün (karşılanmışsa) ya da dünden geriye doğru koşulu sağlayan ardışık gün sayısı */
export function streak(data: Data, ok: (key: string) => boolean, today = todayKey()): number {
  let k = ok(today) ? today : addDays(today, -1);
  let n = 0;
  while (ok(k) && n < 3650) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export const waterStreak = (data: Data, today?: string) =>
  streak(data, (k) => totals(data, k).water >= waterGoalOn(data, k), today);

export const logStreak = (data: Data, today?: string) =>
  streak(data, (k) => (data.days[k]?.food.length ?? 0) > 0, today);

/* ---------- son yenenler ---------- */
export interface RecentFood { name: string; cal: number; p?: number; c?: number; f?: number; grams?: number; foodId?: string; count: number; meal: Meal }

/** Son 30 günde en sık girilen kalemler (son kullanılan değerleriyle) */
export function recentFoods(data: Data, limit = 12, today = todayKey()): RecentFood[] {
  const map = new Map<string, RecentFood & { last: number }>();
  for (let i = 0; i < 30; i++) {
    const day = data.days[addDays(today, -i)];
    if (!day) continue;
    for (const e of day.food) {
      const cur = map.get(e.name);
      if (cur) {
        cur.count++;
        if (e.t > cur.last) Object.assign(cur, pick(e), { last: e.t });
      } else map.set(e.name, { ...pick(e), count: 1, last: e.t });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map(({ last: _last, ...r }) => r);
}

function pick(e: FoodEntry) {
  return { name: e.name, cal: e.cal, p: e.p, c: e.c, f: e.f, grams: e.grams, foodId: e.foodId, meal: e.meal };
}

/* ---------- günlük öneriler ---------- */
export interface Insight { tone: 'good' | 'info' | 'warn'; text: string }

/** O ana kadar içilmiş olması beklenen su (aktif saatlere doğrusal dağılım) */
export function expectedWaterNow(data: Data, now = new Date(), goal = data.goals.water): number {
  const s = minutesOf(data.reminders.start);
  const e = minutesOf(data.reminders.end);
  const n = now.getHours() * 60 + now.getMinutes();
  if (e <= s) return 0;
  const ratio = Math.min(1, Math.max(0, (n - s) / (e - s)));
  return Math.round(goal * ratio);
}

/** Kalan kaloriye uyan, proteini yüksek öneriler */
export function suggestFoods(remainingKcal: number, needProtein: boolean, limit = 3): Food[] {
  if (remainingKcal < 80) return [];
  const pool = FOODS.filter((f) => f.group !== 'icecek' && f.group !== 'diger' && f.kcal > 0)
    .map((f) => ({ f, kcal: (f.kcal * f.grams) / 100, protein: (f.p * f.grams) / 100 }))
    .filter((x) => x.kcal <= remainingKcal && x.kcal >= Math.min(120, remainingKcal * 0.3));
  pool.sort((a, b) => (needProtein ? b.protein / b.kcal - a.protein / a.kcal : b.kcal - a.kcal));
  return pool.slice(0, limit).map((x) => x.f);
}

export function dailyInsights(data: Data, key: string, now = new Date()): Insight[] {
  const out: Insight[] = [];
  const t: Totals = totals(data, key);
  const g = data.goals;
  const isToday = key === todayKey();
  const hour = now.getHours();

  // Antrenman
  const wGoal = waterGoalOn(data, key);
  const wp = dayProgress(data, key);
  const prog = programFor(key, data);
  if (wp.done > 0 && wp.ratio >= 1) {
    out.push({ tone: 'good', text: `${prog.name} tamamlandı, ~${fmt(burnedKcal(data, key))} kcal yaktın. Protein ve suyu ihmal etme.` });
  } else if (isToday && isTrainingDay(key, data) && wp.done === 0 && hour >= 16) {
    out.push({ tone: 'info', text: `Bugün ${prog.name.toLocaleLowerCase('tr-TR')} günü. Antrenman sekmesinden başlayabilirsin.` });
  }

  // Su
  if (t.water >= wGoal) out.push({ tone: 'good', text: 'Su hedefin tamam. Böyle devam!' });
  else if (isToday) {
    const expected = expectedWaterNow(data, now, wGoal);
    const behind = expected - t.water;
    if (behind >= 400) out.push({ tone: 'warn', text: `Su planının ${fmt(behind)} ml gerisindesin. Şimdi 1–2 bardak iç.` });
  }

  // Kalori
  if (t.cal > g.cal * 1.05) out.push({ tone: 'warn', text: `Kalori hedefini ${fmt(t.cal - g.cal)} kcal aştın. Yarın hafif bir başlangıç yapabilirsin.` });

  // Protein
  if (g.p > 0) {
    const ratio = t.p / g.p;
    if (ratio >= 1) out.push({ tone: 'good', text: `Protein hedefine ulaştın (${fmt(t.p)} g).` });
    else if (isToday && hour >= 17 && ratio < 0.6 && t.cal > 0) {
      const ideas = suggestFoods(g.cal - t.cal, true).map((f) => f.name.toLocaleLowerCase('tr-TR'));
      out.push({
        tone: 'info',
        text: `Protein ${fmt(t.p)}/${fmt(g.p)} g. ${ideas.length ? `Akşam için ${ideas.join(', ')} iyi seçenekler.` : 'Akşam yemeğinde proteine ağırlık ver.'}`,
      });
    }
  }

  // Kalan kalori önerisi
  if (isToday && hour >= 12 && t.cal > 0 && t.cal < g.cal) {
    const rem = g.cal - t.cal;
    if (rem > 300 && !out.some((i) => i.text.startsWith('Protein'))) {
      out.push({ tone: 'info', text: `${fmt(rem)} kcal hakkın kaldı.` });
    }
  }

  // Seri
  const ws = waterStreak(data, key);
  if (ws >= 3) out.push({ tone: 'good', text: `${ws} gündür su hedefini tutturuyorsun 🔥` });

  // Kilo
  const trend = weightTrend(data.weights);
  const rate = weeklyRate(trend);
  if (rate != null && data.profile.goal < 0 && rate < -1.0) {
    out.push({ tone: 'warn', text: `Haftada ${fmt1(-rate)} kg veriyorsun; bu hızlı. Kas kaybını önlemek için hedefi biraz yükseltebilirsin.` });
  }
  return out.slice(0, 3);
}

/** Bir tarihin kısa adı: Bugün, Dün, ya da gün adı */
export function dayLabel(key: string, today = todayKey()): string {
  if (key === today) return 'Bugün';
  if (key === addDays(today, -1)) return 'Dün';
  return keyToDate(key).toLocaleDateString('tr-TR', { weekday: 'long' });
}
