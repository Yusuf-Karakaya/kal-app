'use strict';
/* global KalCore */
const K = window.KalCore;

/* ================== Veri ================== */
const STORE_KEY = 'kal-data-v1';

/* ---------- Şifreleme (parola kilidi) ----------
   AES-256-GCM, anahtar paroladan PBKDF2-SHA256 (300.000 tur) ile türetilir.
   Parola ve anahtar hiçbir yere yazılmaz; yalnızca açık oturum süresince bellekte durur. */
const ENC_ITER = 300000;
const te = new TextEncoder();
const td = new TextDecoder();
function b64e(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const isEnvelope = (o) => !!o && o.kalEnc === 1 && typeof o.ct === 'string';

async function deriveKey(password, salt, iter = ENC_ITER) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
async function encryptJson(obj, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  return { kalEnc: 1, alg: 'AES-GCM/PBKDF2-SHA256', iter: ENC_ITER, salt: b64e(salt), iv: b64e(iv), ct: b64e(ct) };
}
async function decryptEnvelope(env, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(env.iv) }, key, b64d(env.ct));
  return JSON.parse(td.decode(pt));
}
/** Parolayla zarfı açar; parola yanlışsa null döner */
async function openEnvelope(env, password) {
  try {
    const salt = b64d(env.salt);
    const key = await deriveKey(password, salt, env.iter || ENC_ITER);
    return { data: await decryptEnvelope(env, key), key, salt };
  } catch {
    return null;
  }
}
let lock = null; // { key, salt } — kilit açıkken bellekte
let lockedEnvelope = null; // açılış sırasında çözülmeyi bekleyen şifreli veri

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (isEnvelope(parsed)) {
      lockedEnvelope = parsed;
      return K.migrate({});
    }
    return K.migrate(parsed);
  } catch {
    return K.migrate({});
  }
}
let data = loadData();
let firstRun = false;
try { firstRun = !localStorage.getItem(STORE_KEY); } catch { /* depolama kapalı */ }

// Bildirim geçmişi verinin parçası değil; ayrı tutulur
let notifState = { lastWater: 0, sent: {} };
try { notifState = { ...notifState, ...JSON.parse(localStorage.getItem('kal-notif') || '{}') }; } catch { /* yok */ }
const saveNotif = () => { try { localStorage.setItem('kal-notif', JSON.stringify(notifState)); } catch { /* yok */ } };

let saveChain = Promise.resolve();
function save() {
  const snapshot = data;
  saveChain = saveChain.then(async () => {
    try {
      const payload = lock ? await encryptJson(snapshot, lock.key, lock.salt) : snapshot;
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch {
      toast('Kaydedilemedi (depolama dolu ya da kapalı olabilir)');
    }
  });
  return saveChain;
}
function commit(next, msg) {
  data = next;
  save();
  render();
  if (msg) toast(msg);
}

/* ================== Yardımcılar ================== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fmt = K.fmt;
const fmt1 = K.fmt1;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// Sayfa içi onay penceresi (confirm() bazı ortamlarda çalışmaz)
let confirmResolve = null;
function askConfirm(msg, yesLabel = 'Evet') {
  $('#confirmMsg').textContent = msg;
  $('#confirmYes').textContent = yesLabel;
  $('#confirmBox').hidden = false;
  $('#confirmNo').focus();
  return new Promise((res) => (confirmResolve = res));
}
function closeConfirm(v) {
  $('#confirmBox').hidden = true;
  if (confirmResolve) confirmResolve(v);
  confirmResolve = null;
}

/* ================== Durum ================== */
let viewKey = K.todayKey();
let mealSel = K.guessMeal();
let mealPinned = false; // kullanıcı öğünü elle seçtiyse metinden tahmin edilmez
let parsed = { items: [], unknownItems: [], meal: undefined };
const unknownKcal = {}; // tanınmayan parça -> kullanıcı kcal
let editId = null; // düzenleme çubuğu açık olan kayıt

function shiftDay(delta) {
  const k = K.addDays(viewKey, delta);
  if (k > K.todayKey()) return;
  viewKey = k;
  render();
}

/* ================== Çizim: Bugün ================== */
const RING_LEN = 2 * Math.PI * 50;
function setRing(el, ratio) {
  el.style.strokeDasharray = RING_LEN;
  el.style.strokeDashoffset = RING_LEN * (1 - Math.min(Math.max(ratio, 0), 1));
}

function renderHeader() {
  const d = K.keyToDate(viewKey);
  $('#dateTitle').textContent = K.dayLabel(viewKey);
  $('#dateSub').textContent = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#nextDay').disabled = viewKey >= K.todayKey();
}

function renderRings(t) {
  const g = { ...data.goals, water: K.waterGoalOn(data, viewKey) };
  $('#calValue').textContent = fmt(t.cal);
  $('#calGoalText').textContent = `/ ${fmt(g.cal)} kcal`;
  const calRing = $('#calRing');
  setRing(calRing, t.cal / g.cal);
  calRing.classList.toggle('over', t.cal > g.cal);
  $('#calRemain').textContent = t.cal <= g.cal ? `${fmt(g.cal - t.cal)} kcal kaldı` : `${fmt(t.cal - g.cal)} kcal fazla`;

  $('#waterValue').textContent = fmt(t.water);
  $('#waterGoalText').textContent = `/ ${fmt(g.water)} ml`;
  setRing($('#waterRing'), t.water / g.water);
  $('#waterRemain').textContent = t.water < g.water
    ? `${fmt(g.water - t.water)} ml kaldı (~${Math.ceil((g.water - t.water) / 200)} bardak)${g.water > data.goals.water ? ' · antrenman +500' : ''}`
    : 'Hedef tamam ✓';
}

function renderMacros(t) {
  const g = data.goals;
  const rows = [['p', 'Protein', t.p, g.p], ['c', 'Karbonhidrat', t.c, g.c], ['f', 'Yağ', t.f, g.f]];
  $('#macros').innerHTML = rows.map(([k, label, v, goal]) => {
    const ratio = goal ? v / goal : 0;
    return `<div class="macro">
      <div class="macro-top"><span>${label}</span><span class="num">${fmt(v)} / ${fmt(goal)} g</span></div>
      <div class="meter"><div class="meter-fill ${k}${ratio > 1.1 ? ' over' : ''}" style="width:${Math.min(ratio, 1) * 100}%"></div></div>
    </div>`;
  }).join('');
}

function renderInsights() {
  const list = K.dailyInsights(data, viewKey);
  $('#insights').innerHTML = list.map((i) => `<div class="insight ${i.tone}">${esc(i.text)}</div>`).join('');
}

function renderMealSeg() {
  $('#mealSeg').innerHTML = K.MEAL_ORDER.map((m) =>
    `<button type="button" data-meal="${m}" class="${m === mealSel ? 'on' : ''}" aria-pressed="${m === mealSel}">${K.MEALS[m]}</button>`,
  ).join('');
}

function addLabel(count) {
  return count ? `${count} kalemi ${K.MEALS[mealSel].toLocaleLowerCase('tr-TR')} olarak ekle` : 'Ekle';
}

function previewTotalText() {
  const sum = K.sumItems(parsed.items);
  const extra = parsed.unknownItems.reduce((s, u) => s + (Number(unknownKcal[u.text]) || 0), 0);
  return `${fmt(sum.kcal + extra)} kcal · P ${fmt(sum.p)} g${sum.hydrationMl ? ` · 💧 ${fmt(sum.hydrationMl)} ml` : ''}`;
}

function previewCount() {
  return parsed.items.length + parsed.unknownItems.filter((u) => Number(unknownKcal[u.text]) > 0).length;
}

function renderPreview() {
  const box = $('#parsePreview');
  const { items, unknownItems } = parsed;
  if (!items.length && !unknownItems.length) {
    box.hidden = true;
    $('#addParsed').disabled = true;
    $('#addParsed').textContent = 'Ekle';
    return;
  }
  let html = items.map((it, i) => `
    <div class="pv-item">
      <div class="pv-main">
        <span class="pv-name">${esc(it.label)}</span>
        <span class="pv-macro">${it.food.id.startsWith('custom:') ? 'Kişisel yemeğin' : `${it.grams ? fmt(it.grams) + (it.food.group === 'icecek' ? ' ml' : ' g') + ' · ' : ''}P ${fmt1(it.p)} · K ${fmt1(it.c)} · Y ${fmt1(it.f)}${it.hydrationMl ? ` · 💧 ${fmt(it.hydrationMl)} ml` : ''}`}</span>
      </div>
      <span class="pv-kcal">${fmt(it.kcal)} kcal</span>
      <button type="button" class="del" data-pv="${i}" aria-label="Çıkar">✕</button>
    </div>`).join('');
  html += unknownItems.map((u) => `
    <div class="pv-item unknown">
      <div class="pv-main">
        <span class="pv-name">${esc(u.text)}</span>
        <span class="pv-macro">Bunu tanımadım. Toplam kalorisini yaz, “${esc(u.name)}” adıyla öğrenip sonra kendim hesaplarım.</span>
      </div>
      <input type="number" class="pv-input" data-unknown="${esc(u.text)}" value="${esc(unknownKcal[u.text] ?? '')}" placeholder="kcal" inputmode="numeric" min="0" max="5000" aria-label="${esc(u.text)} kalorisi" />
    </div>`).join('');
  html += `<div class="pv-total"><span>Toplam</span><span>${previewTotalText()}</span></div>`;
  box.innerHTML = html;
  box.hidden = false;
  const count = previewCount();
  $('#addParsed').disabled = count === 0;
  $('#addParsed').textContent = addLabel(count);
}

function runParse() {
  parsed = K.parseMealText($('#mealText').value, data.customFoods);
  if (parsed.meal && !mealPinned && parsed.meal !== mealSel) {
    mealSel = parsed.meal;
    renderMealSeg();
  }
  renderPreview();
}

let recentCache = [];
function renderRecent() {
  recentCache = K.recentFoods(data, 10);
  $('#recentList').innerHTML = recentCache.length
    ? recentCache.map((r, i) => `<button type="button" data-recent="${i}">${esc(r.name)} <small>${fmt(r.cal)}</small></button>`).join('')
    : '<span class="hint">Eklediğin yemekler burada tek dokunuşla tekrar eklemek için görünür.</span>';

  // Önceki günün öğünlerini kopyalama
  const prevDay = data.days[K.addDays(viewKey, -1)];
  const cur = data.days[viewKey];
  $('#copyRow').innerHTML = K.MEAL_ORDER
    .filter((m) => prevDay && prevDay.food.some((f) => f.meal === m) && !(cur && cur.food.some((f) => f.meal === m)))
    .map((m) => `<button type="button" class="btn ghost small" data-copy="${m}">↻ Dün: ${K.MEALS[m]} · ${fmt(K.mealTotals(prevDay, m))} kcal</button>`)
    .join('');
}

const DRINKS = ['cay', 'filtre-kahve', 'turk-kahvesi', 'ayran', 'sut', 'portakal-suyu', 'kola', 'zero-kola'];
function renderDrinks() {
  $('#drinkList').innerHTML = DRINKS.map((id) => {
    const f = K.FOOD_BY_ID[id];
    return `<button type="button" data-drink="${id}">${esc(f.name.split(' / ')[0])} <small>${f.grams} ml</small></button>`;
  }).join('');
}

function renderStreaks() {
  const ls = K.logStreak(data);
  const ws = K.waterStreak(data);
  $('#logStreak').textContent = ls >= 2 ? `${ls} gün seri` : '';
  $('#waterStreak').textContent = ws >= 2 ? `${ws} gün seri` : '';
}

function renderLog(t) {
  const d = data.days[viewKey] || { food: [], water: [] };
  let html = '';
  for (const mk of K.MEAL_ORDER) {
    const items = d.food.filter((f) => f.meal === mk).sort((a, b) => a.t - b.t);
    if (!items.length) continue;
    const sum = items.reduce((s, f) => s + f.cal, 0);
    html += `<div class="meal-group"><div class="meal-head"><span>${K.MEALS[mk]}</span><span>${fmt(sum)} kcal</span></div>`;
    for (const f of items) {
      const macro = f.p != null ? `<span class="sub">P ${fmt1(f.p)} · K ${fmt1(f.c)} · Y ${fmt1(f.f)}</span>` : '';
      html += `<div class="log-item"><span class="time">${K.hhmm(f.t)}</span><button type="button" class="name editable" data-edit="${f.id}" aria-expanded="${editId === f.id}">${esc(f.name)}${macro}</button>
        <span class="val">${fmt(f.cal)}</span><button class="del" data-type="food" data-id="${f.id}" aria-label="Sil">✕</button></div>`;
      if (editId === f.id) {
        html += `<div class="edit-bar">
          <span class="edit-label">Porsiyon</span>
          ${[['0.5', '½×'], ['1.5', '1,5×'], ['2', '2×']].map(([v, l]) => `<button type="button" class="chip-btn" data-scale="${v}" data-id="${f.id}">${l}</button>`).join('')}
          <span class="edit-label">Öğün</span>
          ${K.MEAL_ORDER.filter((m) => m !== f.meal).map((m) => `<button type="button" class="chip-btn" data-move="${m}" data-id="${f.id}">${K.MEALS[m]}</button>`).join('')}
        </div>`;
      }
    }
    html += '</div>';
  }
  if (d.water.length) {
    html += `<div class="meal-group"><div class="meal-head"><span>Sıvı</span><span>${fmt(t.water)} ml</span></div>`;
    for (const w of [...d.water].sort((a, b) => a.t - b.t)) {
      const f = w.drink && K.FOOD_BY_ID[w.drink];
      const name = f
        ? `${esc(f.name.split(' / ')[0])}<span class="sub">${fmt(w.vol || w.ml)} ml içildi, ${fmt(w.ml)} ml sayıldı</span>`
        : '💧 Su';
      html += `<div class="log-item"><span class="time">${K.hhmm(w.t)}</span><span class="name">${name}</span>
        <span class="val">${fmt(w.ml)} ml</span><button class="del" data-type="water" data-id="${w.id}" aria-label="Sil">✕</button></div>`;
    }
    html += '</div>';
  }
  $('#logList').innerHTML = html || '<div class="empty">Henüz kayıt yok. Yukarıya ne yediğini yazarak başla.</div>';
}

function renderToday() {
  const t = K.totals(data, viewKey);
  renderRings(t);
  renderMacros(t);
  renderInsights();
  renderMealSeg();
  renderRecent();
  renderStreaks();
  renderLog(t);
}

/* ================== Çizim: İlerleme ================== */
function renderWeightChart() {
  const trend = K.weightTrend(data.weights).slice(-60);
  const box = $('#weightChart');
  if (trend.length < 2) {
    box.innerHTML = '<div class="empty">Grafik için en az iki gün tartıl. Her sabah aynı koşullarda tartılmak en doğru sonucu verir.</div>';
    return;
  }
  const W = 320, H = 150, L = 34, R = 8, T = 10, B = 22;
  const vals = trend.flatMap((p) => (p.raw != null ? [p.raw, p.trend] : [p.trend]));
  const target = data.profile.targetWeight;
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 2) { const mid = (max + min) / 2; min = mid - 1; max = mid + 1; }
  min = Math.floor(min * 2) / 2; max = Math.ceil(max * 2) / 2;
  const x = (i) => L + (i / (trend.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Kilo grafiği">`;
  for (const v of [min, (min + max) / 2, max]) {
    svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 4}" y="${y(v) + 3}" class="axis" text-anchor="end">${fmt1(v)}</text>`;
  }
  if (target && target >= min && target <= max) {
    const ty = y(target);
    svg += `<line x1="${L}" x2="${W - R}" y1="${ty}" y2="${ty}" class="target"/><text x="${W - R}" y="${ty - 3}" class="axis" text-anchor="end">hedef</text>`;
  }
  const short = (k) => K.keyToDate(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  svg += `<text x="${L}" y="${H - 6}" class="axis">${short(trend[0].key)}</text><text x="${W - R}" y="${H - 6}" class="axis" text-anchor="end">${short(trend[trend.length - 1].key)}</text>`;
  svg += `<path d="${trend.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join('')}" class="trend"/>`;
  trend.forEach((p, i) => { if (p.raw != null) svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.raw).toFixed(1)}" r="2.6" class="dot"/>`; });
  const lp = trend[trend.length - 1];
  svg += `<circle cx="${x(trend.length - 1).toFixed(1)}" cy="${y(lp.trend).toFixed(1)}" r="4" class="end"/></svg>`;
  box.innerHTML = svg + '<div class="legend"><span><i class="lg-dot"></i>tartı</span><span><i class="lg-line"></i>trend</span></div>';
}

function renderProgress() {
  const tk = K.todayKey();
  $('#weightInput').value = data.weights[tk] != null ? fmt1(data.weights[tk]) : '';
  $('#weightInput').placeholder = `Bugünkü kilon (son: ${fmt1(data.profile.weight)} kg)`;
  renderWeightChart();

  const trend = K.weightTrend(data.weights);
  const rate = K.weeklyRate(trend);
  $('#weightRate').textContent = rate == null ? '' : `${rate > 0 ? '+' : rate < 0 ? '−' : ''}${fmt1(Math.abs(rate))} kg/hafta`;
  const cur = trend.length ? trend[trend.length - 1].trend : data.profile.weight;
  const target = data.profile.targetWeight;
  const eta = K.etaToTarget(cur, target, rate);
  let hint = trend.length ? `Trend kilon ${fmt1(cur)} kg.` : 'Kilonu her gün girersen günlük dalgalanmalardan arındırılmış trendini gösteririm.';
  if (target) hint += ` Hedefe ${fmt1(Math.abs(target - cur))} kg var.`;
  if (eta) hint += ` Bu hızla ${eta} civarında ulaşırsın.`;
  $('#weightHint').textContent = hint;

  // Uyarlanır harcama
  const est = K.estimateTdee(data);
  const formula = K.bmrTdee(data.profile).tdee;
  if (est) {
    const diff = est.suggestedCal - data.goals.cal;
    $('#tdeeCard').innerHTML = `
      <h2>Gerçek harcaman</h2>
      <div class="tdee-row">
        <div><strong>${fmt(est.tdee)}</strong><span>kcal/gün tahmini harcama</span></div>
        <div><strong>${fmt(est.avgIntake)}</strong><span>kcal/gün ortalama alım</span></div>
      </div>
      <p class="hint">Son ${est.days} günlük kayıtların ve kilo trendinden hesaplandı. Formülle bulunan değer ${fmt(formula)} kcal idi.</p>
      ${Math.abs(diff) >= 50
    ? `<button type="button" class="btn full" id="applyTdee" data-cal="${est.suggestedCal}">Kalori hedefini ${fmt(est.suggestedCal)} kcal yap (${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))})</button>`
    : '<p class="hint">Mevcut hedefin bu tahminle uyumlu.</p>'}`;
  } else {
    let logged = 0;
    for (let i = 1; i <= 21; i++) if (K.totals(data, K.addDays(tk, -i)).cal >= 800) logged++;
    const wc = Object.keys(data.weights).length;
    $('#tdeeCard').innerHTML = `
      <h2>Gerçek harcaman</h2>
      <p class="hint">Formüle göre günlük harcaman ${fmt(formula)} kcal. Herkesin metabolizması farklıdır. En az 10 gün eksiksiz kayıt ve iki haftaya yayılmış tartılarla gerçek harcamanı hesaplayıp hedefini ona göre önereceğim.</p>
      <div class="progress-mini"><span>Kayıtlı gün: ${Math.min(logged, 10)}/10</span><span>Tartı: ${Math.min(wc, 2)}/2</span></div>`;
  }

  // Son 7 gün
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const k = K.addDays(tk, -i);
    rows.push({ k, label: K.keyToDate(k).toLocaleDateString('tr-TR', { weekday: 'short' }), ...K.totals(data, k) });
  }
  renderBars($('#calBars'), rows, 'cal', data.goals.cal, 'cal');
  renderBars($('#waterBars'), rows, 'water', data.goals.water, 'water');
  const logged = rows.filter((r) => r.cal > 0 || r.water > 0);
  const n = logged.length || 1;
  const avg = (k) => logged.reduce((s, r) => s + r[k], 0) / n;
  $('#stats').innerHTML = `
    <div class="stat"><strong>${fmt(avg('cal'))}</strong><span>ort. kcal / gün</span></div>
    <div class="stat"><strong>${fmt(avg('p'))} g</strong><span>ort. protein / gün</span></div>
    <div class="stat"><strong>${fmt(avg('water'))}</strong><span>ort. ml sıvı / gün</span></div>
    <div class="stat"><strong>${rows.filter((r) => r.cal > 0 && r.cal <= data.goals.cal).length}/7</strong><span>kalori hedefinde</span></div>
    <div class="stat"><strong>${K.waterStreak(data)}</strong><span>gün su serisi</span></div>
    <div class="stat"><strong>${K.logStreak(data)}</strong><span>gün kayıt serisi</span></div>`;
}

function renderBars(el, rows, field, goal, cls) {
  const max = Math.max(goal * 1.15, ...rows.map((r) => r[field]));
  el.innerHTML = rows.map((r) => {
    const h = (r[field] / max) * 100;
    const over = field === 'cal' && r[field] > goal ? ' over' : '';
    return `<div class="bar-col" title="${r.k}"><span class="bar-val">${r[field] ? fmt(r[field]) : ''}</span>
      <div class="bar-track"><div class="bar ${cls}${over}" style="height:${h}%"></div><div class="goal-tick" style="bottom:${(goal / max) * 100}%"></div></div>
      <span class="bar-day">${r.label}</span></div>`;
  }).join('');
}

/* ================== Çizim: Ayarlar ================== */
function renderSettings() {
  const p = data.profile, g = data.goals, r = data.reminders;
  $('#pSex').value = p.sex; $('#pAge').value = p.age; $('#pHeight').value = p.height;
  $('#pWeight').value = p.weight; $('#pActivity').value = String(p.activity); $('#pGoal').value = String(p.goal);
  $('#pTarget').value = p.targetWeight ?? '';
  $('#pKb').value = data.kbWeight ?? 12;
  $('#goalCal').value = g.cal; $('#goalWater').value = g.water;
  $('#goalP').value = g.p; $('#goalC').value = g.c; $('#goalF').value = g.f;
  updateMacroSum();
  $('#rWaterOn').checked = r.waterOn; $('#rWaterEvery').value = String(r.waterEvery);
  $('#rStart').value = r.start; $('#rEnd').value = r.end;
  $('#rMealOn').checked = r.mealOn; $('#rBreakfast').value = r.breakfast;
  $('#rLunch').value = r.lunch; $('#rDinner').value = r.dinner;
  $('#rSummaryOn').checked = r.summaryOn; $('#rSummary').value = r.summary;
  $('#rWeighOn').checked = !!r.weighOn; $('#rWeigh').value = r.weigh || '08:00';
  renderNotifStatus();
  renderLockSettings();
}

function updateMacroSum() {
  const kcal = Number($('#goalP').value) * 4 + Number($('#goalC').value) * 4 + Number($('#goalF').value) * 9;
  const diff = kcal - Number($('#goalCal').value);
  $('#macroSum').textContent = `Makrolar ${fmt(kcal)} kcal ediyor${Math.abs(diff) > 50 ? ` (hedeften ${fmt(Math.abs(diff))} ${diff > 0 ? 'fazla' : 'eksik'})` : ''}`;
}

function render() {
  renderHeader();
  renderToday();
  if ($('#view-progress').classList.contains('active')) renderProgress();
  if ($('#view-workout').classList.contains('active')) renderWorkout();
  if ($('#view-body').classList.contains('active')) renderBody();
}

/* ================== Bildirimler ================== */
let swReg = null;
const notifSupported = () => 'Notification' in window;
const canSystemNotify = () => notifSupported() && Notification.permission === 'granted';

function renderNotifStatus() {
  const el = $('#notifStatus');
  const btn = $('#notifPermBtn');
  if (!notifSupported()) {
    el.textContent = 'Bu ortamda telefon bildirimi yok. Sayfa açıkken hatırlatmalar ekranın üstünde kart olarak çıkar.';
    btn.hidden = true;
    return;
  }
  const p = Notification.permission;
  btn.hidden = p === 'granted';
  el.textContent = {
    granted: 'Bildirimler açık. Uygulama açıkken veya arka planda çalışırken hatırlatmalar gelir.',
    denied: 'Telefon bildirimleri kapalı. Sayfa açıkken hatırlatmalar ekranın üstünde kart olarak çıkar.',
    default: 'Hatırlatma alabilmek için bildirim izni ver.',
  }[p];
}

async function requestPermission() {
  if (!notifSupported()) return;
  try { await Notification.requestPermission(); } catch { /* izin istenemedi */ }
  renderNotifStatus();
}

function banner(title, body, withWaterActions) {
  $('#bannerTitle').textContent = title;
  $('#bannerBody').textContent = body;
  $('#bannerActions').hidden = !withWaterActions;
  $('#banner').hidden = false;
  try {
    const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && active) navigator.vibrate([120, 60, 120]);
  } catch { /* yok */ }
}

async function notify(title, body, tag, withWaterActions = false) {
  if (!canSystemNotify()) {
    if (document.visibilityState === 'visible') { banner(title, body, withWaterActions); return true; }
    return false;
  }
  const opts = { body, tag, icon: 'icon.svg', badge: 'icon.svg', renotify: true, lang: 'tr' };
  if (withWaterActions) {
    opts.actions = [{ action: 'water200', title: '+200 ml içtim' }, { action: 'water500', title: '+500 ml içtim' }];
  }
  try {
    const reg = swReg || (navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()));
    if (reg) { await reg.showNotification(title, opts); return true; }
  } catch { /* yedeğe düş */ }
  try { delete opts.actions; new Notification(title, opts); return true; } catch { return false; }
}

function inActiveHours(r) {
  const n = nowMinutes(), s = K.minutesOf(r.start), e = K.minutesOf(r.end);
  return s <= e ? n >= s && n < e : n >= s || n < e;
}
const sentToday = (id) => notifState.sent[`${K.todayKey()}:${id}`];
function markSent(id) {
  const tk = K.todayKey();
  for (const k of Object.keys(notifState.sent)) if (!k.startsWith(tk)) delete notifState.sent[k];
  notifState.sent[`${tk}:${id}`] = Date.now();
  saveNotif();
}
const dueAt = (time) => { const t = K.minutesOf(time), n = nowMinutes(); return n >= t && n < t + 60; };

function checkReminders() {
  if (!canSystemNotify() && document.visibilityState !== 'visible') return;
  const r = data.reminders;
  const tk = K.todayKey();
  const t = K.totals(data, tk);
  const d = data.days[tk] || { food: [], water: [] };

  const wGoal = K.waterGoalOn(data, tk);
  if (r.waterOn && inActiveHours(r) && t.water < wGoal) {
    const lastDrink = Math.max(0, ...d.water.map((w) => w.t));
    const last = Math.max(lastDrink, notifState.lastWater || 0);
    if (Date.now() - last >= r.waterEvery * 60000) {
      const behind = K.expectedWaterNow(data, new Date(), wGoal) - t.water;
      notify('💧 Su içme zamanı', behind > 300
        ? `Planın ${fmt(behind)} ml gerisindesin. Bugün ${fmt(t.water)} / ${fmt(wGoal)} ml.`
        : `Bugün ${fmt(t.water)} ml içtin, hedefe ${fmt(wGoal - t.water)} ml kaldı.`, 'water', true);
      notifState.lastWater = Date.now();
      saveNotif();
    }
  }

  if (r.mealOn) {
    for (const [key, time, label] of [['kahvalti', r.breakfast, 'Kahvaltı'], ['ogle', r.lunch, 'Öğle yemeği'], ['aksam', r.dinner, 'Akşam yemeği']]) {
      if (dueAt(time) && !sentToday('meal-' + key) && !d.food.some((f) => f.meal === key)) {
        notify(`🍽️ ${label} vakti`, `Ne yediğini tek cümleyle yazman yeterli. Bugün şu ana kadar ${fmt(t.cal)} kcal.`, 'meal-' + key);
        markSent('meal-' + key);
      }
    }
  }

  if (r.weighOn && r.weigh && dueAt(r.weigh) && !sentToday('weigh') && data.weights[tk] == null) {
    notify('⚖️ Tartılma zamanı', 'Kahvaltıdan önce tartılıp kilonu İlerleme ekranına gir.', 'weigh');
    markSent('weigh');
  }

  if (r.summaryOn && dueAt(r.summary) && !sentToday('summary')) {
    const g = data.goals;
    const calMsg = t.cal > g.cal ? `${fmt(t.cal - g.cal)} kcal hedefin üstünde` : `${fmt(g.cal - t.cal)} kcal hedefin altında`;
    const waterMsg = t.water >= g.water ? 'su hedefi tamam ✓' : `suda ${fmt(g.water - t.water)} ml eksik`;
    notify('📊 Günün özeti', `${fmt(t.cal)} kcal (${calMsg}), protein ${fmt(t.p)}/${fmt(g.p)} g, ${waterMsg}.`, 'summary');
    markSent('summary');
  }
}

function handleAction(action) {
  const m = /^water(\d+)$/.exec(action || '');
  if (!m) return;
  viewKey = K.todayKey();
  addWaterMl(Number(m[1]), viewKey);
}

function markDrankNow(key) {
  if (key === K.todayKey()) { notifState.lastWater = Date.now(); saveNotif(); }
}

function addWaterMl(ml, key = viewKey) {
  ml = Math.round(Number(ml));
  if (!ml || ml <= 0 || ml > 5000) return;
  const before = K.totals(data, key).water;
  const goal = K.waterGoalOn(data, key);
  markDrankNow(key);
  commit(K.addWater(data, key, ml),
    before < goal && before + ml >= goal ? '🎉 Günlük su hedefine ulaştın!' : `💧 ${ml} ml eklendi`);
}


/* ================== Antrenman (Kettlebell Haftası) ================== */
let wkKey = K.todayKey();

function wkRing(p) {
  const r = 22, c = 2 * Math.PI * r;
  return `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
    <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="5"/>
    <circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--leaf)" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 28 28)"/>
    <text x="28" y="32" text-anchor="middle" font-size="12" font-weight="650" fill="var(--text)">${Math.round(p * 100)}%</text></svg>`;
}

function renderWorkout() {
  const kb = data.kbWeight ?? 12;
  const week = K.weekProgress(data, wkKey);
  const focus = data.programFocus || 'balanced';
  $('#wkSub').textContent = `Tek ${kb} kg kettlebell · ${K.FOCUS_LABEL[focus].toLocaleLowerCase('tr-TR')} · bu hafta ${week.sessions}/${week.planned} antrenman`;
  $$('#wkFocus button').forEach((b) => { b.classList.toggle('on', b.dataset.focus === focus); b.setAttribute('aria-pressed', String(b.dataset.focus === focus)); });
  $('#wkPct').textContent = `${Math.round(week.ratio * 100)}%`;
  $('#wkNext').disabled = K.addDays(week.monday, 7) > K.todayKey();

  const tk = K.todayKey();
  $('#wkRail').innerHTML = K.programOf(data).map((p, i) => {
    const key = K.addDays(week.monday, i);
    const c = K.dayProgress(data, key);
    return `<button type="button" class="wday${key === tk ? ' today' : ''}" data-wk="${key}" aria-pressed="${key === wkKey}">${p.k}
      <small>${p.rest ? '—' : c.total + ' set'}</small><span class="wbar"><i style="width:${c.ratio * 100}%"></i></span></button>`;
  }).join('');

  const p = K.programFor(wkKey, data);
  const c = K.dayProgress(data, wkKey);
  const dateTxt = K.keyToDate(wkKey).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const burn = K.burnedKcal(data, wkKey);
  let h = `<div class="wk-dayhead"><div><h3>${esc(p.name)}</h3><span class="focus">${esc(p.focus)} · ${dateTxt}</span><p>${esc(p.intro)}</p></div>
    ${p.rest ? '' : `<div class="wk-ring">${wkRing(c.ratio)}<span>${c.done}/${c.total} set</span>${burn ? `<div class="wk-burn">~${fmt(burn)} kcal</div>` : ''}</div>`}</div>`;
  if (p.rest) {
    const g = data.goals;
    h += `<div class="rest-card"><h3>Bugün dinlen</h3><p>7–9 saat uyku · ${fmt(g.p)} g protein hedefin · ${fmt(g.water)} ml su</p></div>`;
    $('#wkView').innerHTML = h;
    return;
  }
  const sets = (data.workouts && data.workouts[wkKey]) || {};
  p.blocks.forEach((b, bi) => {
    h += `<div class="block-t">${esc(b.t)}</div><div class="ex-list">`;
    b.ex.forEach((x, ei) => {
      const ek = K.exKey(bi, ei, data);
      const arr = sets[ek] || [];
      const all = arr.filter(Boolean).length === x.s;
      const vid = K.videoUrl(x.n);
      h += `<article class="ex${all ? ' complete' : ''}"><div class="ex-head"><div><h4>${esc(x.n)}</h4>
          <div class="meta"><b>${x.s} × ${esc(x.r)}</b>${x.rest ? ` · ${x.rest} sn dinlenme` : ''}</div></div>
          <div class="ex-acts">${vid ? `<a class="mini-btn vid" href="${vid}" target="_blank" rel="noopener">▶ Video</a>` : ''}<button type="button" class="mini-btn" data-tip="${ek}" aria-expanded="false">Form</button></div></div>
          <p class="tip" id="tip-${ek}" hidden>${esc(x.tip)}</p>
          <div class="sets">${Array.from({ length: x.s }, (_, si) => `<button type="button" class="set${arr[si] ? ' on' : ''}" data-ek="${ek}" data-si="${si}" aria-pressed="${!!arr[si]}" aria-label="Set ${si + 1}">${si + 1}</button>`).join('')}
          <span class="kg">${x.kg ? kb + ' kg' : 'vücut ağırlığı'}</span></div></article>`;
    });
    h += '</div>';
  });
  h += '<div class="wk-foot"><button type="button" class="btn ghost small" id="wkReset">Günü sıfırla</button></div>';
  $('#wkView').innerHTML = h;
}

/* Dinlenme sayacı */
const timer = { end: 0, total: 0, iv: null, actx: null };
function beep() {
  try {
    timer.actx = timer.actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = timer.actx.createOscillator(), g = timer.actx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(timer.actx.destination);
    g.gain.setValueAtTime(0.2, timer.actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, timer.actx.currentTime + 0.5);
    o.start(); o.stop(timer.actx.currentTime + 0.5);
  } catch { /* ses yok */ }
}
function startTimer(sec, name, n, of) {
  try { timer.actx = timer.actx || new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ses yok */ }
  timer.total = sec;
  timer.end = Date.now() + sec * 1000;
  $('#tlabel').innerHTML = `<b>Dinlenme</b>${esc(name)} · set ${n}/${of}`;
  $('#timer').classList.add('show');
  $('#timer').classList.remove('over');
  clearInterval(timer.iv);
  tickTimer();
  timer.iv = setInterval(tickTimer, 250);
}
function tickTimer() {
  const ms = timer.end - Date.now();
  const s = Math.max(0, Math.ceil(ms / 1000));
  $('#tclock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#tprog').style.width = `${timer.total ? (1 - Math.max(0, ms) / (timer.total * 1000)) * 100 : 0}%`;
  if (ms <= 0) {
    clearInterval(timer.iv);
    $('#timer').classList.add('over');
    $('#tclock').textContent = 'Hazır';
    beep();
    try { if (navigator.vibrate) navigator.vibrate(300); } catch { /* yok */ }
    setTimeout(() => { if (timer.end <= Date.now()) $('#timer').classList.remove('show'); }, 4000);
  }
}

function bindWorkout() {
  $('#wkNotes').innerHTML = K.PROGRESSION_NOTES.map((n) => `<li>${esc(n)}</li>`).join('')
    + '<li>Set kutusuna dokunduğunda o hareketin dinlenme sayacı başlar. Antrenman yaptığın gün su hedefin 500 ml artar.</li>';
  $('#wkFocus').onclick = async (e) => {
    const b = e.target.closest('[data-focus]');
    if (!b || b.dataset.focus === (data.programFocus || 'balanced')) return;
    const upper = b.dataset.focus === 'upper';
    const ok = await askConfirm(upper
      ? 'Üst vücut odaklı programa geçilsin mi? Göğüs, sırt, omuz ve kollar haftada 12–22 sete çıkar; bacaklar 4–8 setle yalnızca korunur, büyümez. Önceki kayıtların silinmez.'
      : 'Dengeli programa geri dönülsün mü? Bacak ve kalça çalışması yeniden artar. Önceki kayıtların silinmez.', 'Geç');
    if (!ok) return;
    commit({ ...data, programFocus: b.dataset.focus }, `${K.FOCUS_LABEL[b.dataset.focus]} programa geçildi`);
  };
  $('#wkRail').onclick = (e) => {
    const b = e.target.closest('[data-wk]');
    if (b) { wkKey = b.dataset.wk; renderWorkout(); }
  };
  $('#wkPrev').onclick = () => { wkKey = K.addDays(wkKey, -7); renderWorkout(); };
  $('#wkNext').onclick = () => {
    const k = K.addDays(wkKey, 7);
    wkKey = k > K.todayKey() ? K.todayKey() : k;
    renderWorkout();
  };
  $('#wkView').onclick = async (e) => {
    const setBtn = e.target.closest('[data-ek]');
    if (setBtn) {
      const ek = setBtn.dataset.ek, si = Number(setBtn.dataset.si);
      const x = K.resolveExercise(wkKey, ek);
      const wasOn = !!(((data.workouts || {})[wkKey] || {})[ek] || [])[si];
      commit(K.toggleSet(data, wkKey, ek, si));
      if (!wasOn && x.rest && wkKey === K.todayKey()) startTimer(x.rest, x.n, si + 1, x.s);
      return;
    }
    const tip = e.target.closest('[data-tip]');
    if (tip) {
      const t = $('#tip-' + tip.dataset.tip);
      t.hidden = !t.hidden;
      tip.setAttribute('aria-expanded', String(!t.hidden));
      return;
    }
    if (e.target.closest('#wkReset') && (await askConfirm('Bu günün setleri sıfırlansın mı?', 'Sıfırla'))) {
      commit(K.resetWorkoutDay(data, wkKey), 'Gün sıfırlandı');
    }
  };
  $('#tplus').onclick = () => {
    timer.end = Math.max(timer.end, Date.now()) + 15000;
    timer.total += 15;
    if ($('#timer').classList.contains('over')) {
      $('#timer').classList.remove('over');
      clearInterval(timer.iv);
      timer.iv = setInterval(tickTimer, 250);
    }
  };
  $('#tskip').onclick = () => { clearInterval(timer.iv); $('#timer').classList.remove('show'); };
}


/* ================== Vücut ================== */
let bodyMode = 'now';
let selectedMuscle = null;

function heatColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    skin: v('--body-skin'), outline: v('--body-line'), none: v('--heat-none'), low: v('--heat-low'),
    building: v('--heat-building'), ideal: v('--heat-ideal'), high: v('--heat-high'), text: v('--text'),
  };
}

function renderBody() {
  const comp = K.composition(data);
  const week = K.weekVolume(data);
  const planned = K.plannedVolume(data.programFocus || 'balanced');
  const target = data.profile.targetWeight;
  const goal = bodyMode === 'goal';
  let bf = comp.bodyFat, dev = K.development(data), heat = week, hint;
  if (goal) {
    bf = target ? K.projectedBodyFat(comp, target) : comp.bodyFat;
    dev = Object.fromEntries(K.MUSCLE_ORDER.map((m) => [m, Math.min(1, planned[m] / 15)]));
    heat = planned;
    hint = target
      ? `Hedef: ${fmt1(target)} kg, yağsız kütle korunursa yaklaşık %${fmt1(bf)} yağ. Program her hafta eksiksiz yapılırsa kaslar bu renklere ulaşır.`
      : "Ayarlar'dan hedef kilonu girersen o kilodaki görünümünü gösteririm. Renkler program eksiksiz yapılınca ulaşılan haftalık seti gösterir.";
  } else {
    hint = 'Şekil son 4 haftadaki antrenmanlarına ve yağ oranına, renkler bu haftaki etkili setlere göre. Bir kasa dokun.';
  }
  $('#bodyBf').textContent = `%${fmt1(bf)} yağ${comp.source === 'bmi' && !goal ? ' (tahmini)' : ''}`;
  if (!goal && comp.measuredOn) {
    hint += ` Son bel ölçünden (${K.keyToDate(comp.measuredOn.key).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}, ${fmt1(comp.measuredOn.kg)} kg, %${fmt1(comp.measuredOn.bodyFat)}) bu yana kilo değişimi yağ olarak sayıldı; yeni bel ölçüsü girersen kesinleşir.`;
  }
  $$('#bodyModeSeg button').forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === bodyMode);
    b.setAttribute('aria-pressed', String(b.dataset.mode === bodyMode));
  });
  const colors = heatColors();
  const opts = { sex: data.profile.sex, bodyFat: bf, dev, heat, colors, selected: selectedMuscle };
  $('#figFront').innerHTML = K.bodySvg({ ...opts, view: 'front' }) + '<div class="figure-cap">Önden</div>';
  $('#figBack').innerHTML = K.bodySvg({ ...opts, view: 'back' }) + '<div class="figure-cap">Arkadan</div>';
  $('#bodyHint').textContent = hint;
  renderMuscleDetail(week, planned);

  // Kas listesi
  const max = 30;
  $('#muscleList').innerHTML = K.MUSCLE_ORDER.map((m) => {
    const v = week[m], st = K.volumeStatus(v);
    return `<button type="button" class="m-row" data-m="${m}" aria-pressed="${selectedMuscle === m}">
      <span class="m-name">${K.MUSCLES[m]}</span>
      <span class="m-track"><span class="m-band" style="left:${(K.SET_TARGET.min / max) * 100}%;width:${((K.SET_TARGET.max - K.SET_TARGET.min) / max) * 100}%"></span>
        <span class="m-fill" style="width:${Math.min(1, v / max) * 100}%;background:${st === 'none' ? 'transparent' : colors[st]}"></span></span>
      <span class="m-val">${fmt1(v)} set · ${K.STATUS_LABEL[st]}</span></button>`;
  }).join('');
  const advice = K.muscleAdvice(data);
  $('#muscleAdvice').innerHTML = advice.map((a) => `<div class="insight info" style="margin-top:8px">${esc(a.text)}</div>`).join('');

  // Kompozisyon
  const kgTxt = (v) => `${fmt1(v)} kg`;
  const male = data.profile.sex === 'm';
  const ffmiLabel = comp.ffmi < (male ? 18 : 14) ? 'düşük' : comp.ffmi < (male ? 22 : 17) ? 'ortalama' : 'kaslı';
  $('#compStats').innerHTML = `
    <div><strong>%${fmt1(comp.bodyFat)}</strong><span>yağ oranı${comp.source === 'bmi' ? ' (tahmini)' : comp.source === 'navy-weight' ? ' (ölçü + kilo)' : ''}</span><em>${comp.fatLabel}</em></div>
    <div><strong>${kgTxt(comp.leanKg)}</strong><span>yağsız kütle</span><em>yağ ${kgTxt(comp.fatKg)}</em></div>
    <div><strong>${fmt1(comp.bmi)}</strong><span>beden kitle indeksi</span><em>${comp.bmiLabel}</em></div>
    <div><strong>${fmt1(comp.ffmi)}</strong><span>FFMI (kas indeksi)</span><em>${ffmiLabel}</em></div>
    <div><strong>${comp.whtr ? (Math.round(comp.whtr * 100) / 100).toLocaleString('tr-TR') : '—'}</strong><span>bel / boy</span><em>${comp.whtrLabel ?? 'beli ölç'}</em></div>
    <div><strong>${fmt1(data.profile.weight)} kg</strong><span>kilo</span><em>${target ? `hedef ${fmt1(target)} kg` : ''}</em></div>`;

  const last = K.latestMeasure(data);
  const m = (last && last.m) || {};
  const set = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v ? fmt1(v) : ''; };
  set('#mWaist', m.waist); set('#mNeck', m.neck); set('#mHip', m.hip); set('#mChest', m.chest); set('#mArm', m.arm); set('#mThigh', m.thigh);
  $('#mHip').placeholder = data.profile.sex === 'f' ? 'yağ hesabı için gerekli' : 'en geniş yer';

  const keys = Object.keys(data.measures || {}).sort().slice(-6).reverse();
  const c = (v) => (v ? fmt1(v) : '—');
  $('#measureHistory').innerHTML = keys.length ? `<div style="overflow-x:auto"><table>
    <tr><th>Tarih</th><th>Bel</th><th>Boyun</th><th>Kalça</th><th>Göğüs</th><th>Pazı</th><th>Uyluk</th></tr>
    ${keys.map((k) => {
      const r = data.measures[k];
      return `<tr><td>${K.keyToDate(k).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</td><td>${c(r.waist)}</td><td>${c(r.neck)}</td><td>${c(r.hip)}</td><td>${c(r.chest)}</td><td>${c(r.arm)}</td><td>${c(r.thigh)}</td></tr>`;
    }).join('')}
  </table></div>` : '';
}

function renderMuscleDetail(week, planned) {
  const box = $('#muscleDetail');
  if (!selectedMuscle) { box.hidden = true; return; }
  const m = selectedMuscle;
  const ex = K.exercisesFor(m, data.programFocus || 'balanced');
  const st = K.volumeStatus(week[m]);
  box.hidden = false;
  box.innerHTML = `<h3>${K.MUSCLES[m]}</h3>
    <div>Bu hafta <b>${fmt1(week[m])}</b> etkili set (${K.STATUS_LABEL[st]}). Program eksiksiz yapılırsa haftada ${fmt1(planned[m])} set.</div>
    ${ex.length ? `<ul>${ex.slice(0, 5).map((e) => `<li>${esc(e.name)} <small>(${e.day}${e.weight < 1 ? ', yardımcı' : ''})</small></li>`).join('')}</ul>` : ''}
    ${K.EXTRA_SUGGEST[m] && planned[m] < 6 ? `<p style="margin:8px 0 0">${esc(K.EXTRA_SUGGEST[m])}</p>` : ''}`;
}

function bindBody() {
  $('#bodyModeSeg').onclick = (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) { bodyMode = b.dataset.mode; renderBody(); }
  };
  const pick = (m) => { selectedMuscle = selectedMuscle === m ? null : m; renderBody(); };
  ['#figFront', '#figBack'].forEach((id) => ($(id).onclick = (e) => {
    const g = e.target.closest('[data-muscle]');
    if (g) pick(g.dataset.muscle);
  }));
  $('#muscleList').onclick = (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    pick(b.dataset.m);
    if (selectedMuscle) $('#muscleDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  $('#measureForm').onsubmit = (e) => {
    e.preventDefault();
    const num = (id) => { const v = Number(String($(id).value).replace(',', '.')); return v > 0 && v < 300 ? v : undefined; };
    const m = { waist: num('#mWaist'), neck: num('#mNeck'), hip: num('#mHip'), chest: num('#mChest'), arm: num('#mArm'), thigh: num('#mThigh') };
    if (!Object.values(m).some(Boolean)) { toast('En az bir ölçü gir'); return; }
    if (m.waist && m.neck && m.neck >= m.waist) { toast('Boyun ölçüsü belden küçük olmalı'); return; }
    commit(K.setMeasure(data, K.todayKey(), m), 'Ölçüler kaydedildi');
  };
}

/* ================== Olaylar ================== */
function switchTab(view) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $('#topbar').hidden = view !== 'today';
  if (view === 'progress') renderProgress();
  if (view === 'settings') renderSettings();
  if (view === 'workout') { wkKey = K.todayKey(); renderWorkout(); }
  if (view === 'body') renderBody();
  window.scrollTo(0, 0);
}

function readProfile() {
  const num = (id, fallback) => { const v = Number(String($(id).value).replace(',', '.')); return v > 0 ? v : fallback; };
  const target = num('#pTarget', 0);
  return {
    sex: $('#pSex').value,
    age: num('#pAge', data.profile.age),
    height: num('#pHeight', data.profile.height),
    weight: num('#pWeight', data.profile.weight),
    activity: Number($('#pActivity').value),
    goal: Number($('#pGoal').value),
    targetWeight: target || undefined,
  };
}

function bindEvents() {
  $('#prevDay').onclick = () => shiftDay(-1);
  $('#nextDay').onclick = () => shiftDay(1);
  $$('.tab').forEach((tab) => (tab.onclick = () => switchTab(tab.dataset.view)));

  // Akıllı yemek kaydı
  let parseTimer;
  $('#mealText').addEventListener('input', () => {
    clearTimeout(parseTimer);
    parseTimer = setTimeout(runParse, 120);
  });
  $('#mealText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runParse();
      if (!$('#addParsed').disabled) $('#addParsed').click();
    }
  });
  $('#mealSeg').onclick = (e) => {
    const b = e.target.closest('[data-meal]');
    if (!b) return;
    mealSel = b.dataset.meal;
    mealPinned = true;
    renderMealSeg();
    renderPreview();
  };
  $('#parsePreview').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pv]');
    if (!b) return;
    parsed.items.splice(Number(b.dataset.pv), 1);
    renderPreview();
  });
  $('#parsePreview').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-unknown]');
    if (!inp) return;
    unknownKcal[inp.dataset.unknown] = inp.value;
    // Odak kaybolmasın diye yalnızca toplam ve düğme güncellenir
    const tot = $('#parsePreview .pv-total span:last-child');
    if (tot) tot.textContent = previewTotalText();
    const count = previewCount();
    $('#addParsed').disabled = count === 0;
    $('#addParsed').textContent = addLabel(count);
  });
  $('#addParsed').onclick = () => {
    let next = K.addParsedItems(data, viewKey, parsed.items, mealSel);
    let learned = 0;
    for (const u of parsed.unknownItems) {
      const kcal = Math.round(Number(unknownKcal[u.text]));
      if (!(kcal > 0)) continue;
      next = K.addFoodEntry(next, viewKey, { name: u.text.charAt(0).toLocaleUpperCase('tr-TR') + u.text.slice(1), cal: kcal, meal: mealSel });
      next = K.learnFood(next, u.name, kcal / (u.qty || 1));
      learned++;
    }
    const added = K.sumItems(parsed.items);
    const extra = parsed.unknownItems.reduce((s, u) => s + (Number(unknownKcal[u.text]) || 0), 0);
    $('#mealText').value = '';
    parsed = { items: [], unknownItems: [] };
    mealPinned = false;
    if (added.hydrationMl) markDrankNow(viewKey);
    commit(next, `Eklendi: ${fmt(added.kcal + extra)} kcal${added.hydrationMl ? `, ${fmt(added.hydrationMl)} ml sıvı` : ''}${learned ? '. Yeni yemeği öğrendim.' : ''}`);
    renderPreview();
  };

  $('#recentList').onclick = (e) => {
    const b = e.target.closest('[data-recent]');
    if (!b) return;
    const r = recentCache[Number(b.dataset.recent)];
    commit(K.addFoodEntry(data, viewKey, { name: r.name, cal: r.cal, p: r.p, c: r.c, f: r.f, grams: r.grams, foodId: r.foodId, meal: mealSel }),
      `${r.name} eklendi`);
  };
  $('#copyRow').onclick = (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    commit(K.copyMeal(data, K.addDays(viewKey, -1), viewKey, b.dataset.copy), `Dünkü ${K.MEALS[b.dataset.copy].toLocaleLowerCase('tr-TR')} eklendi`);
  };

  // Su ve içecekler
  $$('#view-today [data-water]').forEach((b) => (b.onclick = () => addWaterMl(b.dataset.water)));
  $('#drinkList').onclick = (e) => {
    const b = e.target.closest('[data-drink]');
    if (!b) return;
    const f = K.FOOD_BY_ID[b.dataset.drink];
    markDrankNow(viewKey);
    commit(K.addDrink(data, viewKey, f.id, f.grams, mealSel), `${f.name.split(' / ')[0]} eklendi (${fmt(f.grams * (f.hydration || 0))} ml sıvı)`);
  };
  $('#waterForm').onsubmit = (e) => {
    e.preventDefault();
    addWaterMl($('#waterCustom').value);
    $('#waterCustom').value = '';
  };

  $('#logList').onclick = (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { editId = editId === ed.dataset.edit ? null : ed.dataset.edit; renderLog(K.totals(data, viewKey)); return; }
    const sc = e.target.closest('[data-scale]');
    if (sc) { commit(K.scaleEntry(data, viewKey, sc.dataset.id, Number(sc.dataset.scale)), 'Porsiyon güncellendi'); return; }
    const mv = e.target.closest('[data-move]');
    if (mv) { editId = null; commit(K.moveEntry(data, viewKey, mv.dataset.id, mv.dataset.move), `${K.MEALS[mv.dataset.move]} öğününe taşındı`); return; }
    const b = e.target.closest('.del');
    if (b) askConfirm('Bu kayıt silinsin mi?', 'Sil').then((ok) => ok && commit(K.removeEntry(data, viewKey, b.dataset.type, b.dataset.id)));
  };

  // Kilo
  $('#weightForm').onsubmit = (e) => {
    e.preventDefault();
    const v = Number(String($('#weightInput').value).replace(',', '.'));
    if (!(v >= 30 && v <= 300)) { toast('Kiloyu 30–300 kg arasında gir'); return; }
    commit(K.setWeight(data, K.todayKey(), v), `${fmt1(v)} kg kaydedildi`);
    renderProgress();
  };
  $('#tdeeCard').addEventListener('click', (e) => {
    const b = e.target.closest('#applyTdee');
    if (!b) return;
    const cal = Number(b.dataset.cal);
    commit({ ...data, goals: { ...data.goals, cal, ...K.macroGoals(cal, data.profile.weight, data.profile.goal) } }, `Kalori hedefi ${fmt(cal)} kcal oldu`);
    renderProgress();
  });

  // Profil
  $('#calcBtn').onclick = () => {
    const res = K.calcGoals(readProfile());
    $('#goalCal').value = res.cal; $('#goalWater').value = res.water;
    $('#goalP').value = res.p; $('#goalC').value = res.c; $('#goalF').value = res.f;
    updateMacroSum();
    $('#calcHint').textContent = `Bazal metabolizma ${fmt(res.bmr)} kcal, günlük harcama ${fmt(res.tdee)} kcal. Kaydet'e basmayı unutma.`;
  };
  ['#goalP', '#goalC', '#goalF', '#goalCal'].forEach((id) => $(id).addEventListener('input', updateMacroSum));
  $('#profileForm').onsubmit = (e) => {
    e.preventDefault();
    const profile = readProfile();
    const kb = Number($('#pKb').value);
    let next = { ...data, profile, kbWeight: kb >= 2 && kb <= 64 ? kb : data.kbWeight, goals: {
      cal: Number($('#goalCal').value), water: Number($('#goalWater').value),
      p: Number($('#goalP').value), c: Number($('#goalC').value), f: Number($('#goalF').value),
    } };
    // Profil kilosu değiştiyse bugünün tartısı olarak da kaydet
    if (profile.weight !== data.profile.weight) next = K.setWeight(next, K.todayKey(), profile.weight);
    commit(next, 'Hedefler kaydedildi');
  };

  // Hatırlatıcılar
  $('#notifPermBtn').onclick = requestPermission;
  $('#bannerClose').onclick = () => ($('#banner').hidden = true);
  $$('[data-banner-water]').forEach((b) => (b.onclick = () => {
    $('#banner').hidden = true;
    viewKey = K.todayKey();
    addWaterMl(b.dataset.bannerWater, viewKey);
  }));
  $('#confirmNo').onclick = () => closeConfirm(false);
  $('#confirmYes').onclick = () => closeConfirm(true);
  $('#reminderForm').onsubmit = (e) => {
    e.preventDefault();
    data = { ...data, reminders: {
      waterOn: $('#rWaterOn').checked, waterEvery: Number($('#rWaterEvery').value),
      start: $('#rStart').value || '09:00', end: $('#rEnd').value || '22:00',
      mealOn: $('#rMealOn').checked,
      breakfast: $('#rBreakfast').value || '09:30', lunch: $('#rLunch').value || '13:30', dinner: $('#rDinner').value || '20:00',
      summaryOn: $('#rSummaryOn').checked, summary: $('#rSummary').value || '21:30',
      weighOn: $('#rWeighOn').checked, weigh: $('#rWeigh').value || '08:00',
    } };
    save();
    toast('Hatırlatıcılar kaydedildi');
    if (notifSupported() && Notification.permission === 'default') requestPermission();
  };
  $('#testNotif').onclick = async () => {
    if (notifSupported() && Notification.permission === 'default') await requestPermission();
    await notify('💧 Test bildirimi', 'Hatırlatmalar çalışıyor. Butonla su ekleyebilirsin.', 'test', true);
  };

  // Yedek
  $('#exportBtn').onclick = async () => {
    const json = JSON.stringify(lock ? await encryptJson(data, lock.key, lock.salt) : data);
    const done = () => toast(lock ? 'Şifreli yedek panoya kopyalandı. Açmak için parolan gerekir.' : 'Yedek panoya kopyalandı. Bir not dosyasına yapıştırıp sakla.');
    if (navigator.clipboard) navigator.clipboard.writeText(json).then(done).catch(() => fallbackCopy(json));
    else fallbackCopy(json);
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `kal-yedek-${K.todayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { /* indirme engelli olabilir */ }
  };
  const importJson = async (text) => {
    let imported;
    try {
      imported = JSON.parse(text);
      if (isEnvelope(imported)) {
        const pw = await askPassword('Bu yedek şifreli. Yedeği alırken kullandığın parolayı gir.');
        if (pw == null) return false;
        const opened = await openEnvelope(imported, pw);
        if (!opened) { toast('Parola yanlış.'); return false; }
        imported = opened.data;
      }
      if (!imported || !imported.days) throw new Error();
    } catch {
      toast('Geçersiz yedek. Metnin tamamını kopyaladığından emin ol.');
      return false;
    }
    if (!(await askConfirm('Mevcut veriler yedekteki verilerle değiştirilecek.', 'Yükle'))) return false;
    commit(K.migrate(imported), 'Veriler yüklendi');
    renderSettings();
    return true;
  };
  $('#importFile').onchange = async (e) => {
    const file = e.target.files[0];
    if (file) await importJson(await file.text());
    e.target.value = '';
  };
  $('#importBtn').onclick = async () => {
    if (await importJson($('#importText').value.trim())) $('#importText').value = '';
  };
  $('#resetBtn').onclick = async () => {
    if (!(await askConfirm('Tüm kayıtlar ve ayarlar silinecek. Bu geri alınamaz.', 'Hepsini sil'))) return;
    lock = null;
    viewKey = K.todayKey();
    commit(K.migrate({}), 'Sıfırlandı');
    renderSettings();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!lock) data = loadData();
      if (viewKey > K.todayKey()) viewKey = K.todayKey();
      render();
      checkReminders();
    }
  });
}

function fallbackCopy(text) {
  const ta = $('#importText');
  ta.value = text;
  ta.select();
  toast('Kopyalanamadı. Metin aşağıdaki kutuda seçili, elle kopyalayabilirsin.');
}

/* ================== Başlat ================== */
/* ---------- Kilit ekranı ve ayarları ---------- */
let pwResolve = null;
function askPassword(msg) {
  $('#pwMsg').textContent = msg;
  $('#pwInput').value = '';
  $('#pwBox').hidden = false;
  $('#pwInput').focus();
  return new Promise((res) => (pwResolve = res));
}
function closePassword(v) {
  $('#pwBox').hidden = true;
  if (pwResolve) pwResolve(v);
  pwResolve = null;
}

function showLockScreen() {
  $('#lock').hidden = false;
  $('#unlockPw').focus();
  return new Promise((resolve) => {
    $('#unlockForm').onsubmit = async (e) => {
      e.preventDefault();
      const pw = $('#unlockPw').value;
      if (!pw) return;
      $('#unlockBtn').disabled = true;
      $('#unlockBtn').textContent = 'Açılıyor…';
      $('#unlockErr').textContent = '';
      const opened = await openEnvelope(lockedEnvelope, pw);
      $('#unlockBtn').disabled = false;
      $('#unlockBtn').textContent = 'Aç';
      if (!opened) {
        $('#unlockErr').textContent = 'Parola yanlış.';
        $('#unlockPw').select();
        return;
      }
      lock = { key: opened.key, salt: opened.salt };
      data = K.migrate(opened.data);
      lockedEnvelope = null;
      $('#unlockPw').value = '';
      $('#lock').hidden = true;
      resolve();
    };
    $('#forgotBtn').onclick = async () => {
      if (!(await askConfirm('Parola olmadan şifreli verileri açmak mümkün değil. Bu cihazdaki tüm kayıtlar silinip baştan başlanacak.', 'Sil ve baştan başla'))) return;
      try { localStorage.removeItem(STORE_KEY); } catch { /* yok */ }
      location.reload();
    };
  });
}

function renderLockSettings() {
  const on = !!lock;
  $('#lockStatus').textContent = on
    ? 'Kilit açık: kayıtların bu cihazda AES-256 ile şifreli duruyor ve yedeklerin de şifreli alınıyor. Parolanı unutursan veriler açılamaz.'
    : 'Verilerin zaten yalnızca bu cihazda duruyor, internete gönderilmiyor. Kilidi açarsan cihazdaki kayıtlar ve yedekler parolayla şifrelenir; uygulama her açılışta parola sorar.';
  $('#lockCurWrap').hidden = !on;
  $('#lockSave').textContent = on ? 'Parolayı değiştir' : 'Kilidi aç';
  $('#lockNow').hidden = !on;
  $('#lockOff').hidden = !on;
}

async function verifyCurrent() {
  const pw = $('#lockCur').value;
  if (!pw) { toast('Mevcut parolanı gir'); return false; }
  const key = await deriveKey(pw, lock.salt);
  try {
    await decryptEnvelope(JSON.parse(localStorage.getItem(STORE_KEY)), key);
    return true;
  } catch {
    toast('Mevcut parola yanlış');
    return false;
  }
}

function bindLock() {
  $('#pwForm').onsubmit = (e) => { e.preventDefault(); closePassword($('#pwInput').value); };
  $('#pwCancel').onclick = () => closePassword(null);
  $('#lockForm').onsubmit = async (e) => {
    e.preventDefault();
    const a = $('#lockNew').value, b = $('#lockNew2').value;
    if (a.length < 4) { toast('Parola en az 4 karakter olmalı'); return; }
    if (a !== b) { toast('Parolalar aynı değil'); return; }
    if (lock && !(await verifyCurrent())) return;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wasOn = !!lock;
    lock = { key: await deriveKey(a, salt), salt };
    await save();
    ['#lockCur', '#lockNew', '#lockNew2'].forEach((id) => ($(id).value = ''));
    renderLockSettings();
    toast(wasOn ? 'Parola değiştirildi' : 'Kilit açıldı, veriler şifrelendi');
  };
  $('#lockNow').onclick = async () => {
    await saveChain;
    location.reload();
  };
  $('#lockOff').onclick = async () => {
    if (!(await verifyCurrent())) return;
    lock = null;
    await save();
    $('#lockCur').value = '';
    renderLockSettings();
    toast('Kilit kaldırıldı');
  };
}

async function init() {
  bindLock();
  if (lockedEnvelope) await showLockScreen();
  bindEvents();
  bindWorkout();
  bindBody();
  renderDrinks();
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:' && document.querySelector('link[rel=manifest]')) {
    try {
      swReg = await navigator.serviceWorker.register('sw.js');
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'notification-action') handleAction(e.data.action);
      });
    } catch (err) { console.warn('Service worker kaydedilemedi', err); }
  }

  const params = new URLSearchParams(location.search);
  if (params.get('action')) {
    handleAction(params.get('action'));
    history.replaceState(null, '', location.pathname);
  }

  if (firstRun) {
    notifState.lastWater = Date.now(); // ilk açılışta hemen su hatırlatması çıkmasın
    saveNotif();
    save();
    toast('Hoş geldin! Ayarlar\'dan hedeflerini belirleyerek başla.');
  }

  checkReminders();
  setInterval(checkReminders, 30 * 1000);
  let lastToday = K.todayKey();
  setInterval(() => {
    const tk = K.todayKey();
    if (tk !== lastToday) { if (viewKey === lastToday) viewKey = tk; lastToday = tk; render(); }
  }, 60 * 1000);
}

init();
