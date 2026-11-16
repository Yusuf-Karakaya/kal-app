// Kettlebell Haftası programı ve antrenman takibi (önceki "Kettlebell Haftası" uygulamasından taşındı)
import { Activity, Data, addDays, keyToDate } from './model';

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
  /** Aktivite nedeniyle bu gün atlanır (ör. basketbol öncesi/sonrası bacak hareketi) */
  skip?: boolean;
}
export interface Block { t: string; ex: Exercise[]; /** Programdan önce gösterilir (ısınma) */ pre?: boolean }
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
  /** Aktiviteye göre yapılan düzenlemelerin açıklaması */
  notes?: string[];
  /** Kettlebell bu gün isteğe bağlı (aynı gün aktivite yapıldı) */
  optional?: boolean;
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


/**
 * Üst vücut odaklı program: bacaklar haftada ~4–6 setlik "koruma" düzeyinde tutulur (büyümez),
 * göğüs, sırt, omuz ve kollar 10–20 set aralığına çıkarılır. Swing kısa tutulur: amaç yağ yakımı.
 */
export const PROGRAM_UPPER: WorkoutDay[] = [
  { k: 'PZT', name: 'Göğüs & Omuz (İtiş)', focus: 'Göğüs · Omuz · Triseps',
    intro: 'İtiş günü. Duraklamalı tekrarlar tek kettlebell ile göğüs ve omuza yeterli yükü verir.',
    blocks: [
      { t: 'Süperset A', ex: [
        { n: 'Tek Kol Floor Press', s: 4, r: '12 / kol', rest: 60, kg: 1, tip: 'Dirsek yere değince 1 sn tam dur, sonra it. Diğer el gövdeyi dengeler.' },
        { n: 'Ayak Yüksek Push-up', s: 4, r: 'Max −2', rest: 60, kg: 0, tip: 'Ayaklar sandalyede. Kolay geliyorsa dipte 2 sn bekle.' }] },
      { t: 'Süperset B', ex: [
        { n: 'Tek Kol Overhead Press', s: 4, r: '8 / kol', rest: 60, kg: 1, tip: "Rack'ten başla, karın ve kalça kilitli. Belini büzme." },
        { n: 'Kettlebell Pullover', s: 3, r: '12', rest: 45, kg: 1, tip: 'Sırt üstü, boynuzlardan tut, dirsekler hafif bükük. Göğsü ve kanatları esnetir.' }] },
      { t: 'Bitiriş', ex: [
        { n: 'Overhead Triceps Extension', s: 3, r: '12', rest: 45, kg: 1, tip: 'İki elle boynuzlardan tut, kettlebell başın arkasına insin; dirsekler öne baksın, açılmasın.' }] }] },
  { k: 'SAL', name: 'Sırt & Biseps (Çekiş)', focus: 'Sırt · Biseps · Arka omuz',
    intro: 'Çekiş günü. Geniş bir sırt bel çizgisini daha ince gösterir.',
    blocks: [
      { t: 'Ana hareketler', ex: [
        { n: 'Tek Kol Row', s: 5, r: '15 / kol', rest: 60, kg: 1, tip: 'Tepede 2 sn bekle, 3 sn indir. Dirsek kalçaya doğru.' },
        { n: 'Kettlebell High Pull', s: 4, r: '10 / kol', rest: 60, kg: 1, tip: 'Kalçadan hafif itme al, dirseği yukarı ve geriye çek; kettlebell göğüs hizasında dursun.' }] },
      { t: 'Kol', ex: [
        { n: 'Kettlebell Curl', s: 4, r: '10 / kol', rest: 45, kg: 1, tip: 'Sapın tutamağından tut, dirsek gövdeye yapışık, 3 sn indir. Gövdeyi sallama.' },
        { n: 'Hammer Curl', s: 3, r: '12 / kol', rest: 45, kg: 1, tip: 'Çekiç tutuş, dirsek gövdeye yakın, 3 sn indir.' }] },
      { t: 'Core', ex: [
        { n: 'Plank Pull-through', s: 3, r: '8 / taraf', rest: 45, kg: 1, tip: "Yüksek plank'ta kettlebell'i karşı elle altından çek. Kalça dönmesin." },
        { n: 'Suitcase Carry', s: 3, r: '40 m / kol', rest: 45, kg: 1, tip: 'Tek elde, gövde dik, yan karın sıkı.' }] }] },
  PROGRAM[2], // Aktif dinlenme
  { k: 'PER', name: 'Üst Vücut Güç', focus: 'Clean · Press · Push-up',
    intro: 'Haftanın en yoğun günü; yük omuz, sırt ve göğüste. Swing kısa ve yağ yakımı için.',
    blocks: [
      { t: 'Ana hareketler', ex: [
        { n: 'Tek Kol Clean & Press', s: 5, r: '6 / kol', rest: 75, kg: 1, tip: "Kettlebell önkolun etrafından yumuşak dönsün. Rack'te nefes al, it." },
        { n: 'Clean → Press → Push-up', s: 4, r: '5 / kol', rest: 75, kg: 1, tip: '1 clean, 1 press, kettlebell’i bırak, 1 push-up: bu bir tekrar. Diğer kola geç.' }] },
      { t: 'Kondisyon', ex: [
        { n: 'Swing EMOM', s: 8, r: '12 / dk', rest: 0, kg: 1, tip: '8 dk boyunca her dakika başında 12 iki el swing. Amaç nabzı yükseltmek; bacağı yormaya çalışma.' },
        { n: 'Turkish Get-up', s: 3, r: '2 / kol', rest: 60, kg: 1, tip: 'Gözün hep kettlebell’de. Her aşamada dur, yavaş in.' }] }] },
  { k: 'CUM', name: 'Kollar & Core', focus: 'Biseps · Triseps · Ön kol',
    intro: 'Kol günü. Süperset yaparak kısa sürede yüksek hacim.',
    blocks: [
      { t: 'Süperset', ex: [
        { n: 'Kettlebell Curl', s: 3, r: '10 / kol', rest: 30, kg: 1, tip: 'Dirsek sabit, tepede sık, 3 sn indir.' },
        { n: 'Close-grip Push-up', s: 3, r: 'Max −2', rest: 45, kg: 0, tip: 'Eller omuz genişliğinden dar, dirsekler gövdeye yakın iner. Triseps çalışır.' },
        { n: 'Overhead Triceps Extension', s: 2, r: '12', rest: 45, kg: 1, tip: 'Dirsekler öne baksın, kettlebell başın arkasına kontrollü insin.' }] },
      { t: 'Ön kol & core', ex: [
        { n: 'Hammer Curl', s: 3, r: '12 / kol', rest: 30, kg: 1, tip: 'Çekiç tutuş, dirsek gövdeye yakın, 3 sn indir.' },
        { n: 'Wrist Curl', s: 2, r: '15', rest: 30, kg: 1, tip: 'Ön kol dize dayalı. Ağır gelirse gövdeden tut.' },
        { n: 'Waiter Walk', s: 2, r: '30 sn / kol', rest: 45, kg: 1, tip: 'Kol yukarı kilitli, omuz paketli, yavaş yürü.' },
        { n: 'Dead Bug (KB tutarak)', s: 3, r: '10 / taraf', rest: 45, kg: 1, tip: 'Kettlebell göğüs üstünde düz kollarla. Bel yere yapışık.' }] }] },
  { k: 'CMT', name: 'Kondisyon & Bacak Koruma', focus: 'Kondisyon · Omuz · Koruma',
    intro: 'Yağ yakımı için kondisyon. Bacak sadece koruma düzeyinde: büyütmek değil, diz ve kalça sağlığını korumak için.',
    blocks: [
      { t: 'Kondisyon', ex: [
        { n: 'Kettlebell Snatch', s: 4, r: '8 / kol', rest: 60, kg: 1, tip: 'Kettlebell vücuda yakın yükselir, üstte yumuşakça kola yerleşir.' },
        { n: 'Burpee', s: 3, r: '10', rest: 60, kg: 0, tip: 'Tempoyu koru.' },
        { n: 'Hollow Hold', s: 3, r: '30 sn', rest: 30, kg: 0, tip: 'Bel yerde, kollar ve bacaklar uzak.' }] },
      { t: 'Bacak koruma', ex: [
        { n: 'Goblet Squat (hafif)', s: 2, r: '12', rest: 60, kg: 1, tip: 'Sadece koruma: tempo yok, duraklama yok, tükenişe gitme. Bacak büyütmek için değil, eklem sağlığı için.' }] }] },
  PROGRAM[6], // Tam dinlenme
];

export type Focus = 'balanced' | 'upper';
export const PROGRAMS: Record<Focus, WorkoutDay[]> = { balanced: PROGRAM, upper: PROGRAM_UPPER };
export const FOCUS_LABEL: Record<Focus, string> = { balanced: 'Dengeli', upper: 'Üst vücut odaklı' };
export const focusOf = (data?: Pick<Data, 'programFocus'>): Focus => data?.programFocus ?? 'balanced';
export const programOf = (data?: Pick<Data, 'programFocus'>) => PROGRAMS[focusOf(data)];

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
  'Overhead Triceps Extension': 'kettlebell overhead triceps extension', 'Kettlebell High Pull': 'kettlebell high pull',
  'Kettlebell Curl': 'kettlebell bicep curl', 'Close-grip Push-up': 'close grip push up',
  'Clean → Press → Push-up': 'kettlebell clean press push up complex', 'Goblet Squat (hafif)': 'kettlebell goblet squat form',
  'Baldır esnetme': 'calf stretch wall soleus', 'Kalça fleksör esnetme': 'hip flexor stretch half kneeling', 'Ayak bileği mobilitesi': 'ankle mobility knee to wall',
  'Hafif koşu ve yan adım': 'basketball dynamic warm up', 'Bacak sallama': 'leg swings warm up', 'Rotasyonlu hamle (lunge)': 'lunge with rotation warm up',
  'Kol çevirme ve omuz açma': 'arm circles shoulder warm up', 'Hafif sıçrama (pogo)': 'pogo jumps warm up',
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
/** Tarihe denk gelen program günü (veri verilirse seçili program odağına göre) */
/** Tarihe denk gelen program günü; veri verilirse program odağı ve aktivitelere göre düzenlenir */
export function programFor(key: string, data?: Pick<Data, 'programFocus'> & Partial<Pick<Data, 'activities' | 'activityLog'>>): WorkoutDay {
  const base = programOf(data)[programIndex(key)];
  return data && data.activities?.length ? adjustForActivities(data as Data, key, base) : base;
}
/** Set anahtarı. Üst vücut programının setleri "u" önekiyle saklanır; böylece program değişince eski kayıtlar karışmaz. */
export const exKey = (bi: number, ei: number, data?: Pick<Data, 'programFocus'>) => `${focusOf(data) === 'upper' ? 'u' : ''}${bi}-${ei}`;

/** Saklanan bir set anahtarının hangi harekete ait olduğunu bulur */
export function resolveExercise(key: string, ek: string): Exercise | undefined {
  const upper = ek.startsWith('u');
  const [bi, ei] = (upper ? ek.slice(1) : ek).split('-').map(Number);
  return PROGRAMS[upper ? 'upper' : 'balanced'][programIndex(key)].blocks?.[bi]?.ex[ei];
}

/** Ağır antrenman günü mü (dinlenme ve aktif dinlenme hariç) */
export const isTrainingDay = (key: string, data?: Pick<Data, 'programFocus'>) => {
  const p = programFor(key, data);
  return !p.rest && !p.light;
};

export function dayProgress(data: Data, key: string) {
  const p = programFor(key, data);
  const sets = data.workouts?.[key] ?? {};
  let total = 0, done = 0;
  (p.blocks ?? []).forEach((b, bi) => b.ex.forEach((x, ei) => {
    if (x.skip) return;
    total += x.s;
    done += Math.min(x.s, (sets[exKey(bi, ei, data)] ?? []).filter(Boolean).length);
  }));
  return { total, done, ratio: total ? done / total : 0 };
}


/* ===================== Dış aktiviteler (basketbol vb.) ===================== */
export interface ActivityType {
  label: string;
  icon: string;
  /** Compendium of Physical Activities MET değeri */
  met: number;
  /** Bacakları ve sıçramayı yoğun kullanıyor mu (önceki/sonraki gün düzenlemesi için) */
  legLoad: boolean;
  /** Kol/el becerisi gerektiriyor mu (şut, top kontrolü): öncesinde kavrama ve triseps yorulmamalı */
  upperSkill: boolean;
  /** Kas haritasına katkı (yaklaşık etkili set) */
  muscles: Record<string, number>;
}

export const ACTIVITY_TYPES: Record<Activity['type'], ActivityType> = {
  basketball: { label: 'Basketbol', icon: '🏀', met: 6.5, legLoad: true, upperSkill: true, muscles: { calves: 2, quads: 1, hamstrings: 1, glutes: 1 } },
  football: { label: 'Futbol', icon: '⚽', met: 7, legLoad: true, upperSkill: false, muscles: { calves: 1.5, quads: 1.5, hamstrings: 1.5, adductors: 1 } },
  running: { label: 'Koşu', icon: '🏃', met: 8.3, legLoad: true, upperSkill: false, muscles: { calves: 2, quads: 1, hamstrings: 1 } },
  cycling: { label: 'Bisiklet', icon: '🚴', met: 6.8, legLoad: true, upperSkill: false, muscles: { quads: 2, glutes: 1, calves: 1 } },
  swimming: { label: 'Yüzme', icon: '🏊', met: 6, legLoad: false, upperSkill: false, muscles: { upperback: 2, shoulders: 2, chest: 1, triceps: 1 } },
  other: { label: 'Diğer', icon: '⭐', met: 5, legLoad: false, upperSkill: false, muscles: {} },
};

/** O güne planlanmış aktiviteler */
export function activitiesOn(data: Pick<Data, 'activities'>, key: string): Activity[] {
  const idx = programIndex(key);
  return (data.activities ?? []).filter((a) => a.day === idx);
}
/**
 * Aktivite durumu: true = gitti (tik), false = gitmedi / gitmeyecek, undefined = planlı (gidileceği varsayılır).
 * Program, planlı ya da yapılmış aktiviteye göre düzenlenir; "gitmedim" seçilirse düzenleme kalkar.
 */
export const activityState = (data: Pick<Data, 'activityLog'>, key: string, id: string): boolean | undefined => data.activityLog?.[key]?.[id];
export const activityDone = (data: Pick<Data, 'activityLog'>, key: string, id: string) => activityState(data, key, id) === true;
export const activitySkipped = (data: Pick<Data, 'activityLog'>, key: string, id: string) => activityState(data, key, id) === false;

function setActivity(data: Data, key: string, id: string, value: boolean | undefined): Data {
  const day = { ...(data.activityLog?.[key] ?? {}) };
  if (value === undefined) delete day[id];
  else day[id] = value;
  return { ...data, activityLog: { ...(data.activityLog ?? {}), [key]: day } };
}
/** "Gittim" kutusu: işaretle / kaldır */
export const toggleActivity = (data: Data, key: string, id: string) => setActivity(data, key, id, activityDone(data, key, id) ? undefined : true);
/** "Gitmedim / gitmeyeceğim": program normale döner; tekrar basılınca plana geri döner */
export const toggleActivitySkip = (data: Data, key: string, id: string) => setActivity(data, key, id, activitySkipped(data, key, id) ? undefined : false);

/** O gün yapılan (tiklenen) aktiviteler */
export const doneActivities = (data: Data, key: string) => activitiesOn(data, key).filter((a) => activityDone(data, key, a.id));

/** Aktivitelerde yakılan tahmini kalori */
export function activityKcal(data: Data, key: string): number {
  return Math.round(doneActivities(data, key)
    .reduce((s, a) => s + (ACTIVITY_TYPES[a.type].met * 3.5 * data.profile.weight / 200) * a.minutes, 0));
}

/** Bacak ağırlıklı hareketler (squat, RDL, köprü, thruster) */
const LEG_PRIMARY = new Set([
  'Tempolu Goblet Squat', 'Tek Bacak RDL', 'Bulgarian Split Squat', 'Cossack Squat', 'Tek Bacak Glute Bridge',
  'Goblet Thruster', 'Goblet Squat (hafif)', 'Goblet Squat Bekleme',
]);
/** Sıçramalı / patlayıcı, bacakları yoran hareketler */
const BALLISTIC = new Set(['Tek Kol Swing', 'Swing EMOM', 'Swing → Clean → Press → Squat', 'Kettlebell Snatch', 'Burpee']);
/** Kavrama ve ön kolu yoran hareketler (top kontrolü, şut bileği) */
const GRIP = new Set(['Wrist Curl', 'Reverse Wrist Curl', 'Hammer Curl', 'Waiter Walk', 'Suitcase Carry', 'Bottoms-up Carry', 'Kettlebell Curl']);
/** Dirsek açan kasları (triseps) yoran hareketler: şutun ana kası */
const TRICEPS = new Set(['Overhead Triceps Extension', 'Close-grip Push-up', 'Ayak Yüksek Push-up', 'Tek Kol Floor Press']);

const RECOVERY_BLOCK: Block = {
  t: 'Basketbol sonrası toparlanma',
  ex: [
    { n: 'Baldır esnetme', s: 2, r: '45 sn / bacak', rest: 15, kg: 0, tip: 'Duvara yaslan, arka bacak düz, topuk yerde. Ardından dizi hafif bükerek tekrarla (soleus).' },
    { n: 'Kalça fleksör esnetme', s: 2, r: '45 sn / taraf', rest: 15, kg: 0, tip: 'Yarım diz çök, kalçayı sık ve öne it; beli büzme.' },
    { n: 'Ayak bileği mobilitesi', s: 2, r: '10 / yön', rest: 15, kg: 0, tip: 'Ayak bileğini iki yöne yavaş çevir, sonra dizi parmak ucuna doğru it (diz-duvar testi).' },
  ],
};

/** Basketbol öncesi 10 dk dinamik ısınma (yorgunluk yapmaz, isabeti ve sıçramayı destekler) */
const WARMUP_BLOCK: Block = {
  t: 'Basketbol öncesi ısınma · 10 dk',
  pre: true,
  ex: [
    { n: 'Hafif koşu ve yan adım', s: 1, r: '3 dk', rest: 0, kg: 0, tip: 'Konuşabileceğin tempoda başla, son dakika yan adım ve geri geri koşu.' },
    { n: 'Bacak sallama', s: 1, r: '10 / yön / bacak', rest: 0, kg: 0, tip: 'Önden arkaya ve yandan yana, kontrollü; kalçayı açar.' },
    { n: 'Rotasyonlu hamle (lunge)', s: 1, r: '6 / taraf', rest: 0, kg: 0, tip: 'Hamle yap, gövdeyi öndeki bacağa doğru çevir. Ağırlık yok.' },
    { n: 'Kol çevirme ve omuz açma', s: 1, r: '10 / yön', rest: 0, kg: 0, tip: 'Küçük daireden büyüğe; sonra kolları göğüs önünde aç-kapa.' },
    { n: 'Hafif sıçrama (pogo)', s: 1, r: '2 × 10', rest: 20, kg: 0, tip: 'Ayak bileğinden, yere az temas ederek. Yormadan kas-tendonu hazırlar.' },
  ],
};

const legActs = (data: Data, key: string) => activitiesOn(data, key).filter((a) => ACTIVITY_TYPES[a.type].legLoad);
/** Planlı ya da yapılmış ("gitmedim" denmemiş) aktiviteler */
const activeActs = (data: Data, key: string) => legActs(data, key).filter((a) => !activitySkipped(data, key, a.id));

/**
 * Aktiviteye göre günü düzenler (bilimsel dayanak: yorgunluk şut isabetini ve sıçramayı düşürür,
 * kas hasarı sprint/yön değiştirmeyi 48 saate kadar etkiler). Hareketler silinmez, "skip" ile
 * işaretlenir ya da seti azaltılır; saklanan set anahtarları (blok-hareket) değişmez.
 * - Önceki gün (plana göre): bacak yarıya, sıçrama yok; basketbolsa triseps/kavrama -1 set, tükenişe gitme.
 * - Aktivite günü (plana göre): kettlebell sadece aktiviteden SONRA ve isteğe bağlı; bacak, sıçrama,
 *   kavrama ve triseps hareketleri yok; başta 10 dk ısınma.
 * - Sonraki gün (gittiysen): bacak/sıçrama yok, toparlanma hareketleri eklenir.
 * - Hafta içinde gidildiyse: üst vücut programındaki "bacak koruma" squat'ı atlanır.
 * - "Gitmedim" seçilirse o aktivite için hiçbir düzenleme yapılmaz.
 */
export function adjustForActivities(data: Data, key: string, base: WorkoutDay): WorkoutDay {
  const tomorrow = activeActs(data, addDays(key, 1));
  const today = activeActs(data, key);
  const yesterdayKey = addDays(key, -1);
  const yesterday = legActs(data, yesterdayKey).filter((a) => activityDone(data, yesterdayKey, a.id));
  const monday = addDays(key, -programIndex(key));
  let doneThisWeek = false;
  for (let k = monday; k < key; k = addDays(k, 1)) if (legActs(data, k).some((a) => activityDone(data, k, a.id))) doneThisWeek = true;
  if (!tomorrow.length && !today.length && !yesterday.length && !doneThisWeek) return base;

  const day: WorkoutDay = JSON.parse(JSON.stringify(base));
  const notes: string[] = [];
  const name = (list: Activity[]) => list.map((a) => a.name.toLocaleLowerCase('tr-TR')).join(', ');
  const skill = (list: Activity[]) => list.some((a) => ACTIVITY_TYPES[a.type].upperSkill);
  const each = (fn: (x: Exercise) => void) => (day.blocks ?? []).forEach((b) => b.ex.forEach(fn));

  if (today.length) {
    const sk = skill(today);
    if (day.blocks) {
      each((x) => {
        if (LEG_PRIMARY.has(x.n) || BALLISTIC.has(x.n) || (sk && (GRIP.has(x.n) || TRICEPS.has(x.n)))) x.skip = true;
        else x.s = Math.max(2, x.s - 1);
      });
      day.optional = true;
    }
    if (sk) (day.blocks ??= []).push(JSON.parse(JSON.stringify(WARMUP_BLOCK)));
    const title = today.map((a) => a.name).join(', ');
    notes.push(day.rest
      ? `${title} günü: öncesinde 10 dk ısın, sonrasında dinlen.`
      : `${title} günü: kettlebell'i sadece bu aktiviteden SONRA yap ya da hiç yapma. Öncesinde yaparsan kol, el ve bacak yorgunluğu şut isabetini ve sıçramanı düşürür.`
        + (sk ? ' Kavrama, ön kol ve triseps hareketleri bu yüzden çıkarıldı; başa 10 dk ısınma eklendi.' : ''));
  } else if (yesterday.length && day.blocks && !day.rest) {
    each((x) => { if (LEG_PRIMARY.has(x.n) || BALLISTIC.has(x.n)) x.skip = true; });
    day.blocks.push(JSON.parse(JSON.stringify(RECOVERY_BLOCK)));
    notes.push(`Bir önceki gün ${name(yesterday)} yapıldı: bacak ve sıçrama hareketleri çıkarıldı, toparlanma hareketleri eklendi.`);
  } else if (tomorrow.length && day.blocks && !day.rest) {
    const sk = skill(tomorrow);
    let legChanged = false, armChanged = false;
    each((x) => {
      if (BALLISTIC.has(x.n)) { x.skip = true; legChanged = true; }
      else if (LEG_PRIMARY.has(x.n)) { x.s = Math.max(2, Math.ceil(x.s / 2)); legChanged = true; }
      else if (sk && (GRIP.has(x.n) || TRICEPS.has(x.n))) { x.s = Math.max(2, x.s - 1); armChanged = true; }
    });
    const parts: string[] = [];
    if (legChanged) parts.push('bacak hacmi azaltıldı, sıçramalı hareketler çıkarıldı');
    if (armChanged) parts.push('triseps ve kavrama hareketlerinden birer set düşüldü');
    notes.push(`Ertesi gün ${name(tomorrow)} var: ${parts.length ? parts.join('; ') : 'bu günün programı zaten bacakları yormuyor'}.`
      + ' Hiçbir sette tükenişe gitme, 2–3 tekrar yedek bırak: kas ağrısı 24–48 saat performansı düşürür.');
  }
  if (doneThisWeek && focusOf(data) === 'upper') {
    let changed = false;
    each((x) => { if (x.n === 'Goblet Squat (hafif)' && !x.skip) { x.skip = true; changed = true; } });
    if (changed) notes.push('Bu hafta basketbol bacaklarını yeterince çalıştırdı: bacak koruma squat’ı atlandı.');
  }
  if (!notes.length) return base;
  day.notes = notes;
  return day;
}

/** Haftanın (Pazartesi–Pazar) set ilerlemesi */
export function weekProgress(data: Data, key: string) {
  const monday = addDays(key, -programIndex(key));
  let total = 0, done = 0, sessions = 0, activityPlanned = 0, activityDoneCount = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(monday, i);
    const d = dayProgress(data, k);
    total += d.total;
    done += d.done;
    if (isTrainingDay(k, data) && d.ratio >= 0.5) sessions++;
    activityPlanned += activitiesOn(data, k).length;
    activityDoneCount += activitiesOn(data, k).filter((a) => activityDone(data, k, a.id)).length;
  }
  return {
    total, done, ratio: total ? done / total : 0, sessions, planned: programOf(data).filter((p) => !p.rest && !p.light).length, monday,
    activityPlanned, activityDone: activityDoneCount,
  };
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
  const sets = data.workouts?.[key] ?? {};
  const kg = data.profile.weight;
  const perMin = (met: number) => (met * 3.5 * kg) / 200;
  let kcal = 0;
  for (const [ek, arr] of Object.entries(sets)) {
    const x = resolveExercise(key, ek);
    const n = arr.filter(Boolean).length;
    if (!x || !n) continue;
    if (x.r.includes('dk') && x.s === 1) {
      kcal += perMin(3.5) * (parseInt(x.r, 10) || 30); // yürüyüş
      continue;
    }
    const work = x.r.includes('/ dk') ? 1 : 0.75;
    kcal += n * (perMin(x.kg ? 9.8 : 8) * work + perMin(2.5) * (x.rest / 60));
  }
  return Math.round(kcal);
}

/** Antrenman günlerinde (en az bir set yapıldıysa) su hedefine 500 ml eklenir */
export const WORKOUT_WATER_BONUS = 500;
export function waterGoalOn(data: Data, key: string): number {
  const started = dayProgress(data, key).done > 0;
  const kb = started && !programFor(key, data).rest ? WORKOUT_WATER_BONUS : 0;
  // Dış aktivite: dakika başına ~6 ml (90 dk basketbol ≈ +550 ml)
  const act = Math.round(doneActivities(data, key).reduce((s, a) => s + a.minutes * 6, 0) / 50) * 50;
  return data.goals.water + Math.min(1000, kb + act);
}
