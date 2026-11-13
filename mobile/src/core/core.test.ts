// Çekirdek testleri: `npm run test:core`
import assert from 'node:assert/strict';
import { parseMealText } from './parse';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

function ids(text: string) {
  return parseMealText(text).items.map((i) => i.food?.id);
}
function first(text: string) {
  const r = parseMealText(text);
  assert.ok(r.items[0], `"${text}" için yemek bulunamadı`);
  return r.items[0];
}

test('virgül ve "ve" ile ayrılmış liste', () => {
  assert.deepEqual(ids('2 yumurta, 1 dilim beyaz peynir ve 5 zeytin'), ['yumurta', 'beyaz-peynir', 'siyah-zeytin']);
});

test('ayraçsız sayı dizisi', () => {
  assert.deepEqual(ids('2 yumurta 1 dilim ekmek 1 bardak çay'), ['yumurta', 'ekmek', 'cay']);
});

test('yazıyla sayı ve buçuk', () => {
  const i = first('iki buçuk dilim ekmek');
  assert.equal(i.qty, 2.5);
  assert.equal(i.grams, 75);
});

test('yarım ekmek = yarım somun', () => {
  const i = first('yarım ekmek');
  assert.equal(i.food?.id, 'ekmek');
  assert.equal(i.grams, 125);
});

test('gram ile', () => {
  const i = first('150 gr tavuk göğüs');
  assert.equal(i.food?.id, 'tavuk-gogus');
  assert.equal(i.grams, 150);
  assert.equal(i.kcal, 248);
});

test('bitişik gram', () => {
  assert.equal(first('200g yoğurt').grams, 200);
});

test('ekli kelimeler ve öğün tespiti', () => {
  const r = parseMealText('kahvaltıda ekmeği ve çayı içtim');
  assert.equal(r.meal, 'kahvalti');
  assert.deepEqual(r.items.map((i) => i.food?.id), ['ekmek', 'cay']);
});

test('Türkçe karakter olmadan', () => {
  assert.deepEqual(ids('1 kase mercimek corbasi, 1 porsiyon tavuk sis, cacik'), ['mercimek-corbasi', 'tavuk-sis', 'cacik']);
});

test('uzun ad kısa addan önce gelir', () => {
  assert.equal(first('1 bardak portakal suyu').food?.id, 'portakal-suyu');
  assert.equal(first('türk kahvesi').food?.id, 'turk-kahvesi');
  assert.equal(first('şekerli türk kahvesi').food?.id, 'sekerli-turk-kahvesi');
  assert.equal(first('patates kızartması').food?.id, 'patates-kizartmasi');
  assert.equal(first('tavuk döner').food?.id, 'doner-tavuk');
});

test('-li eki niteleyicidir', () => {
  assert.equal(first('peynirli tost').food?.id, 'tost');
  assert.equal(first('yumurtalı menemen').food?.id, 'menemen');
});

test('su ve içecekler sıvıya sayılır', () => {
  const su = first('2 bardak su');
  assert.equal(su.hydrationMl, 400);
  assert.equal(su.kcal, 0);
  const ayran = first('1 ayran');
  assert.equal(ayran.hydrationMl, 180);
  assert.equal(first('1 şişe su').hydrationMl, 500);
  assert.equal(first('500 ml su').hydrationMl, 500);
  assert.equal(first('bira').hydrationMl, 0);
});

test('su bardağı birimi su sanılmaz', () => {
  const i = first('1 su bardağı süt');
  assert.equal(i.food?.id, 'sut');
  assert.equal(i.grams, 200);
});

test('yemek kaşığı', () => {
  const i = first('2 yemek kaşığı bal');
  assert.equal(i.food?.id, 'bal');
  assert.equal(i.grams, 40);
});

test('tanınmayan parça raporlanır', () => {
  const r = parseMealText('1 lahmacun ve 1 tabak xyzabc');
  assert.deepEqual(r.items.map((i) => i.food?.id), ['lahmacun']);
  assert.equal(r.unknown.length, 1);
});

test('tanınmayan parçanın adı ve miktarı çıkarılır', () => {
  const r = parseMealText('2 kase Amarant');
  assert.deepEqual(r.unknownItems, [{ text: '2 kase amarant', name: 'amarant', qty: 2 }]);
  assert.equal(parseMealText('1 yemek kaşığı kuşkonmaz').unknownItems[0].name, 'kuşkonmaz');
  assert.equal(parseMealText('kuzu tandır yedim').unknownItems[0].name, 'kuzu tandır');
});

test('kişisel yemekte ölçü 1 porsiyon sayılır', () => {
  const r = parseMealText('2 kase amarant', { amarant: 220 });
  assert.equal(r.items[0].kcal, 440);
});

test('kendi eklenen yemekler tanınır', () => {
  const r = parseMealText('2 annemin böreği', { 'annemin böreği': 300 });
  assert.equal(r.items[0].food?.name, 'annemin böreği');
  assert.equal(r.items[0].kcal, 600);
});

test('miktar sonda da yazılabilir, niteleyici ayrı yemek olmaz', () => {
  const r = parseMealText('mantarlı pizza 2 dilim');
  assert.deepEqual(r.items.map((i) => [i.food?.id, i.qty]), [['pizza', 2]]);
  assert.deepEqual(r.unknown, []);
});

test('ölçü sanılan kelimeler yemek adında kullanılabilir', () => {
  assert.equal(first('2 şiş tavuk şiş').food?.id, 'tavuk-sis');
  assert.equal(first('2 şiş tavuk şiş').grams, 120);
  assert.equal(first('patates yemeği').food?.id, 'patates-yemegi');
  assert.equal(first('1 somun ekmek').grams, 250);
});

test('yarım ekmek döner', () => {
  assert.equal(first('yarım ekmek döner').food?.id, 'yarim-ekmek-doner');
});

test('3ü 1 arada', () => {
  assert.equal(first('2 tane 3ü 1 arada').food?.id, '3u1-arada');
});

test('gerçekçi gün', () => {
  const r = parseMealText(
    'Sabah 2 haşlanmış yumurta, 2 dilim tam buğday ekmeği, 1 dilim beyaz peynir, 6 zeytin, domates salatalık ve 2 bardak çay',
  );
  assert.equal(r.items.length, 7);
  assert.equal(r.meal, 'kahvalti');
  const kcal = r.items.reduce((s, i) => s + i.kcal, 0);
  assert.ok(kcal > 400 && kcal < 550, `toplam ${kcal}`);
});


/* ---------- model ve analizler ---------- */
import {
  DEFAULT_DATA, addDays, addDrink, addParsedItems, copyMeal, estimateTdee, macroGoals, migrate, recentFoods,
  setWeight, totals, waterStreak, weightTrend, weeklyRate,
} from './index';

test('v1 verisi taşınır ve makro hedefi üretilir', () => {
  const v1 = { profile: { weight: 80, goal: -500 }, goals: { cal: 1800, water: 2800 }, days: {} };
  const d = migrate(v1);
  assert.equal(d.version, 2);
  assert.ok(d.goals.p >= 140 && d.goals.p <= 150, `protein ${d.goals.p}`);
  assert.deepEqual(d.weights, {});
});

test('makro hedefleri kaloriyle tutarlı', () => {
  const m = macroGoals(2000, 70, 0);
  const kcal = m.p * 4 + m.c * 4 + m.f * 9;
  assert.ok(Math.abs(kcal - 2000) < 20, `toplam ${kcal}`);
});

test('ayrıştırılan kalemler eklenir, içecekler suya sayılır', () => {
  const r = parseMealText('2 yumurta ve 2 bardak su ve 1 ayran');
  const d = addParsedItems(structuredClone(DEFAULT_DATA), '2026-01-01', r.items, 'kahvalti');
  const t = totals(d, '2026-01-01');
  assert.equal(t.water, 580);
  assert.equal(t.cal, 155 + 72);
  assert.equal(d.days['2026-01-01'].food.length, 2); // su yemek listesine girmez
});

test('içecek ekleme: kahve sıvıya %80 sayılır', () => {
  const d = addDrink(structuredClone(DEFAULT_DATA), '2026-01-01', 'filtre-kahve', 250);
  assert.equal(totals(d, '2026-01-01').water, 200);
  assert.equal(d.days['2026-01-01'].food.length, 1);
});

test('öğün kopyalama', () => {
  let d = addParsedItems(structuredClone(DEFAULT_DATA), '2026-01-01', parseMealText('menemen, 2 dilim ekmek').items, 'kahvalti');
  d = copyMeal(d, '2026-01-01', '2026-01-02', 'kahvalti');
  assert.equal(totals(d, '2026-01-02').cal, totals(d, '2026-01-01').cal);
});

test('kilo trendi dalgalanmayı yumuşatır', () => {
  let d = structuredClone(DEFAULT_DATA);
  const start = '2026-01-01';
  for (let i = 0; i < 28; i++) d = setWeight(d, addDays(start, i), 80 - i * 0.07 + (i % 2 ? 0.6 : -0.6));
  const tr = weightTrend(d.weights, addDays(start, 27));
  const rate = weeklyRate(tr)!;
  assert.ok(rate < -0.2 && rate > -0.8, `hız ${rate}`);
  assert.equal(d.profile.weight, d.weights[addDays(start, 27)]);
});

test('uyarlanır harcama tahmini', () => {
  // Günde 2000 kcal yiyip haftada 0,5 kg veren biri: harcama ≈ 2000 + 550
  let d = structuredClone(DEFAULT_DATA);
  const today = '2026-02-01';
  for (let i = 1; i <= 35; i++) {
    const k = addDays(today, -i);
    d = setWeight(d, k, 80 + (i * 0.5) / 7);
    d.days[k] = { food: [{ id: 'x' + i, name: 'gün', cal: 2000, meal: 'ogle', t: 0 }], water: [] };
  }
  const est = estimateTdee(d, today)!;
  assert.ok(est, 'tahmin üretilmedi');
  assert.ok(est.tdee > 2350 && est.tdee < 2750, `harcama ${est.tdee}`);
});

test('yetersiz veride tahmin yok', () => {
  assert.equal(estimateTdee(structuredClone(DEFAULT_DATA)), null);
});

test('su serisi', () => {
  const d = structuredClone(DEFAULT_DATA);
  const today = '2026-03-10';
  for (let i = 1; i <= 4; i++) d.days[addDays(today, -i)] = { food: [], water: [{ id: 'w' + i, ml: 3000, t: 0 }] };
  assert.equal(waterStreak(d, today), 4); // bugün henüz tamamlanmadı, dünden geriye sayar
});

test('son yenenler sıklığa göre', () => {
  let d = structuredClone(DEFAULT_DATA);
  const today = '2026-03-10';
  for (let i = 0; i < 3; i++) d = addParsedItems(d, addDays(today, -i), parseMealText('simit').items, 'kahvalti');
  d = addParsedItems(d, today, parseMealText('elma').items, 'ara');
  const r = recentFoods(d, 5, today);
  assert.equal(r[0].name, '1 adet Simit');
  assert.equal(r[0].count, 3);
});

console.log(`✓ toplam ${passed} test geçti`);

test('porsiyon değiştirme ve öğün taşıma', () => {
  const k = '2026-01-01';
  let d = addParsedItems(structuredClone(DEFAULT_DATA), k, parseMealText('1 porsiyon mantı').items, 'ogle');
  const id = d.days[k].food[0].id;
  d = scaleEntry(d, k, id, 1.5);
  const e = d.days[k].food[0];
  assert.equal(e.name, '1,5 porsiyon Mantı');
  assert.equal(e.cal, 675);
  d = scaleEntry(d, k, id, 1 / 3);
  assert.equal(d.days[k].food[0].name, 'yarım porsiyon Mantı');
  d = moveEntry(d, k, id, 'aksam');
  assert.equal(d.days[k].food[0].meal, 'aksam');
});

/* ---------- veritabanı tutarlılığı ---------- */
import { FOODS, fold, moveEntry, scaleEntry } from './index';

test('kimlikler benzersiz ve değerler mantıklı', () => {
  const ids = new Set<string>();
  for (const f of FOODS) {
    assert.ok(!ids.has(f.id), `yinelenen kimlik ${f.id}`);
    ids.add(f.id);
    // 4/4/9 kuralıyla makrolardan çıkan kalori, etikettekine yakın olmalı (alkol hariç)
    const fromMacros = f.p * 4 + f.c * 4 + f.f * 9;
    if (!['bira', 'sarap', 'raki'].includes(f.id) && f.kcal > 20) {
      assert.ok(Math.abs(fromMacros - f.kcal) / f.kcal < 0.3, `${f.id}: ${f.kcal} kcal ama makrolar ${Math.round(fromMacros)}`);
    }
    assert.ok(f.grams > 0, `${f.id} porsiyon gramı yok`);
  }
});

test('her ad kendi yemeğine eşleşir', () => {
  const bad: string[] = [];
  for (const f of FOODS) {
    for (const a of f.aliases) {
      const r = parseMealText(a);
      const id = r.items[0]?.food?.id;
      // Aynı adı paylaşan başka yemek varsa kabul et
      const owners = FOODS.filter((x) => x.aliases.some((y) => fold(y) === fold(a))).map((x) => x.id);
      if (!owners.includes(id ?? '')) bad.push(`${a} → ${id ?? 'yok'} (beklenen ${f.id})`);
    }
  }
  assert.deepEqual(bad, []);
});

console.log(`✓ veritabanı: ${FOODS.length} yemek/içecek`);

/* ---------- antrenman ---------- */
import { PROGRAM, burnedKcal, dayProgress, programFor, toggleSet, waterGoalOn, weekProgress } from './index';

test('antrenman: set işaretleme, ilerleme ve su bonusu', () => {
  const monday = '2026-11-09'; // Pazartesi
  assert.equal(programFor(monday).k, 'PZT');
  let d = structuredClone(DEFAULT_DATA);
  assert.equal(waterGoalOn(d, monday), d.goals.water);
  d = toggleSet(d, monday, '0-0', 0);
  d = toggleSet(d, monday, '0-0', 1);
  const p = dayProgress(d, monday);
  assert.equal(p.done, 2);
  assert.equal(p.total, 22);
  assert.equal(waterGoalOn(d, monday), d.goals.water + 500);
  assert.ok(burnedKcal(d, monday) > 10 && burnedKcal(d, monday) < 40, `kcal ${burnedKcal(d, monday)}`);
  d = toggleSet(d, monday, '0-0', 1); // geri al
  assert.equal(dayProgress(d, monday).done, 1);
  const w = weekProgress(d, '2026-11-12');
  assert.equal(w.monday, monday);
  assert.equal(w.planned, 5);
  assert.equal(PROGRAM.length, 7);
});

/* ---------- vücut ---------- */
import {
  MUSCLE_ORDER, bodySvg, composition, dayVolume, development, muscleAdvice, navyBodyFat, plannedVolume, setMeasure, weekVolume,
} from './index';

test('kas hacmi: yapılan setler kaslara dağıtılır', () => {
  const mon = '2026-11-09';
  let d = structuredClone(DEFAULT_DATA);
  for (let si = 0; si < 4; si++) d = toggleSet(d, mon, '0-0', si); // 4 set goblet squat
  const v = dayVolume(d, mon);
  assert.equal(v.quads, 4);
  assert.equal(v.glutes, 4);
  assert.equal(v.adductors, 2);
  assert.equal(v.chest, 0);
  assert.equal(weekVolume(d, '2026-11-15').quads, 4); // aynı hafta (Pazar)
  assert.equal(weekVolume(d, '2026-11-16').quads, 0); // sonraki hafta
  assert.ok(development(d, '2026-11-12').quads > 0);
});

test('program kasları çalıştırıyor; eksik kalanlar için öneri var', () => {
  const p = plannedVolume();
  for (const m of MUSCLE_ORDER) if (m !== 'calves') assert.ok(p[m] >= 3, `${m}: ${p[m]}`);
  assert.ok(p.calves < 1); // programda baldır hareketi yok
  const advice = muscleAdvice(structuredClone(DEFAULT_DATA));
  assert.ok(advice.some((a) => a.muscle === 'calves'));
});

test('ABD Donanması yağ oranı', () => {
  const m = navyBodyFat('m', 178, { waist: 85, neck: 38 })!;
  assert.ok(m > 15 && m < 19, `erkek ${m}`);
  const f = navyBodyFat('f', 165, { waist: 72, neck: 32, hip: 98 })!;
  assert.ok(f > 24 && f < 30, `kadın ${f}`);
  assert.equal(navyBodyFat('f', 165, { waist: 72, neck: 32 }), null); // kalça olmadan hesaplanmaz
});

test('kompozisyon ve ölçü kaydı', () => {
  let d = structuredClone(DEFAULT_DATA);
  d.profile = { ...d.profile, sex: 'm', height: 178, weight: 80, age: 30 };
  assert.equal(composition(d).source, 'bmi');
  d = setMeasure(d, '2026-11-01', { waist: 85, neck: 38 });
  d = setMeasure(d, '2026-11-10', { arm: 34 });
  const c = composition(d);
  assert.equal(c.source, 'navy');
  assert.ok(Math.abs(c.leanKg + c.fatKg - 80) < 0.01);
  assert.ok(c.ffmi > 18 && c.ffmi < 24, `ffmi ${c.ffmi}`);
  assert.ok(c.whtr! > 0.47 && c.whtr! < 0.48);
});

test('vücut prototipi geçerli SVG üretir ve yağ oranıyla genişler', () => {
  const colors = { skin: '#eee', outline: '#999', none: '#ddd', low: '#cfe', building: '#9d9', ideal: '#383', high: '#a33', text: '#000' };
  const dev = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as never;
  const thin = bodySvg({ sex: 'm', bodyFat: 12, dev, heat: dev, view: 'front', colors });
  const wide = bodySvg({ sex: 'm', bodyFat: 30, dev, heat: dev, view: 'back', colors });
  assert.ok(thin.startsWith('<svg') && thin.endsWith('</svg>'));
  assert.ok(!/NaN|undefined/.test(thin + wide));
  for (const m of ['chest', 'abs', 'quads']) assert.ok(thin.includes(`data-muscle="${m}"`));
  for (const m of ['upperback', 'glutes', 'hamstrings']) assert.ok(wide.includes(`data-muscle="${m}"`));
});

/* ---------- üst vücut odaklı program ---------- */
import { PROGRAM_UPPER, programOf, resolveExercise } from './index';

test('üst vücut programı: bacak koruma düzeyinde, üst vücut hedef aralıkta', () => {
  const up = plannedVolume('upper');
  const bal = plannedVolume('balanced');
  assert.ok(up.quads <= 6, `ön bacak ${up.quads}`);
  assert.ok(up.quads < bal.quads / 3 && up.hamstrings < bal.hamstrings / 2 && up.glutes < bal.glutes / 2);
  for (const m of ['chest', 'upperback', 'biceps', 'triceps', 'shoulders'] as const) assert.ok(up[m] >= 10, `${m} ${up[m]}`);
  assert.ok(up.chest > bal.chest && up.upperback > bal.upperback && up.biceps > bal.biceps);
  assert.equal(PROGRAM_UPPER.length, 7);
});

test('program değişince eski kayıtlar karışmaz', () => {
  const mon = '2026-11-09';
  let d = structuredClone(DEFAULT_DATA);
  d = toggleSet(d, mon, '0-0', 0); // dengeli programda goblet squat
  d = { ...d, programFocus: 'upper' };
  assert.equal(programOf(d)[0].name, 'Göğüs & Omuz (İtiş)');
  assert.equal(dayProgress(d, mon).done, 0); // yeni programın setleri ayrı
  d = toggleSet(d, mon, 'u0-0', 0); // üst vücut: floor press
  assert.equal(resolveExercise(mon, 'u0-0')?.n, 'Tek Kol Floor Press');
  assert.equal(resolveExercise(mon, '0-0')?.n, 'Tempolu Goblet Squat');
  const v = dayVolume(d, mon);
  assert.equal(v.quads, 1); // eski squat seti hâlâ sayılır
  assert.equal(v.chest, 1);
  assert.equal(dayProgress(d, mon).done, 1);
  assert.ok(muscleAdvice(d).some((a) => a.text.includes('bölgesel')));
});
