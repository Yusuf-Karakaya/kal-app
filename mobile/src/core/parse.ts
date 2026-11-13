// Türkçe doğal dil yemek ayrıştırıcı.
// "kahvaltıda 2 yumurta, yarım ekmek ve 1 bardak çay içtim" →
// [{2 adet haşlanmış yumurta}, {125 g ekmek}, {1 bardak çay}] + öğün: kahvaltı
import { FOODS, Food, nutrientsFor } from './foods';

export type MealKey = 'kahvalti' | 'ogle' | 'aksam' | 'ara';

export interface ParsedItem {
  /** Kullanıcının yazdığı parça */
  text: string;
  food?: Food;
  qty: number;
  unit: string;
  grams: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** Sıvı dengesine katkı (ml) */
  hydrationMl: number;
  /** Okunabilir açıklama: "2 adet Haşlanmış yumurta" */
  label: string;
}

export interface UnknownItem {
  /** Kullanıcının yazdığı parça */
  text: string;
  /** Miktar ve ölçüden arındırılmış ad ("1 kase kinoa" → "kinoa") */
  name: string;
  qty: number;
}

export interface ParseResult {
  items: ParsedItem[];
  /** Tanınamayan parçalar (ham metin) */
  unknown: string[];
  unknownItems: UnknownItem[];
  meal?: MealKey;
}

/* ---------- metin normalizasyonu ---------- */
const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export function fold(s: string): string {
  return s.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (ch) => FOLD[ch] ?? ch);
}

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, bi: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  onbir: 11, oniki: 12, onbes: 15, yirmi: 20, otuz: 30, kirk: 40, elli: 50, yuz: 100,
  yarim: 0.5, ceyrek: 0.25, birkac: 2, biraz: 0.5, cift: 2,
};

// Birimler: yazılış (katlanmış) -> standart ad. Uzunlar önce denenir.
const UNIT_WORDS: [string, string][] = [
  ['su bardag', 'su bardağı'], ['su bardak', 'su bardağı'],
  ['cay bardag', 'çay bardağı'], ['cay bardak', 'çay bardağı'],
  ['yemek kasig', 'yemek kaşığı'], ['yemek kasik', 'yemek kaşığı'],
  ['tatli kasig', 'tatlı kaşığı'], ['tatli kasik', 'tatlı kaşığı'],
  ['cay kasig', 'çay kaşığı'], ['cay kasik', 'çay kaşığı'],
  ['kibrit kutusu', 'kibrit kutusu'], ['buyuk sise', 'büyük şişe'], ['kucuk sise', 'küçük şişe'],
  ['buyuk paket', 'büyük paket'], ['buyuk kutu', 'büyük kutu'],
  ['yk', 'yemek kaşığı'], ['tk', 'tatlı kaşığı'],
  ['adet', 'adet'], ['tane', 'adet'], ['parca', 'adet'],
  ['dilim', 'dilim'], ['kase', 'kase'], ['kap', 'kase'], ['porsiyon', 'porsiyon'], ['porsyon', 'porsiyon'],
  ['tabak', 'tabak'], ['bardak', 'bardak'], ['bardag', 'bardak'], ['fincan', 'fincan'], ['kupa', 'kupa'],
  ['kasik', 'yemek kaşığı'], ['kasig', 'yemek kaşığı'], ['avuc', 'avuç'], ['kutu', 'kutu'], ['sise', 'şişe'],
  ['paket', 'paket'], ['kadeh', 'kadeh'], ['duble', 'duble'], ['top', 'top'], ['kare', 'kare'], ['olcek', 'ölçek'],
  ['salkim', 'salkım'], ['kup', 'küp'], ['kepce', 'kepçe'], ['sis', 'şiş'], ['kulah', 'külah'], ['somun', 'somun'],
  ['kilogram', 'kg'], ['kilo', 'kg'], ['kg', 'kg'], ['gram', 'g'], ['gr', 'g'], ['g', 'g'],
  ['mililitre', 'ml'], ['ml', 'ml'], ['litre', 'l'], ['lt', 'l'], ['l', 'l'],
];

// Bir yiyeceğe özel ölçü yoksa kullanılan genel ölçüler (g)
const GENERIC_UNITS: Record<string, number> = {
  'su bardağı': 200, 'çay bardağı': 100, bardak: 200, kupa: 250, fincan: 70,
  'yemek kaşığı': 15, 'tatlı kaşığı': 7, 'çay kaşığı': 4, avuç: 30, kase: 250, tabak: 300,
  kepçe: 150, 'kibrit kutusu': 30, kutu: 330, şişe: 500, 'küçük şişe': 330, 'büyük şişe': 1500, paket: 50, küp: 5,
};

// Kelime sonuna gelebilecek ekler (katlanmış). Kısa adlar için sınırlı liste.
const SHORT_SUFFIXES = new Set([
  '', 'i', 'u', 'e', 'a', 'yi', 'yu', 'ye', 'ya', 'si', 'su', 'ler', 'lar', 'leri', 'lari', 'li', 'lu',
  'de', 'da', 'te', 'ta', 'den', 'dan', 'ten', 'tan', 'yle', 'yla', 'le', 'la', 'in', 'un', 'nin', 'nun',
]);
const MUTATE: Record<string, string> = { k: 'g', p: 'b', t: 'd', c: 'c' };

function tokenMatches(token: string, alias: string): boolean {
  if (token === alias) return true;
  const candidates = [alias];
  const last = alias[alias.length - 1];
  if (alias.length >= 4 && MUTATE[last]) candidates.push(alias.slice(0, -1) + MUTATE[last]);
  for (const a of candidates) {
    if (!token.startsWith(a)) continue;
    const rest = token.slice(a.length);
    if (a.length >= 4 ? rest.length <= 5 : SHORT_SUFFIXES.has(rest)) return true;
  }
  return false;
}

// Dolgu kelimeler: anlamı olmayan fiiller ve zaman ifadeleri
const FILLER = new Set([
  'yedim', 'yedik', 'yemistim', 'yiyorum', 'ictim', 'ictik', 'iciyorum', 'aldim', 'ekle', 'ekledim', 'var', 'vardi',
  'tane', 'kadar', 'civari', 'civarinda', 'yaklasik', 'falan', 'filan', 'gibi', 'olarak', 'icin', 'sonra', 'once',
  'bugun', 'dun', 'sabah', 'ogle', 'oglen', 'ogleyin', 'aksam', 'gece', 'kahvaltida', 'kahvalti', 'kahvaltiya',
  'oglende', 'aksamda', 'aksama', 'yemekte', 'yemeginde', 'yemegi', 'yemeginden', 'ara', 'ogun', 'ogunde', 'atistirmalik',
  'ben', 'de', 'da', 'ise', 'ayrica', 'bide', 'birde', 'bir de', 'yaninda', 'ustune', 'icinde', 'tatli olarak',
]);

export function detectMeal(text: string): MealKey | undefined {
  const t = fold(text);
  if (/kahvalt|\bsabah/.test(t)) return 'kahvalti';
  if (/\bogle|\boglen/.test(t)) return 'ogle';
  if (/\baksam/.test(t)) return 'aksam';
  if (/ara ogun|atistir|\bgece/.test(t)) return 'ara';
  return undefined;
}

interface IndexedAlias { food: Food; tokens: string[]; len: number }
const ALIAS_INDEX: IndexedAlias[] = FOODS.flatMap((food) =>
  food.aliases.map((a) => {
    const tokens = fold(a).split(/\s+/);
    return { food, tokens, len: tokens.join('').length };
  }),
);

interface FoodMatch { food: Food; used: Set<number>; score: number }

function matchFood(tokens: string[], extra: IndexedAlias[]): FoodMatch | undefined {
  let best: { food: Food; used: Set<number>; score: number } | undefined;
  for (const entry of [...extra, ...ALIAS_INDEX]) {
    // Ad parçaları sırayla ve aralarında en fazla bir kelime boşlukla bulunmalı
    for (let start = 0; start < tokens.length; start++) {
      if (!tokenMatches(tokens[start], entry.tokens[0])) continue;
      const used = new Set([start]);
      let pos = start;
      let ok = true;
      for (let k = 1; k < entry.tokens.length; k++) {
        let found = -1;
        for (let j = pos + 1; j <= Math.min(pos + 2, tokens.length - 1); j++) {
          if (tokenMatches(tokens[j], entry.tokens[k])) { found = j; break; }
        }
        if (found < 0) { ok = false; break; }
        used.add(found);
        pos = found;
      }
      if (!ok) continue;
      // Daha uzun ad kazanır; eşitlikte kullanıcının eklediği yemek öne geçer.
      // "-li/-lı" eki almış kelime niteleyicidir ("peynirli tost" → tost), puanı düşürülür.
      const modifier = [...used].some((i, k) => /^(.*)(li|lu)$/.test(tokens[i]) && tokens[i] !== entry.tokens[k] && entry.tokens.length === 1);
      const score = (modifier ? entry.len * 0.3 : entry.len) + (extra.includes(entry) ? 0.5 : 0);
      if (!best || score > best.score) best = { food: entry.food, used, score };
      break;
    }
  }
  return best;
}

function parseNumberToken(tok: string): number | undefined {
  if (/^\d+([.,]\d+)?$/.test(tok)) return Number(tok.replace(',', '.'));
  if (/^\d+\/\d+$/.test(tok)) {
    const [a, b] = tok.split('/').map(Number);
    return b ? a / b : undefined;
  }
  if (tok in NUMBER_WORDS) return NUMBER_WORDS[tok];
  return undefined;
}

function formatQty(q: number): string {
  if (q === 0.5) return 'yarım';
  if (q === 0.25) return 'çeyrek';
  return (Math.round(q * 100) / 100).toLocaleString('tr-TR');
}

function isUnitWord(f: string): boolean {
  for (const [w] of UNIT_WORDS) {
    if (w.includes(' ')) continue;
    if (f === w) return true;
    if (w.length > 2 && f.startsWith(w) && f.length - w.length <= 4) return true;
  }
  return false;
}

/** Bir parçadan miktar, ölçü ve dolgu kelimelerini atıp yemeğin adını bırakır (Türkçe harfler korunur) */
export function cleanName(segment: string): string {
  const words = segment.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}\s.,/]/gu, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const f = fold(words[i]);
    if (parseNumberToken(f.replace(',', '.')) !== undefined || f === 'bucuk' || FILLER.has(f) || isUnitWord(f)) continue;
    // "su bardağı", "yemek kaşığı" gibi iki kelimeli ölçülerin ilk kelimesi
    if (['su', 'cay', 'yemek', 'tatli', 'kibrit', 'buyuk', 'kucuk'].includes(f) && words[i + 1] && isUnitWord(fold(words[i + 1]))) continue;
    out.push(words[i]);
  }
  return out.join(' ');
}

/** Kullanıcının kendi eklediği yemekler (ad -> 1 porsiyon kcal) ayrıştırmada da tanınır */
export function customFoodsToFoods(custom: Record<string, number>): Food[] {
  return Object.entries(custom).map(([name, kcal]) => ({
    id: 'custom:' + name, name, aliases: [name.toLocaleLowerCase('tr-TR')],
    // 1 porsiyon = 100 "birim" kabul edilir; makro bilinmiyor
    kcal, p: 0, c: 0, f: 0, unit: 'porsiyon', grams: 100, units: { porsiyon: 100, adet: 100 }, group: 'diger',
  }));
}

/** Tek bir parçayı (ör. "2 dilim tam buğday ekmeği") çözümler */
function parseSegment(segment: string, extra: IndexedAlias[]): { item: ParsedItem; leftover?: string } | undefined {
  const s = fold(segment)
    .replace(/(\d)\s*(gr|g|gram|ml|kg|lt|l)\b/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9.,/\s]/g, ' ')
    .trim();
  if (!s) return undefined;

  const toks = s.split(/\s+/).filter(Boolean);

  // Miktar: sayılar ve "bir buçuk" gibi ifadeler
  let qty: number | undefined;
  const qtyIdx = new Set<number>();
  for (let i = 0; i < toks.length; i++) {
    const n = parseNumberToken(toks[i]);
    if (n !== undefined && qty === undefined) {
      qty = n;
      qtyIdx.add(i);
      if (toks[i + 1] === 'bucuk') { qty += 0.5; qtyIdx.add(++i); }
    } else if (toks[i] === 'bucuk' && qty !== undefined) {
      qty += 0.5;
      qtyIdx.add(i);
    }
  }
  const cand = toks.filter((_, i) => !qtyIdx.has(i));
  if (!cand.length) return undefined;
  // Tek harfli birimler (g, l) yalnızca bir sayıdan hemen sonra geçerli
  const afterNumber = (j: number) => {
    const orig = toks.indexOf(cand[j]);
    return orig > 0 && qtyIdx.has(orig - 1);
  };

  // j konumundaki ölçü (yemek adında kullanılan kelimeler atlanır)
  const findUnit = (skip: Set<number>): { unit: string; idx: number[] } | undefined => {
    for (let j = 0; j < cand.length; j++) {
      if (skip.has(j)) continue;
      for (const [w, u] of UNIT_WORDS) {
        if (w.includes(' ')) {
          const [a1, b1] = w.split(' ');
          const next = cand[j + 1];
          if (cand[j] === a1 && next && !skip.has(j + 1) && next.startsWith(b1) && next.length - b1.length <= 4) return { unit: u, idx: [j, j + 1] };
        } else if (w.length <= 2) {
          if (cand[j] === w && afterNumber(j)) return { unit: u, idx: [j] };
        } else if (cand[j] === w || (cand[j].startsWith(w) && cand[j].length - w.length <= 4)) {
          return { unit: u, idx: [j] };
        }
      }
    }
    return undefined;
  };

  // 1) Bütün kelimelerle ara: "tavuk şiş", "patates yemeği", "somun" gibi ölçü/dolgu kelimesi içeren adlar için
  const full = matchFood(cand, extra);
  // 2) Ölçü ve dolgu kelimelerini atarak ara
  let unitHit = findUnit(new Set());
  const strippedIdx = cand.map((_, j) => j).filter((j) => !unitHit?.idx.includes(j) && !FILLER.has(cand[j]));
  const stripped = matchFood(strippedIdx.map((j) => cand[j]), extra);

  let m: FoodMatch | undefined;
  if (full && (!stripped || full.score > stripped.score)) {
    m = full;
    // Ölçü kelimesi yemeğin adındaysa ölçü değildir; başka bir ölçü ara
    if (unitHit && unitHit.idx.some((j) => full.used.has(j))) unitHit = findUnit(full.used);
  } else if (stripped) {
    m = { ...stripped, used: new Set([...stripped.used].map((k) => strippedIdx[k])) };
  }
  const unit = unitHit?.unit;

  if (!m) {
    return {
      item: {
        text: segment.trim(), qty: qty ?? 1, unit: unit ?? '', grams: 0, kcal: 0, p: 0, c: 0, f: 0, hydrationMl: 0,
        label: segment.trim(),
      },
    };
  }
  // "domates salatalık" gibi yan yana yazılmış başka bir yemek kaldıysa ayrıca çözülsün
  const used = m.used;
  // "-li/-lı" ekli niteleyiciler ("mantarlı pizza") ayrı yemek sayılmaz
  const left = cand.filter((t, j) => !used.has(j) && !unitHit?.idx.includes(j) && !FILLER.has(t) && !(t.length > 4 && /(li|lu)$/.test(t)));
  const leftover = left.length && matchFood(left, extra) ? left.join(' ') : undefined;
  const food = m.food;
  const q = qty ?? 1;

  let grams: number;
  let unitLabel: string;
  if (unit === 'g') { grams = q; unitLabel = 'g'; }
  else if (unit === 'kg') { grams = q * 1000; unitLabel = 'kg'; }
  else if (unit === 'ml') { grams = q; unitLabel = 'ml'; }
  else if (unit === 'l') { grams = q * 1000; unitLabel = 'l'; }
  else if (food.id.startsWith('custom:')) { grams = q * 100; unitLabel = unit ?? 'porsiyon'; }
  else if (unit && food.units[unit] != null) { grams = q * food.units[unit]; unitLabel = unit; }
  else if (unit && unit === 'bardak' && food.units['su bardağı']) { grams = q * food.units['su bardağı']; unitLabel = unit; }
  else if (unit && GENERIC_UNITS[unit] != null) { grams = q * GENERIC_UNITS[unit]; unitLabel = unit; }
  else if (!unit && q < 1 && food.whole) { grams = q * food.whole; unitLabel = ''; }
  else { grams = q * food.grams; unitLabel = food.unit; }

  grams = Math.round(grams);
  const n = nutrientsFor(food, grams);
  const qtyText = unitLabel === 'g' || unitLabel === 'ml' ? `${Math.round(q)} ${unitLabel}` : `${formatQty(q)} ${unitLabel}`.trim();
  const item: ParsedItem = {
    text: segment.trim(),
    food,
    qty: q,
    unit: unitLabel,
    grams,
    ...n,
    hydrationMl: food.hydration ? Math.round(grams * food.hydration) : 0,
    label: `${qtyText} ${food.name}`.replace(/\s+/g, ' ').trim(),
  };
  return { item, leftover };
}

// Yaygın kalıpları ayrıştırmadan önce sadeleştir
const PHRASES: [RegExp, string][] = [
  [/\b(3\s*u\s*1\s*arada|3\s*u\s*bir\s*arada|ucu\s*bir\s*arada)\b/g, 'hazir kahve'],
  [/\byarim ekmek doner\b/g, '1 adet ekmek arasi doner'],
  [/\byarim ekmek kokorec\b/g, '1 porsiyon kokorec'],
  [/\bceyrek ekmek kokorec\b/g, '0.6 porsiyon kokorec'],
  [/\byarim ekmek (kofte|sucuk|tavuk)\b/g, '1 adet hamburger'],
];

/** Serbest metni yemeklere ayırır */
export function parseMealText(text: string, customFoods: Record<string, number> = {}): ParseResult {
  const extra: IndexedAlias[] = customFoodsToFoods(customFoods).map((food) => {
    const tokens = fold(food.name).split(/\s+/);
    return { food, tokens, len: tokens.join('').length };
  });
  const meal = detectMeal(text);

  let t = fold(text).replace(/(\d),(\d)/g, '$1.$2');
  for (const [re, rep] of PHRASES) t = t.replace(re, rep);

  // Önce virgül, "ve", "ile" gibi ayraçlarla böl
  const parts = t
    .split(/[,;\n+&]|\s(?:ve|ile|bir de|birde|bide|yaninda|ustune|sonra da|arkasindan)\s/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Sonra "2 yumurta 1 ekmek" gibi ayraçsız dizileri sayılardan böl
  const segments: string[] = [];
  for (const p of parts) {
    const toks = p.split(/\s+/);
    let cur: string[] = [];
    for (let i = 0; i < toks.length; i++) {
      const isNum = parseNumberToken(toks[i]) !== undefined && toks[i] !== 'biraz';
      const prevIsNum = i > 0 && (parseNumberToken(toks[i - 1]) !== undefined || toks[i - 1] === 'bucuk');
      // Önceki parçada bir yiyecek bulunduysa yeni sayı yeni bir kalem başlatır
      // Sayıdan sonra bir yemek adı gelmiyorsa ("pizza 2 dilim") önceki kalemin miktarıdır
      const restHasFood = () => {
        const rest: string[] = [];
        for (let j = i + 1; j < toks.length && parseNumberToken(toks[j]) === undefined; j++) rest.push(toks[j]);
        return !!matchFood(rest.filter((x) => !FILLER.has(x)), extra);
      };
      if (isNum && !prevIsNum && cur.length && matchFood(cur.filter((x) => !FILLER.has(x)), extra) && restHasFood()) {
        segments.push(cur.join(' '));
        cur = [];
      }
      cur.push(toks[i]);
    }
    if (cur.length) segments.push(cur.join(' '));
  }

  const items: ParsedItem[] = [];
  const unknown: string[] = [];
  const unknownItems: UnknownItem[] = [];
  // Katlanmış kelimeleri kullanıcının yazdığı biçime geri çevir ("salatasi" → "salatası")
  const original: Record<string, string> = {};
  for (const w of text.toLocaleLowerCase('tr-TR').split(/[^\p{L}\p{N}]+/u)) if (w) original[fold(w)] = w;
  const restore = (str: string) => str.split(' ').map((w) => original[w] ?? w).join(' ');
  for (const seg of segments) {
    let next: string | undefined = seg;
    for (let guard = 0; next && guard < 6; guard++) {
      const r = parseSegment(next, extra);
      if (!r) break;
      if (r.item.food) items.push(r.item);
      else {
        const raw = restore(r.item.text);
        unknown.push(raw);
        const name = cleanName(raw);
        if (name) unknownItems.push({ text: raw, name, qty: r.item.qty });
      }
      next = r.leftover;
    }
  }
  return { items, unknown, unknownItems, meal };
}

export function sumItems(items: ParsedItem[]) {
  return items.reduce(
    (s, i) => ({
      kcal: s.kcal + i.kcal, p: s.p + i.p, c: s.c + i.c, f: s.f + i.f, hydrationMl: s.hydrationMl + i.hydrationMl,
    }),
    { kcal: 0, p: 0, c: 0, f: 0, hydrationMl: 0 },
  );
}

/** Ada göre arama (otomatik tamamlama için) */
export function searchFoods(query: string, limit = 8, customFoods: Record<string, number> = {}): Food[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const all = [...customFoodsToFoods(customFoods), ...FOODS];
  const scored: { food: Food; score: number }[] = [];
  for (const food of all) {
    let score = 0;
    for (const a of food.aliases) {
      const fa = fold(a);
      if (fa === q) score = Math.max(score, 100);
      else if (fa.startsWith(q)) score = Math.max(score, 80 - fa.length / 10);
      else if (fa.split(' ').some((w) => w.startsWith(q))) score = Math.max(score, 60 - fa.length / 10);
      else if (fa.includes(q)) score = Math.max(score, 40 - fa.length / 10);
    }
    if (score) scored.push({ food, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.food);
}
