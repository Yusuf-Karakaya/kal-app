// Kettlebell Haftası programı ve antrenman takibi (önceki "Kettlebell Haftası" uygulamasından taşındı)
import { Data, addDays, keyToDate } from './model';

export interface Exercise {
  n: string;
  /** set sayısı */
  s: number;
  /** tekrar / süre */
  r: string;
  /** dinlenme (sn) */
  rest: number;
  /** kettlebell kullanılıyor mu (0 = vücut ağırlığı) */
  kg: number;
  tip: string;
}
export interface Block { t: string; ex: Exercise[] }
export interface WorkoutDay {
  k: string;
  name: string;
  focus: string;
  intro: string;
  /** Tam dinlenme günü */
  rest?: boolean;
  /** Aktif dinlenme (hafif) */
  light?: boolean;
  blocks?: Block[];
}

export const PROGRAM: WorkoutDay[] = [
  { k: 'PZT', name: 'Alt Vücut Güç', focus: 'Bacak · Kalça · Arka zincir',
    intro: 'Tek kettlebell bacak için hafif kalır; zorluğu tempo ve tek bacak varyasyonlarıyla artırıyoruz.',
    blocks: [
      { t: 'Ana hareketler', ex: [
        { n: 'Tempolu Goblet Squat', s: 4, r: '12', rest: 75, kg: 1, tip: '3 sn iniş, dipte 1 sn bekle, güçlü çık. Tempo, hafif ağırlığı ağır hissettirir.' },
        { n: 'Tek Bacak RDL', s: 4, r: '10 / bacak', rest: 60, kg: 1, tip: 'Kettlebell karşı elde. Kalçayı geri it, arka bacak gövdeyle düz bir çizgi olsun. Kalça yere paralel kalsın.' },
        { n: 'Bulgarian Split Squat', s: 3, r: '10 / bacak', rest: 75, kg: 1, tip: 'Arka ayak sandalye/kanepede, kettlebell goblet tutuşta. Ön topuktan it.' }] },
      { t: 'Güç & bitiriş', ex: [
        { n: 'Tek Kol Swing', s: 5, r: '12 / kol', rest: 60, kg: 1, tip: 'Tek elde iki elden belirgin zor. Omuz paketli, gövde dönmesin.' },
        { n: 'Cossack Squat', s: 3, r: '8 / taraf', rest: 45, kg: 1, tip: 'Geniş duruş, bir bacağa otur, diğeri düz. Goblet tutuş dengeyi kolaylaştırır.' },
        { n: 'Tek Bacak Glute Bridge', s: 3, r: '15 / bacak', rest: 45, kg: 1, tip: 'Kettlebell kalça kemiği üstünde. Üstte 2 sn bekle.' }] }] },
  { k: 'SAL', name: 'Üst Vücut İt & Çek', focus: 'Göğüs · Sırt · Omuz',
    intro: 'Tek kol çalışarak her kola tam yükü veriyoruz. Duraklamalar yükü artırır.',
    blocks: [
      { t: 'Süperset A', ex: [
        { n: 'Tek Kol Floor Press', s: 4, r: '12 / kol', rest: 60, kg: 1, tip: 'Dirsek yere değince 1 sn tam dur, sonra it. Diğer el gövdeyi dengeler.' },
        { n: 'Tek Kol Row', s: 4, r: '15 / kol', rest: 60, kg: 1, tip: 'Tepede 2 sn bekle, 3 sn indir. Dirsek kalçaya doğru.' }] },
      { t: 'Süperset B', ex: [
        { n: 'Tek Kol Overhead Press', s: 3, r: '8 / kol', rest: 60, kg: 1, tip: "Rack'ten başla, karın ve kalça kilitli." },
        { n: 'Ayak Yüksek Push-up', s: 3, r: 'Max −2', rest: 75, kg: 0, tip: 'Ayaklar sandalyede. Kolay geliyorsa dipte 2 sn bekle.' }] },
      { t: 'Core & sırt', ex: [
        { n: 'Plank Pull-through', s: 3, r: '8 / taraf', rest: 45, kg: 1, tip: "Yüksek plank'ta kettlebell'i karşı elle altından çek. Kalça dönmesin." },
        { n: 'Kettlebell Pullover', s: 3, r: '12', rest: 45, kg: 1, tip: 'Sırt üstü, boynuzlardan tut, dirsekler hafif bükük. Kaburgalar aşağıda kalsın.' }] }] },
  { k: 'ÇAR', name: 'Aktif Dinlenme', focus: 'Mobilite · Kardiyo', light: true,
    intro: 'Düşük yoğunluk. Amaç toparlanmayı hızlandırmak, yorulmak değil.',
    blocks: [
      { t: 'Hareket', ex: [
        { n: 'Tempolu Yürüyüş', s: 1, r: '30 dk', rest: 0, kg: 0, tip: 'Konuşabileceğin tempoda.' }] },
      { t: 'Mobilite akışı', ex: [
        { n: 'Kettlebell Halo', s: 2, r: '6 / yön', rest: 30, kg: 1, tip: 'Kafanın etrafında yavaş daireler, gövde sabit.' },
        { n: '90/90 Kalça Geçişi', s: 2, r: '8 / taraf', rest: 30, kg: 0, tip: 'Yerde otur, dizleri bir yandan diğerine kontrollü çevir.' },
        { n: 'Goblet Squat Bekleme', s: 2, r: '45 sn', rest: 30, kg: 1, tip: 'Dipte otur, dirseklerle dizleri dışa it.' },
        { n: 'Cat-Cow + Thread the Needle', s: 2, r: '8', rest: 30, kg: 0, tip: 'Omurgayı segment segment hareket ettir.' }] }] },
  { k: 'PER', name: 'Tüm Vücut Güç', focus: 'Clean · Press · Thruster',
    intro: 'Haftanın en zor günü. Hacim ve yoğunlukla tek kettlebell’den maksimum verim.',
    blocks: [
      { t: 'Ana hareketler', ex: [
        { n: 'Tek Kol Clean & Press', s: 5, r: '6 / kol', rest: 75, kg: 1, tip: "Kettlebell önkolun etrafından yumuşak dönsün. Rack'te nefes al, it." },
        { n: 'Goblet Thruster', s: 4, r: '12', rest: 75, kg: 1, tip: "Squat'tan çıkarken momentumla kettlebell'i başın üstüne it." }] },
      { t: 'Kondisyon', ex: [
        { n: 'Swing EMOM', s: 12, r: '15 / dk', rest: 0, kg: 1, tip: '12 dk boyunca her dakika başında 15 iki el swing. Kolay gelirse tek kol, kollar değişmeli.' },
        { n: 'Suitcase Carry', s: 3, r: '60 m / kol', rest: 45, kg: 1, tip: 'Tek elde, gövde dik. Ağırlık hafif olduğu için mesafeyi uzattık.' }] }] },
  { k: 'CUM', name: 'Ön Kol & Core', focus: 'Kavrama · Stabilite',
    intro: 'Get-up ve ön kol için ideal gün. Kontrollü çalış.',
    blocks: [
      { t: 'Stabilite', ex: [
        { n: 'Turkish Get-up', s: 3, r: '3 / kol', rest: 60, kg: 1, tip: 'Gözün hep kettlebell’de. Her aşamada dur, yavaş in.' },
        { n: 'Bottoms-up Carry', s: 3, r: '30 m / kol', rest: 45, kg: 1, tip: 'Kettlebell ters, rack hizasında. Kavrama ve omuz stabilitesi.' },
        { n: 'Dead Bug (KB tutarak)', s: 3, r: '10 / taraf', rest: 45, kg: 1, tip: 'Kettlebell göğüs üstünde düz kollarla. Bel yere yapışık.' }] },
      { t: 'Ön kol devresi', ex: [
        { n: 'Wrist Curl', s: 3, r: '15', rest: 30, kg: 1, tip: 'Ön kol dize dayalı. Ağır gelirse sapı değil gövdeyi tut, kaldıraç kısalır.' },
        { n: 'Reverse Wrist Curl', s: 3, r: '10-12', rest: 30, kg: 1, tip: 'Avuç aşağı, yavaş. Ağır gelirse iki elle yap.' },
        { n: 'Hammer Curl', s: 3, r: '12 / kol', rest: 30, kg: 1, tip: 'Çekiç tutuş, dirsek gövdeye yakın, 3 sn indir.' },
        { n: 'Waiter Walk', s: 3, r: '30 sn / kol', rest: 45, kg: 1, tip: 'Kol yukarı kilitli, omuz paketli, yavaş yürü.' }] }] },
  { k: 'CMT', name: 'Metcon Kompleks', focus: 'Kondisyon · Dayanıklılık',
    intro: "Kettlebell'i yere bırakmadan kompleks turları. Hafif ağırlık burada avantaj.",
    blocks: [
      { t: 'Kompleks · 6 tur', ex: [
        { n: 'Swing → Clean → Press → Squat', s: 6, r: '10/5/5/5', rest: 75, kg: 1, tip: '10 swing, sonra her kolda 5 clean, 5 press, 5 front squat. Kettlebell elden bırakılmaz.' }] },
      { t: 'Bitiriş', ex: [
        { n: 'Kettlebell Snatch', s: 4, r: '10 / kol', rest: 60, kg: 1, tip: 'Kettlebell vücuda yakın yükselir, üstte yumuşakça kola yerleşir.' },
        { n: 'Burpee', s: 3, r: '12', rest: 60, kg: 0, tip: 'Tempoyu koru.' },
        { n: 'Hollow Hold', s: 3, r: '30 sn', rest: 30, kg: 0, tip: 'Bel yerde, kollar ve bacaklar uzak.' }] }] },
  { k: 'PAZ', name: 'Tam Dinlenme', focus: 'Toparlanma', rest: true,
    intro: 'Kas burada büyür. Uyku, protein ve su öncelikli. İstersen hafif yürüyüş.' },
];

const VIDEO: Record<string, string> = {
  'Tempolu Goblet Squat': 'kettlebell goblet squat tempo', 'Tek Bacak RDL': 'kettlebell single leg RDL',
  'Bulgarian Split Squat': 'kettlebell goblet bulgarian split squat', 'Tek Kol Swing': 'one arm kettlebell swing',
  'Cossack Squat': 'kettlebell cossack squat', 'Tek Bacak Glute Bridge': 'single leg glute bridge kettlebell',
  'Tek Kol Floor Press': 'single arm kettlebell floor press', 'Tek Kol Row': 'single arm kettlebell row',
  'Tek Kol Overhead Press': 'single arm kettlebell overhead press', 'Ayak Yüksek Push-up': 'decline push up form',
  'Plank Pull-through': 'kettlebell plank pull through', 'Kettlebell Pullover': 'kettlebell pullover',
  'Kettlebell Halo': 'kettlebell halo', '90/90 Kalça Geçişi': '90 90 hip switch', 'Goblet Squat Bekleme': 'goblet squat hold mobility',
  'Cat-Cow + Thread the Needle': 'cat cow thread the needle', 'Tek Kol Clean & Press': 'kettlebell clean and press',
  'Goblet Thruster': 'kettlebell goblet thruster', 'Swing EMOM': 'kettlebell swing form', 'Suitcase Carry': 'kettlebell suitcase carry',
  'Turkish Get-up': 'kettlebell turkish get up', 'Bottoms-up Carry': 'kettlebell bottoms up carry',
  'Dead Bug (KB tutarak)': 'kettlebell dead bug', 'Wrist Curl': 'kettlebell wrist curl', 'Reverse Wrist Curl': 'kettlebell reverse wrist curl',
  'Hammer Curl': 'kettlebell hammer curl', 'Waiter Walk': 'kettlebell waiter walk',
  'Swing → Clean → Press → Squat': 'kettlebell complex swing clean press squat', 'Kettlebell Snatch': 'kettlebell snatch',
  'Burpee': 'burpee proper form', 'Hollow Hold': 'hollow body hold',
};

/** Hareketin YouTube Shorts aramasının adresi */
export function videoUrl(name: string): string {
  const q = VIDEO[name];
  return q ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' #shorts') : '';
}

export const PROGRESSION_NOTES = [
  'Ağırlık sabit olduğu için ilerleme sırası: önce tekrar ekle (+2), sonra tempoyu yavaşlat, sonra dinlenmeyi 15 sn kısalt.',
  'Tempolu goblet squat 4×15 ve tek kol row 4×20 kolaylaşınca alt vücut ve çekiş için 16-20 kg ikinci bir kettlebell mantıklı olur.',
  'Her antrenmana 5-7 dk ısınmayla başla: halo, hip hinge, hafif swing, kol çevirme.',
  '4. haftada hacmi %30 düşür (deload), sonra yeni döngüye geç.',
];

/** Tarihin programdaki günü (Pazartesi = 0) */
export const programIndex = (key: string) => (keyToDate(key).getDay() + 6) % 7;
export const programFor = (key: string) => PROGRAM[programIndex(key)];
export const exKey = (bi: number, ei: number) => `${bi}-${ei}`;

/** Ağır antrenman günü mü (dinlenme ve aktif dinlenme hariç) */
export const isTrainingDay = (key: string) => {
  const p = programFor(key);
  return !p.rest && !p.light;
};

export function dayProgress(data: Data, key: string) {
  const p = programFor(key);
  const sets = data.workouts?.[key] ?? {};
  let total = 0, done = 0;
  (p.blocks ?? []).forEach((b, bi) => b.ex.forEach((x, ei) => {
    total += x.s;
    done += (sets[exKey(bi, ei)] ?? []).filter(Boolean).length;
  }));
  return { total, done, ratio: total ? done / total : 0 };
}

/** Haftanın (Pazartesi–Pazar) set ilerlemesi */
export function weekProgress(data: Data, key: string) {
  const monday = addDays(key, -programIndex(key));
  let total = 0, done = 0, sessions = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(monday, i);
    const d = dayProgress(data, k);
    total += d.total;
    done += d.done;
    if (isTrainingDay(k) && d.ratio >= 0.5) sessions++;
  }
  return { total, done, ratio: total ? done / total : 0, sessions, planned: PROGRAM.filter((p) => !p.rest && !p.light).length, monday };
}

export function toggleSet(data: Data, key: string, ek: string, si: number): Data {
  const day = { ...(data.workouts?.[key] ?? {}) };
  const arr = [...(day[ek] ?? [])];
  arr[si] = !arr[si];
  day[ek] = arr;
  return { ...data, workouts: { ...(data.workouts ?? {}), [key]: day } };
}

export function resetWorkoutDay(data: Data, key: string): Data {
  const workouts = { ...(data.workouts ?? {}) };
  delete workouts[key];
  return { ...data, workouts };
}

/**
 * Yakılan kalori tahmini: kettlebell çalışması ~9,8 MET (Compendium of Physical Activities),
 * set başına ~45 sn iş + programdaki dinlenme (~2,5 MET). Bilgi amaçlıdır; günlük hedef zaten aktivite katsayısını içerir.
 */
export function burnedKcal(data: Data, key: string): number {
  const p = programFor(key);
  const sets = data.workouts?.[key] ?? {};
  const kg = data.profile.weight;
  const perMin = (met: number) => (met * 3.5 * kg) / 200;
  let kcal = 0;
  (p.blocks ?? []).forEach((b, bi) => b.ex.forEach((x, ei) => {
    const n = (sets[exKey(bi, ei)] ?? []).filter(Boolean).length;
    if (!n) return;
    if (x.r.includes('dk') && x.s === 1) {
      kcal += perMin(3.5) * (parseInt(x.r, 10) || 30); // yürüyüş
      return;
    }
    const work = x.r.includes('/ dk') ? 1 : 0.75;
    kcal += n * (perMin(x.kg ? 9.8 : 8) * work + perMin(2.5) * (x.rest / 60));
  }));
  return Math.round(kcal);
}

/** Antrenman günlerinde (en az bir set yapıldıysa) su hedefine 500 ml eklenir */
export const WORKOUT_WATER_BONUS = 500;
export function waterGoalOn(data: Data, key: string): number {
  const started = dayProgress(data, key).done > 0;
  return data.goals.water + (started && !programFor(key).rest ? WORKOUT_WATER_BONUS : 0);
}
