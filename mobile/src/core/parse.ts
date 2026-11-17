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
  /** Sos/niteleyici eklemeleri ("körili", "kremalı") */
  mods?: string[];
  /** Veritabanında birebir yok; kategoriye göre tahmin edildi */
  estimate?: boolean;
}

export interface UnknownItem {
  /** Kullanıcının yazdığı parça */
  text: string;
  /** Miktar ve ölçüden arındırılmış ad ("1 kase kinoa" → "kinoa") */
  name: string;
  qty: number;
  /** Porsiyon başına kaba tahmin (kcal) */
  guess?: number;
  /** Miktar/ölçü açıkça yazıldıysa tahmin doğrudan kullanılabilir */
  sure?: boolean;
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

/** İki kelime arasındaki düzenleme uzaklığı; yan yana iki harfin yer değiştirmesi ("tavku") tek hata sayılır */
function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d.push([i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Yazım hatası toleransı: uzun kelimelerde 1, çok uzunlarda 2 harf hata; ek almış hâli de kabul edilir */
function fuzzyMatches(token: string, alias: string, multi = false): boolean {
  // Çok kelimeli adlarda ("tavuk sotte") 4 harfli kelimeler de 1 hatayla kabul edilir
  if (alias.length < (multi ? 4 : 5) || token.length < 4) return false;
  // "şekersiz" ile "şekerli" zıt anlamlıdır; ekleri farklıysa hatalı yazım sayılmaz
  const neg = (w: string) => /(siz|suz)$/.test(w), withx = (w: string) => /(li|lu)$/.test(w);
  if (neg(token) !== neg(alias) || (withx(alias) && neg(token)) || (withx(token) && neg(alias))) return false;
  const max = alias.length >= 8 ? 2 : 1;
  if (lev(token, alias, max) <= max) return true;
  // "kavurmasi" gibi ek almış ve hatalı yazılmış: ad uzunluğundaki öneki karşılaştır
  if (alias.length < 6) return false;
  for (let extra = 1; extra <= 5 && alias.length + extra <= token.length; extra++) {
    if (lev(token.slice(0, alias.length + extra - 1), alias, max) <= max) return true;
  }
  return false;
}

function tokenMatches(token: string, alias: string, fuzzy = false, multi = false): boolean {
  if (token === alias) return true;
  // "-sız/-süz" yokluk bildirir: "misosuz ramen" miso içermez
  if (/(siz|suz)$/.test(token) && token.length - alias.length <= 4 && token.startsWith(alias.slice(0, -1))) return false;
  // Kendisi bilinen bir yemek kelimesi olan sözcük ("salatalık") hatalı yazım sayılmaz
  if (fuzzy && !KNOWN_WORDS.has(token) && fuzzyMatches(token, alias, multi)) return true;
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

interface IndexedAlias { food: Food; tokens: string[]; len: number; order: number }
const ALIAS_INDEX: IndexedAlias[] = FOODS.flatMap((food) =>
  food.aliases.map((a) => {
    // Kullanıcı metniyle aynı biçimde sadeleştir ("mcdonald's" → "mcdonald s")
    const tokens = fold(a).replace(/[^a-z0-9.,/\s]/g, ' ').trim().split(/\s+/);
    return { food, tokens, len: tokens.join('').length, order: 0 };
  }),
);
ALIAS_INDEX.forEach((e, i) => { e.order = i; });
const KNOWN_WORDS = new Set(ALIAS_INDEX.flatMap((e) => e.tokens));

// Hızlı arama için dizin: bir kelime ancak adın ilk iki harfiyle başlıyorsa eşleşebilir.
// Yazım hatası araması yalnızca ilk harfe göre daraltılır (ilk harfte hata yapılması seyrektir).
const BY_PREFIX2 = new Map<string, IndexedAlias[]>();
const BY_PREFIX1 = new Map<string, IndexedAlias[]>();
for (const e of ALIAS_INDEX) {
  const t = e.tokens[0];
  const k2 = t.slice(0, 2), k1 = t.slice(0, 1);
  if (!BY_PREFIX2.has(k2)) BY_PREFIX2.set(k2, []);
  BY_PREFIX2.get(k2)!.push(e);
  if (!BY_PREFIX1.has(k1)) BY_PREFIX1.set(k1, []);
  BY_PREFIX1.get(k1)!.push(e);
}

interface FoodMatch { food: Food; used: Set<number>; score: number }

function matchFood(tokens: string[], extra: IndexedAlias[], fuzzy = false): FoodMatch | undefined {
  let best: { food: Food; used: Set<number>; score: number; order: number } | undefined;
  // Adayları topla (her ad bir kez, en erken başlangıçla denenir)
  const cands = new Set<IndexedAlias>(extra);
  for (const t of tokens) {
    for (const e of (fuzzy ? BY_PREFIX1.get(t.slice(0, 1)) : BY_PREFIX2.get(t.slice(0, 2))) ?? []) cands.add(e);
    // Tek harfli adlar ("ı" gibi) ve kısa adlar için ilk harf dizini
    if (!fuzzy && t.length < 2) for (const e of BY_PREFIX1.get(t) ?? []) cands.add(e);
  }
  for (const entry of cands) {
    // Ad parçaları sırayla ve aralarında en fazla bir kelime boşlukla bulunmalı
    for (let start = 0; start < tokens.length; start++) {
      const multi = entry.tokens.length > 1;
      if (!tokenMatches(tokens[start], entry.tokens[0], fuzzy, multi)) continue;
      const used = new Set([start]);
      let pos = start;
      let ok = true;
      for (let k = 1; k < entry.tokens.length; k++) {
        let found = -1;
        for (let j = pos + 1; j <= Math.min(pos + 2, tokens.length - 1); j++) {
          if (tokenMatches(tokens[j], entry.tokens[k], fuzzy, multi)) { found = j; break; }
        }
        if (found < 0) { ok = false; break; }
        used.add(found);
        pos = found;
      }
      if (!ok) continue;
      // Daha uzun ad kazanır; eşitlikte kullanıcının eklediği yemek, sonra listede önce gelen öne geçer.
      // "-li/-lı" eki almış kelime niteleyicidir ("peynirli tost" → tost), puanı düşürülür.
      const modifier = [...used].some((i, k) => /^(.*)(li|lu)$/.test(tokens[i]) && tokens[i] !== entry.tokens[k] && !/(li|lu)$/.test(entry.tokens[k]));
      const isExtra = extra.includes(entry);
      const score = (modifier ? entry.len * 0.3 : entry.len) + (isExtra ? 0.5 : 0);
      const order = isExtra ? -1 : entry.order;
      if (!best || score > best.score || (score === best.score && order < best.order)) best = { food: entry.food, used, score, order };
      break;
    }
  }
  return best && { food: best.food, used: best.used, score: best.score };
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

/* ---------- sos / niteleyici katmanı ---------- */
// "-li/-lı" ekli niteleyiciler yemeğe sos/malzeme ekler. Değerler, yemeğin 100 g'ı başına eklenen miktardır
// (ör. körili: hindistan cevizi sütü + yağlı sos ≈ yemeğin %12'si). [kök (katlanmış), görünen ad, p, k, y]
const MODS: [string, string, number, number, number][] = [
  ['kori', 'körili', 0.5, 2, 2.5], ['krema', 'kremalı', 0.5, 0.7, 6], ['kasar', 'kaşarlı', 3, 0.2, 3.5],
  ['peynir', 'peynirli', 2.5, 0.2, 2.5], ['sos', 'soslu', 0.3, 4, 1], ['tereyag', 'tereyağlı', 0, 0, 4],
  ['mayonez', 'mayonezli', 0, 0.3, 6], ['ketcap', 'ketçaplı', 0.2, 4, 0], ['yogurt', 'yoğurtlu', 0.8, 1, 0.8],
  ['cikolata', 'çikolatalı', 0.6, 6, 3], ['nutella', 'nutellalı', 0.6, 6, 3], ['bal', 'ballı', 0, 8, 0],
  ['seker', 'şekerli', 0, 6, 0], ['sucuk', 'sucuklu', 2, 0.2, 3.2], ['pastirma', 'pastırmalı', 3, 0, 1],
  ['kiyma', 'kıymalı', 3, 0, 2.5], ['et', 'etli', 3, 0, 2], ['tavuk', 'tavuklu', 4, 0, 1],
  ['patates', 'patatesli', 0.3, 4, 1], ['fistik', 'fıstıklı', 1, 1, 3], ['ceviz', 'cevizli', 1, 0.7, 4],
  ['kaymak', 'kaymaklı', 0.3, 0.3, 5], ['dondurma', 'dondurmalı', 0.5, 3.5, 1.5], ['yumurta', 'yumurtalı', 1.5, 0, 1.3],
  ['zeytinyag', 'zeytinyağlı', 0, 0, 4], ['tahin', 'tahinli', 1, 1.2, 3.2], ['avokado', 'avokadolu', 0.3, 1, 2.2],
  ['susam', 'susamlı', 0.6, 0.8, 1.6], ['nohut', 'nohutlu', 0.8, 2, 0.3], ['mantar', 'mantarlı', 0.3, 0.3, 0.8], ['sosis', 'sosisli', 1.5, 0.3, 2.5], ['salam', 'salamlı', 1.5, 0.2, 2], ['karamel', 'karamelli', 0, 6, 1], ['sut', 'sütlü', 0.6, 1, 0.6],
];
// Pişirme biçimleri: kızartma/pane yağ ve un ekler
const COOK_MODS: [RegExp, string, number, number, number][] = [
  [/^(kizarmis|kizartilmis|pane|panelenmis|citir)$/, 'kızartma', 0.5, 8, 7],
];

/** Kategoriye göre tahmin: veritabanında olmayan yemekler türüne göre ortalama değer alır */
const CATEGORIES: [string[], string, number, number, number, number, string, number, Food['group']][] = [
  // [anahtar kelimeler, tür adı, kcal, p, k, y (100 g), birim, gram, grup]
  [['corba'], 'çorba', 60, 2.5, 7, 2.5, 'kase', 250, 'corba'],
  [['salata', 'meze'], 'salata/meze', 90, 2.5, 7, 6, 'porsiyon', 200, 'salata'],
  [['tatli', 'pasta', 'helva'], 'tatlı', 320, 5, 45, 13, 'porsiyon', 120, 'tatli'],
  [['borek', 'pogaca', 'corek', 'pide'], 'hamur işi', 300, 9, 30, 16, 'adet', 120, 'ekmek'],
  [['kebap', 'kebab', 'kebabi', 'sis'], 'kebap', 220, 15, 8, 14, 'porsiyon', 250, 'et'],
  [['kofte'], 'köfte', 240, 15, 8, 16, 'porsiyon', 150, 'et'],
  [['pilav', 'pilavi'], 'pilav', 170, 3.5, 28, 5, 'porsiyon', 180, 'ana'],
  [['makarna', 'eriste', 'manti'], 'makarna', 160, 5.5, 26, 4, 'porsiyon', 250, 'ana'],
  [['dolma', 'dolmasi', 'sarma', 'sarmasi'], 'dolma/sarma', 150, 4, 18, 7, 'porsiyon', 200, 'ana'],
  [['tava', 'kizartma', 'kizartmasi'], 'kızartma', 230, 12, 12, 15, 'porsiyon', 150, 'ana'],
  [['izgara', 'kavurma', 'sote'], 'ızgara/sote', 180, 20, 3, 10, 'porsiyon', 200, 'et'],
  [['yemek', 'yemegi', 'guvec', 'yahni', 'haslama'], 'ev yemeği', 110, 5, 9, 6, 'porsiyon', 250, 'ana'],
  [['sebze', 'sebzeli'], 'sebze yemeği', 70, 2, 8, 3.5, 'porsiyon', 250, 'ana'],
  [['tost', 'sandvic', 'durum', 'burger', 'wrap'], 'sandviç/dürüm', 250, 11, 26, 11, 'adet', 200, 'fastfood'],
  [['kek', 'kurabiye', 'biskuvi', 'bar', 'gofret'], 'atıştırmalık', 430, 6, 58, 19, 'adet', 50, 'tatli'],
  [['suyu', 'icecegi', 'serbet', 'serbeti', 'limonata'], 'içecek', 45, 0.3, 11, 0, 'bardak', 200, 'icecek'],
  [['cayi', 'cay'], 'çay', 2, 0, 0.4, 0, 'bardak', 200, 'icecek'],
  [['kahve', 'kahvesi', 'latte'], 'kahve', 40, 2, 4, 1.5, 'bardak', 250, 'icecek'],
  [['sos', 'sosu', 'ezme', 'ezmesi'], 'sos/ezme', 200, 2, 10, 17, 'yemek kaşığı', 15, 'diger'],
  [['meyve', 'meyvesi'], 'meyve', 55, 0.7, 13, 0.3, 'adet', 150, 'meyve'],
  [['peynir', 'peyniri'], 'peynir', 300, 20, 2, 24, 'dilim', 30, 'kahvalti'],
  [['ekmek', 'ekmegi'], 'ekmek', 260, 9, 50, 3, 'dilim', 50, 'ekmek'],
  [['balik', 'baligi'], 'balık', 170, 20, 2, 9, 'porsiyon', 180, 'et'],
];
const DEFAULT_GUESS_KCAL = 250; // tanınmayan bir porsiyon için kaba ortalama

function categoryFor(tokens: string[]): (typeof CATEGORIES)[number] | undefined {
  // Sondaki kelime türü en iyi anlatır ("kabak çiçeği dolması" → dolma); sağdan sola bak
  for (let i = tokens.length - 1; i >= 0; i--) {
    for (const cat of CATEGORIES) if (cat[0].some((k) => tokenMatches(tokens[i], k))) return cat;
  }
  return undefined;
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
  // 3) Yazım hatası toleransıyla da ara ("tavkk sote", "mercimel çorbası"); belirgin biçimde daha uzun
  // bir ad yakalarsa onu tercih et ("mercimel çorbası" → "çorba" yerine "mercimek çorbası")
  // Tam eşleşme zaten bütün kelimeleri kapsıyorsa yazım hatası araması bir şey katamaz (hız için atlanır)
  const covered = m ? strippedIdx.filter((j) => m!.used.has(j)).length : 0;
  const open = strippedIdx.filter((j) => !m?.used.has(j) && !(cand[j].length > 4 && /(li|lu|siz|suz)$/.test(cand[j])));
  const fz = !m || (open.length > 0 && covered < strippedIdx.length) ? matchFood(strippedIdx.map((j) => cand[j]), extra, true) : undefined;
  if (fz && (!m || (fz.used.size > m.used.size && fz.score * 0.85 > m.score))) m = { ...fz, used: new Set([...fz.used].map((k) => strippedIdx[k])) };
  const unit = unitHit?.unit;
  let estimate = false;

  if (!m) {
    // 4) Türüne göre tahmin ("zencefilli havuç çorbası" → çorba ortalaması)
    const words = strippedIdx.map((j) => cand[j]);
    const cat = categoryFor(words);
    if (cat && words.length) {
      const [, label, kcal, p, c, f, cu, cg, group] = cat;
      m = {
        food: { id: 'tahmini:' + label, name: label, aliases: [], kcal, p, c, f, unit: cu, grams: cg, units: { kase: Math.min(250, Math.round(cg * 1.25)), [cu]: cg }, group, hydration: group === 'icecek' ? 0.85 : undefined },
        used: new Set(strippedIdx),
        score: 0,
      };
      estimate = true;
    }
  }

  if (!m) {
    return {
      item: {
        text: segment.trim(), qty: qty ?? 1, unit: unit ?? '', grams: 0, kcal: 0, p: 0, c: 0, f: 0, hydrationMl: 0,
        label: segment.trim(),
        // Miktar ya da ölçü yazıldıysa bunun bir yiyecek olduğu neredeyse kesin
        estimate: qty !== undefined || !!unit,
      },
    };
  }
  // "domates salatalık" gibi yan yana yazılmış başka bir yemek kaldıysa ayrıca çözülsün
  const used = m.used;
  // "-li/-lı" ekli niteleyiciler ("mantarlı pizza") ayrı yemek sayılmaz
  const left = cand.filter((t, j) => !used.has(j) && !unitHit?.idx.includes(j) && !FILLER.has(t) && !(t.length > 4 && /(li|lu|siz|suz)$/.test(t)) && !['ustu', 'ustune', 'yaninda', 'arasi'].includes(t));
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

  // Sos/niteleyiciler: yemeğin adında zaten yoksa değerine eklenir ("körili tavuk sote" → sote + köri sosu)
  const mods: string[] = [];
  const own = food.aliases.map(fold).join(' ') + ' ' + fold(food.name);
  const ownWords = own.split(/\s+/);
  const addMod = (name: string, p: number, c: number, f: number) => {
    const k = grams / 100;
    n.p = Math.round((n.p + p * k) * 10) / 10;
    n.c = Math.round((n.c + c * k) * 10) / 10;
    n.f = Math.round((n.f + f * k) * 10) / 10;
    n.kcal += Math.round((p * 4 + c * 4 + f * 9) * k);
    mods.push(name);
  };
  if (!food.id.startsWith('custom:') && food.group !== 'icecek') {
    cand.forEach((t, j) => {
      if (used.has(j) || unitHit?.idx.includes(j)) return;
      const mm = /^(.+?)(li|lu)$/.exec(t);
      if (mm) {
        const mod = MODS.find(([stem]) => mm[1] === stem || (stem.length >= 4 && mm[1].startsWith(stem) && mm[1].length - stem.length <= 1));
        if (mod && !ownWords.some((w) => w.startsWith(mod[0])) && !mods.includes(mod[1])) addMod(mod[1], mod[2], mod[3], mod[4]);
      }
      const cm = COOK_MODS.find(([re]) => re.test(t));
      if (cm && !/kizar|pane|tava|citir|nugget/.test(own) && !mods.includes(cm[1])) addMod(cm[1], cm[2], cm[3], cm[4]);
    });
  }
  const qtyText = unitLabel === 'g' || unitLabel === 'ml' ? `${Math.round(q)} ${unitLabel}` : `${formatQty(q)} ${unitLabel}`.trim();
  const item: ParsedItem = {
    text: segment.trim(),
    food,
    qty: q,
    unit: unitLabel,
    grams,
    ...n,
    hydrationMl: food.hydration ? Math.round(grams * food.hydration) : 0,
    label: `${qtyText} ${food.name}${mods.length ? ' + ' + mods.join(', ') : ''}`.replace(/\s+/g, ' ').trim(),
  };
  if (mods.length) item.mods = mods;
  if (estimate) item.estimate = true;
  return { item, leftover };
}

// Yaygın kalıpları ayrıştırmadan önce sadeleştir
const PHRASES: [RegExp, string][] = [
  [/\b(3\s*u\s*1\s*arada|3\s*u\s*bir\s*arada|ucu\s*bir\s*arada)\b/g, 'hazir kahve'],
  [/\byarim ekmek doner\b/g, '1 adet ekmek arasi doner'],
  [/\byarim ekmek kokorec\b/g, '1 porsiyon kokorec'],
  [/\byarim ekmek tantuni\b/g, '1 adet tantuni ekmek'],
  [/\bceyrek ekmek kokorec\b/g, '0.6 porsiyon kokorec'],
  [/\byarim ekmek (kofte|sucuk|tavuk)\b/g, '1 adet hamburger'],
];

/** Serbest metni yemeklere ayırır */
export function parseMealText(text: string, customFoods: Record<string, number> = {}): ParseResult {
  const extra: IndexedAlias[] = customFoodsToFoods(customFoods).map((food) => {
    const tokens = fold(food.name).split(/\s+/);
    return { food, tokens, len: tokens.join('').length, order: -1 };
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
      if (r.item.food && r.item.estimate) {
        // Tahmini kalem: kullanıcının yazdığı adı göster ("1 kase Zencefilli havuç çorbası · tahmini çorba")
        const nm = cleanName(restore(r.item.text));
        const q = r.item.unit === 'g' || r.item.unit === 'ml' ? `${Math.round(r.item.qty)} ${r.item.unit}` : `${formatQty(r.item.qty)} ${r.item.unit}`;
        const shown = nm ? nm.charAt(0).toLocaleUpperCase('tr-TR') + nm.slice(1) : r.item.food.name;
        items.push({ ...r.item, label: `${q} ${shown} (tahmini ${r.item.food.name})`.replace(/\s+/g, ' ').trim() });
      } else if (r.item.food) items.push(r.item);
      else {
        const raw = restore(r.item.text);
        unknown.push(raw);
        const name = cleanName(raw);
        if (name) unknownItems.push({ text: raw, name, qty: r.item.qty, guess: Math.round(DEFAULT_GUESS_KCAL * (r.item.qty || 1)), sure: !!r.item.estimate });
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
