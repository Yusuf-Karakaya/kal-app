#!/usr/bin/env python3
"""Tarif şablonlarından yemek/içecek satırları üretir → mobile/src/core/foods_gen.ts

Her yemek, ham malzemelerin 100 g besin değerlerinden (TürKomp/USDA ortalamaları) pişirme kurallarıyla
hesaplanır: ızgarada su kaybı (değerler yoğunlaşır), kızartmada un ve yağ eklenir, zeytinyağlılarda yağ ve
soğan, etli yemeklerde kıyma ve salça, hamur işlerinde hamur + iç oranı vb. Kalori makrolardan (4/4/9) çıkar.

Kullanım: python3 tools/gen_foods.py <mevcut-adlar.json> [atlanacak-adlar.json]
Mevcut veritabanındaki adlarla çakışan adlar atlanır; adı kalmayan yemek eklenmez.
"""
import json
import re
import sys

EXISTING = json.load(open(sys.argv[1], encoding='utf-8'))
DROP = set(json.load(open(sys.argv[2], encoding='utf-8'))) if len(sys.argv) > 2 else set()

FOLD = {'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u'}
NUM = set('bir bi iki uc dort bes alti yedi sekiz dokuz on onbir oniki onbes yirmi otuz kirk elli yuz yarim ceyrek birkac biraz cift bucuk'.split())


def lower(s):
    return s.replace('I', 'ı').replace('İ', 'i').lower()


def fold(s):
    return ''.join(FOLD.get(ch, ch) for ch in lower(s))


def norm(s):
    return ' '.join(re.sub(r'[^a-z0-9.,/\s]', ' ', fold(s)).split())


def cap(s):
    return ('İ' if s[0] == 'i' else 'I' if s[0] == 'ı' else s[0].upper()) + s[1:]


def li(word):
    """Türkçe -lı/-li/-lu/-lü eki (ses uyumu)"""
    w = lower(word)
    for ch in reversed(w):
        if ch in 'aı':
            return word + 'lı'
        if ch in 'ei':
            return word + 'li'
        if ch in 'ou':
            return word + 'lu'
        if ch in 'öü':
            return word + 'lü'
    return word + 'li'


TAKEN = set(EXISTING['aliases'])
IDS = set(EXISTING['ids'])
ROWS = []


def slug(s):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', fold(s))).strip('-')


def add(name, aliases, p, c, f, unit, grams, group, units='', hyd=None):
    """Bir yemek ekler. Değerler 100 g başına; kalori makrolardan hesaplanır."""
    p, c, f = max(0, round(p, 1)), max(0, round(c, 1)), max(0, round(f, 1))
    # Ana ad zaten veritabanında varsa bu yemek mevcuttur; yan adlarla ikinci bir kopya açılmaz
    if norm(aliases[0]) in TAKEN or norm(name) in TAKEN:
        return False
    good = []
    for a in aliases:
        a = lower(a).strip()
        n = norm(a)
        if not n or n in TAKEN or n in DROP:
            continue
        if any(t in NUM or re.match(r'^\d', t) for t in n.split()):
            continue
        TAKEN.add(n)
        good.append(a)
    if not good:
        return False
    i = 'g-' + slug(name)
    base, k = i, 2
    while i in IDS:
        i = f'{base}-{k}'
        k += 1
    IDS.add(i)
    kcal = round(4 * p + 4 * c + 9 * f)
    ROWS.append((i, cap(name), '|'.join(good), kcal, p, c, f, unit, grams, units, group, hyd))
    return True


# ---------------------------------------------------------------- balıklar
# ad, protein, yağ (çiğ, 100 g)
FISH = [
    ('hamsi', 20, 4.8), ('istavrit', 19, 6), ('sardalya', 21, 10), ('uskumru', 19, 14), ('palamut', 23, 8),
    ('lüfer', 21, 4.2), ('levrek', 19, 3), ('çupra', 20, 5), ('çipura', 20, 5), ('alabalık', 20, 6.6),
    ('somon', 20, 13), ('mezgit', 18, 0.7), ('barbun', 19, 4), ('kefal', 19, 5), ('kalkan', 16, 3),
    ('dil balığı', 18, 1.5), ('orkinos', 23, 5), ('kılıç', 20, 4), ('tirsi', 18, 9), ('zargana', 20, 3),
    ('çinekop', 21, 4), ('sinarit', 20, 2.5), ('mercan', 20, 3), ('fangri', 20, 3), ('sarıkanat', 21, 4),
    ('torik', 23, 8), ('kolyoz', 20, 10), ('gümüş', 18, 2), ('izmarit', 18, 4), ('lahos', 20, 1.5),
    ('orfoz', 19, 1.5), ('sazan', 18, 5.6), ('yayın balığı', 16, 3), ('morina', 18, 0.7), ('pisi balığı', 17, 2),
    ('karagöz', 20, 4), ('iskorpit', 19, 2), ('mırmır', 20, 3), ('turna balığı', 19, 1), ('kupes', 18, 3),
    ('akya', 21, 3), ('tekir', 19, 4), ('karides', 20, 1.7), ('kalamar', 16, 1.4), ('ahtapot', 15, 1),
    ('midye', 12, 2.2), ('ıstakoz', 19, 0.9), ('yengeç', 18, 1), ('tilapia', 20, 1.7), ('pangasius', 15, 3),
]
for n, p, f in FISH:
    add(f'{n} ızgara', [f'{n} ızgara', f'ızgara {n}', f'{n} ızgarası', n], p * 1.25, 0, f * 1.2 + 1, 'porsiyon', 200, 'et')
    add(f'{n} tava', [f'{n} tava', f'{n} tavası', f'kızarmış {n}', f'{n} kızartma', f'{n} kızartması'], p * 1.1, 9, f * 1.1 + 10, 'porsiyon', 200, 'et')
    add(f'{n} buğulama', [f'{n} buğulama', f'{n} buğulaması', f'buğulama {n}'], p * 0.85, 3.5, f * 0.85 + 3.5, 'porsiyon', 300, 'et')
    add(f'fırında {n}', [f'fırında {n}', f'{n} fırın', f'{n} fırında', f'fırın {n}'], p * 1.2, 2, f * 1.15 + 4, 'porsiyon', 250, 'et')
for n, p, f in FISH[:20]:
    add(f'{n} çorbası', [f'{n} çorbası'], p * 0.25, 4, f * 0.25 + 2, 'kase', 250, 'corba')
for n in ['hamsi', 'somon', 'levrek', 'ton balığı', 'karides', 'kalamar', 'midye', 'mezgit']:
    add(f'{n} salatası', [f'{n} salatası', f'{li(n.split()[0])} salata'], 9, 4, 7, 'porsiyon', 200, 'salata')

# ---------------------------------------------------------------- etler
# ad, protein, yağ, karb, uygun pişirmeler
G = 'izgara haslama kavurma sote firin guvec tava yahni sis'.split()
MEAT = [
    ('dana kuşbaşı', 21, 8, 0, G), ('dana bonfile', 21, 6, 0, G), ('dana antrikot', 20, 15, 0, ['izgara', 'tava', 'firin']),
    ('dana kontrfile', 21, 9, 0, ['izgara', 'tava', 'firin', 'sote']), ('dana but', 21, 5, 0, ['haslama', 'firin', 'guvec', 'yahni', 'kavurma']),
    ('dana kaburga', 17, 24, 0, ['haslama', 'firin', 'izgara']), ('dana incik', 20, 6, 0, ['haslama', 'firin', 'guvec', 'yahni']),
    ('dana döş', 18, 20, 0, ['haslama', 'firin', 'kavurma']), ('dana pirzola', 20, 12, 0, ['izgara', 'tava', 'firin']),
    ('dana ciğer', 20, 3.6, 4, ['izgara', 'tava', 'sote', 'sis']), ('dana yürek', 17, 4, 0, ['izgara', 'sote']),
    ('dana kıyma', 18, 18, 0, ['kavurma', 'sote']), ('yağsız kıyma', 21, 8, 0, ['kavurma', 'sote']),
    ('kuzu pirzola', 17, 24, 0, ['izgara', 'tava', 'firin']), ('kuzu kuşbaşı', 19, 13, 0, G), ('kuzu kol', 18, 15, 0, ['firin', 'haslama', 'guvec']),
    ('kuzu but', 19, 12, 0, ['firin', 'haslama', 'guvec', 'izgara']), ('kuzu incik', 19, 10, 0, ['firin', 'haslama', 'guvec']),
    ('kuzu kaburga', 16, 28, 0, ['firin', 'izgara', 'haslama']), ('kuzu ciğer', 20, 5, 2, ['izgara', 'tava', 'sote', 'sis']),
    ('kuzu gerdan', 17, 18, 0, ['firin', 'haslama', 'guvec']), ('kuzu kıyma', 17, 21, 0, ['kavurma']), ('kuzu böbrek', 16, 3, 0, ['izgara', 'sote', 'sis']),
    ('keçi eti', 21, 2.6, 0, ['haslama', 'kavurma', 'firin', 'guvec']), ('oğlak eti', 20, 3, 0, ['firin', 'kavurma', 'haslama']),
    ('tavuk göğüs', 23, 1.5, 0, ['haslama', 'kavurma', 'sote', 'firin', 'guvec', 'tava', 'sis']), ('tavuk bonfile', 23, 1.5, 0, ['izgara', 'sote', 'tava', 'firin']),
    ('tavuk but', 19, 5, 0, ['izgara', 'haslama', 'kavurma', 'sote', 'firin', 'guvec', 'tava', 'sis']),
    ('derili tavuk but', 17, 12, 0, ['izgara', 'firin', 'tava']), ('tavuk baget', 19, 8, 0, ['izgara', 'firin', 'tava', 'haslama']),
    ('tavuk pirzola', 18, 9, 0, ['izgara', 'firin', 'tava']), ('tavuk kanat', 18, 14, 0, ['firin', 'tava', 'haslama']),
    ('tavuk ciğer', 17, 5, 1, ['sote', 'tava', 'izgara', 'sis']), ('tavuk taşlık', 18, 2, 0, ['sote', 'haslama', 'izgara']),
    ('tavuk kıyma', 17, 8, 0, ['kavurma', 'sote']), ('tavuk kalça', 18, 10, 0, ['izgara', 'firin']),
    ('hindi göğüs', 24, 1.5, 0, G), ('hindi but', 20, 4, 0, ['firin', 'haslama', 'guvec', 'izgara']), ('hindi kıyma', 19, 8, 0, ['kavurma', 'sote']),
    ('tavşan', 21, 5, 0, ['firin', 'guvec', 'haslama']), ('bıldırcın', 20, 12, 0, ['izgara', 'firin', 'tava']),
    ('ördek göğsü', 19, 6, 0, ['izgara', 'firin']), ('ördek', 18, 20, 0, ['firin']), ('kaz', 16, 30, 0, ['firin']),
    ('dana sucuk', 20, 32, 2, ['izgara', 'tava']), ('kavurma eti', 25, 20, 0, ['tava']),
]
M = {
    # pişirme: (ad kalıbı, ad kalıpları, p çarpanı, k ekleme, y çarpanı, y ekleme, birim, gram, grup)
    'izgara': ('{n} ızgara', ['{n} ızgara', 'ızgara {n}', '{n} ızgarası'], 1.3, 0, 1.1, 0.5, 'porsiyon', 180, 'et'),
    'haslama': ('{n} haşlama', ['{n} haşlama', 'haşlanmış {n}', '{n} haşlaması'], 1.25, 0, 0.95, 0, 'porsiyon', 200, 'et'),
    'kavurma': ('{n} kavurma', ['{n} kavurma', '{n} kavurması', 'kavrulmuş {n}'], 1.35, 1, 1.2, 6, 'porsiyon', 180, 'et'),
    'sote': ('{n} sote', ['{n} sote', '{n} sotesi', 'sebzeli {n} sote'], 0.8, 4, 0.8, 4, 'porsiyon', 250, 'ana'),
    'firin': ('fırında {n}', ['fırında {n}', '{n} fırın', '{n} fırında', 'fırın {n}'], 1.3, 1, 1.1, 2, 'porsiyon', 200, 'et'),
    'guvec': ('{n} güveç', ['{n} güveç', 'güveçte {n}', '{n} güveci'], 0.6, 5, 0.6, 3.5, 'porsiyon', 300, 'ana'),
    'tava': ('{n} tava', ['{n} tava', '{n} kızartma', 'kızarmış {n}', 'pane {n}', '{n} tavası'], 1.2, 6, 1.1, 8, 'porsiyon', 180, 'et'),
    'yahni': ('{n} yahni', ['{n} yahni', '{n} yahnisi', 'soğanlı {n}'], 0.7, 4, 0.7, 3, 'porsiyon', 250, 'ana'),
    'sis': ('{n} şiş', ['{n} şiş', 'şiş {n}', '{n} şişi'], 1.3, 0, 1.1, 1, 'şiş', 90, 'et'),
}
for n, p, f, c, methods in MEAT:
    for m in methods:
        nm, als, pm, ca, fm, fa, u, g, grp = M[m]
        add(nm.format(n=n), [a.format(n=n) for a in als], p * pm, c + ca, f * fm + fa, u, g, grp,
            units='porsiyon:%d' % g if u == 'şiş' else '')

# ---------------------------------------------------------------- sebzeler
# ad, p, k, y, etiketler (z: zeytinyağlı, e: etli, k: kızartma, h: haşlama, o: köz, s: salata, c: çorba,
# g: graten/fırın, p: püre, t: sote, u: turşu, d: dolma, r: sarma, m: mücver), ham porsiyon
VEG = [
    ('patlıcan', 1, 5.9, 0.2, 'ekhosgtudm', 150), ('kabak', 1.2, 3.1, 0.3, 'zekhosgctdm', 150), ('biber', 0.9, 4.6, 0.2, 'zekosgtud', 30),
    ('kırmızı biber', 1, 6, 0.3, 'kostgu', 120), ('domates', 0.9, 3.9, 0.2, 'esocgdu', 120), ('salatalık', 0.7, 3.6, 0.1, 'su', 150),
    ('havuç', 0.9, 9.6, 0.2, 'zehsocgptum', 80), ('patates', 2, 17, 0.1, 'ehosgctm', 150), ('tatlı patates', 1.6, 20, 0.1, 'hogcptk', 150),
    ('soğan', 1.1, 9.3, 0.1, 'kocgdu', 100), ('pırasa', 1.5, 14, 0.3, 'zehgctm', 100), ('ıspanak', 2.9, 3.6, 0.4, 'zehsgcptm', 100),
    ('pazı', 1.8, 3.7, 0.2, 'zehtr', 100), ('lahana', 1.3, 5.8, 0.1, 'zehscutr', 100), ('karalahana', 3, 5, 0.6, 'zehctr', 100),
    ('kırmızı lahana', 1.4, 7.4, 0.2, 'su', 100), ('karnabahar', 1.9, 5, 0.3, 'zekhsgcptu', 150), ('brokoli', 2.8, 6.6, 0.4, 'zehsgcpt', 150),
    ('brüksel lahanası', 3.4, 9, 0.3, 'ehgt', 100), ('kereviz', 1.5, 9.2, 0.3, 'zehsgcpt', 100), ('taze fasulye', 1.8, 7, 0.2, 'zehstcu', 150),
    ('bezelye', 5.4, 14.5, 0.4, 'zehscpt', 100), ('bakla', 7.6, 11.7, 0.6, 'zehsc', 100), ('bamya', 1.9, 7.5, 0.2, 'zehkct', 100),
    ('enginar', 3.3, 10.5, 0.2, 'zehsgcd', 120), ('mantar', 3.1, 3.3, 0.3, 'zekhosgcd', 100), ('kuşkonmaz', 2.2, 3.9, 0.1, 'zhogct', 100),
    ('mısır', 3.3, 19, 1.4, 'hsoc', 150), ('turp', 0.7, 3.4, 0.1, 'su', 50), ('pancar', 1.6, 10, 0.2, 'hscu', 80),
    ('balkabağı', 1, 6.5, 0.1, 'zhgcpt', 150), ('semizotu', 2, 3.4, 0.4, 'zest', 100), ('roka', 2.6, 3.7, 0.7, 's', 50),
    ('marul', 1.4, 2.9, 0.2, 's', 100), ('maydanoz', 3, 6.3, 0.8, 's', 20), ('ebegümeci', 3, 5, 0.5, 'zet', 100),
    ('ısırgan', 2.7, 7, 0.1, 'zcet', 100), ('börülce', 2.8, 9.5, 0.3, 'zehs', 150), ('şalgam', 0.9, 6.4, 0.1, 'hcu', 100),
    ('yer elması', 2, 17, 0, 'zehp', 100), ('asma yaprağı', 5.6, 17, 2.1, 'r', 30), ('kabak çiçeği', 1, 3.3, 0.1, 'd', 15),
    ('madımak', 3, 6, 0.5, 'et', 100), ('kuzukulağı', 2, 3.2, 0.7, 'st', 50), ('hardal otu', 2.9, 4.7, 0.4, 'zt', 100),
    ('radika', 1.5, 4.7, 0.3, 'zs', 100), ('labada', 2, 3, 0.5, 'er', 100), ('çiriş otu', 2, 4, 0.3, 'zet', 100),
    ('fırın biber', 1, 6, 0.3, '', 50), ('kapya biber', 1, 6, 0.3, 'kosd', 80), ('çarliston biber', 0.9, 4.6, 0.2, 'kod', 40),
    ('sivri biber', 0.9, 4.6, 0.2, 'kou', 20), ('cherry domates', 0.9, 3.9, 0.2, 's', 15), ('kornişon', 0.7, 3.6, 0.1, 'u', 30),
    ('sarımsak', 6.4, 33, 0.5, 'u', 4), ('zencefil', 1.8, 18, 0.8, '', 10), ('kale', 4.3, 8.8, 0.9, 'st', 50),
]
for n, p, c, f, tags, g in VEG:
    if 'z' in tags:
        add(f'zeytinyağlı {n}', [f'zeytinyağlı {n}', f'{n} zeytinyağlı', f'zeytinyağlı {n} yemeği'], p * 0.9 + 0.3, c * 0.9 + 2, f + 6.5, 'porsiyon', 200, 'ana')
    if 'e' in tags:
        add(f'etli {n}', [f'etli {n}', f'kıymalı {n}', f'{n} yemeği', f'etli {n} yemeği', f'kıymalı {n} yemeği', f'{n} kıymalı'],
            p * 0.75 + 3.5, c * 0.75 + 1.5, f * 0.75 + 5, 'porsiyon', 250, 'ana')
    if 'k' in tags:
        add(f'{n} kızartması', [f'{n} kızartması', f'kızarmış {n}', f'{n} kızartma'], p * 0.9, c * 0.9 + 3, f + 12, 'porsiyon', 150, 'ana')
    if 'h' in tags:
        add(f'haşlanmış {n}', [f'haşlanmış {n}', f'{n} haşlama', f'buharda {n}'], p, c, f, 'porsiyon', 150, 'sebze')
    if 'o' in tags:
        add(f'közlenmiş {n}', [f'közlenmiş {n}', f'köz {n}', f'közde {n}', f'{n} köz'], p * 1.1, c * 1.1, f + 1, 'porsiyon', 120, 'salata')
    if 's' in tags:
        add(f'{n} salatası', [f'{n} salatası', f'{li(n.split()[-1])} salata'], p * 0.9, c * 0.9 + 0.8, f + 5, 'porsiyon', 150, 'salata')
    if 'c' in tags:
        add(f'{n} çorbası', [f'{n} çorbası', f'kremalı {n} çorbası'], p * 0.35 + 0.8, c * 0.35 + 3, f * 0.35 + 2.5, 'kase', 250, 'corba')
    if 'g' in tags:
        add(f'{n} graten', [f'{n} graten', f'fırında {n}', f'{n} fırın', f'beşamel soslu {n}', f'kaşarlı {n}'], p * 0.8 + 4, c * 0.8 + 5, f * 0.8 + 8, 'porsiyon', 200, 'ana')
    if 'p' in tags:
        add(f'{n} püresi', [f'{n} püresi', f'{n} püre'], p * 0.9 + 0.6, c * 0.9 + 1, f + 4, 'porsiyon', 150, 'ana')
    if 't' in tags:
        add(f'{n} sote', [f'{n} sote', f'{n} kavurma', f'sotelenmiş {n}', f'{n} sotesi'], p, c + 1, f + 5, 'porsiyon', 150, 'ana')
    if 'u' in tags:
        add(f'{n} turşusu', [f'{n} turşusu', f'{n} turşu'], p * 0.6, c * 0.6, 0.1, 'porsiyon', 50, 'salata')
    if 'd' in tags:
        add(f'{n} dolması', [f'{n} dolması', f'etli {n} dolması', f'kıymalı {n} dolması'], p * 0.4 + 4, c * 0.4 + 8, f * 0.4 + 5, 'adet', 100 if g >= 80 else 40, 'ana', units='porsiyon:300')
        add(f'zeytinyağlı {n} dolması', [f'zeytinyağlı {n} dolması', f'{n} dolması zeytinyağlı'], p * 0.4 + 1.8, c * 0.4 + 14, f * 0.4 + 5, 'adet', 80 if g >= 80 else 35, 'ana', units='porsiyon:250')
    if 'r' in tags:
        add(f'{n} sarması', [f'{n} sarması', f'etli {n} sarması', f'{n} dolması'], 5, 10, 5, 'adet', 30, 'ana', units='porsiyon:250')
        add(f'zeytinyağlı {n} sarması', [f'zeytinyağlı {n} sarması'], 2.5, 18, 6, 'adet', 25, 'ana', units='porsiyon:200')
    if 'm' in tags:
        add(f'{n} mücveri', [f'{n} mücveri', f'{n} köftesi'], p * 0.5 + 5, c * 0.5 + 10, f + 10, 'adet', 50, 'ana')
    add(n, [n, f'çiğ {n}', f'taze {n}'], p, c, f, 'adet' if g < 200 and n not in ('ıspanak', 'roka', 'marul', 'semizotu') else 'porsiyon', g, 'sebze')

# ---------------------------------------------------------------- meyveler
# ad, p, k, y, birim, gram, etiketler (j: suyu, r: reçel, k: komposto, s: smoothie, m: milkshake, y: yoğurt,
# d: dondurma, c: kek, t: tart/pasta, h: cheesecake, x: kurutulmuş, a: tatlısı, f: kefir, o: soda)
FRUIT = [
    ('elma', 0.3, 13.8, 0.2, 'adet', 180, 'jkscdtxao'), ('armut', 0.4, 15, 0.1, 'adet', 180, 'jkxat'), ('muz', 1.1, 22.8, 0.3, 'adet', 120, 'smydctxf'),
    ('portakal', 0.9, 11.8, 0.1, 'adet', 200, 'jrscdato'), ('mandalina', 0.8, 13.3, 0.3, 'adet', 100, 'jrdco'), ('greyfurt', 0.8, 10.7, 0.1, 'adet', 250, 'j'),
    ('limon', 1.1, 6.5, 0.3, 'adet', 60, 'rcdtho'), ('çilek', 0.7, 7.7, 0.3, 'kase', 150, 'jrksmydcthxf'), ('üzüm', 0.7, 18, 0.2, 'salkım', 150, 'jk'),
    ('karpuz', 0.6, 7.6, 0.2, 'dilim', 300, 'jsdo'), ('kavun', 0.8, 8.2, 0.2, 'dilim', 250, 'jsd'), ('şeftali', 0.9, 9.5, 0.3, 'adet', 150, 'jrksmyctxf'),
    ('kayısı', 1.4, 11, 0.4, 'adet', 40, 'jrksycta'), ('kiraz', 1.1, 16, 0.2, 'avuç', 100, 'jrksdct'), ('vişne', 1, 12.2, 0.3, 'avuç', 100, 'rksmydcthxf'),
    ('erik', 0.7, 11.4, 0.3, 'adet', 40, 'rk'), ('incir', 0.8, 19, 0.3, 'adet', 50, 'rsda'), ('nar', 1.7, 18.7, 1.2, 'adet', 250, 'sdo'),
    ('kivi', 1.1, 14.7, 0.5, 'adet', 75, 'jrsdt'), ('ananas', 0.5, 13.1, 0.1, 'dilim', 80, 'jrksmdcthx'), ('mango', 0.8, 15, 0.4, 'adet', 200, 'jsmydthx'),
    ('ayva', 0.4, 15.3, 0.1, 'adet', 250, 'rkx'), ('dut', 1.4, 9.8, 0.4, 'avuç', 60, 'rsdm'), ('böğürtlen', 1.4, 9.6, 0.5, 'avuç', 70, 'rsmydthf'),
    ('ahududu', 1.2, 12, 0.7, 'avuç', 60, 'rsdth'), ('yaban mersini', 0.7, 14.5, 0.3, 'avuç', 70, 'rsmydcthxf'), ('kızılcık', 0.5, 12, 0.1, 'avuç', 60, 'rkx'),
    ('frenk üzümü', 1.4, 15, 0.4, 'avuç', 60, 'r'), ('papaya', 0.5, 11, 0.3, 'dilim', 150, 's'), ('hindistan cevizi', 3.3, 15, 33, 'avuç', 30, 'dc'),
    ('liçi', 0.8, 16.5, 0.4, 'avuç', 80, ''), ('ejder meyvesi', 1.2, 13, 0.4, 'adet', 200, ''), ('marakuya', 2.2, 23, 0.7, 'adet', 30, 'sd'),
    ('guava', 2.6, 14, 1, 'adet', 100, 'j'), ('nektarin', 1.1, 10.6, 0.3, 'adet', 150, ''), ('karadut', 1.4, 9.8, 0.4, 'avuç', 60, 'jrsd'),
    ('alıç', 0.5, 14, 0.4, 'avuç', 50, 'r'), ('kuşburnu', 1.6, 20, 0.3, 'avuç', 30, 'r'), ('gül', 0.5, 15, 0.1, 'yaprak', 2, 'r'),
    ('portakal kabuğu', 1.5, 25, 0.2, 'adet', 10, 'r'), ('balkabağı', 1, 6.5, 0.1, 'dilim', 150, 'ct'), ('havuç', 0.9, 9.6, 0.2, 'adet', 80, 'cr'),
    ('kestane', 3, 53, 2, 'adet', 10, 'dc'), ('hurma', 2.5, 75, 0.4, 'adet', 8, 'smc'), ('avokado', 2, 8.5, 14.7, 'adet', 150, 's'),
]
ICE = (3.5, 24, 11)
for n, p, c, f, u, g, tags in FRUIT:
    L = li(n.split()[-1]) if ' ' not in n else n.split()[0] + ' ' + li(n.split()[-1])
    if 'j' in tags:
        add(f'{n} suyu', [f'{n} suyu', f'taze {n} suyu', f'sıkma {n} suyu', f'{n} nektarı', f'taze sıkılmış {n} suyu'], p * 0.4, c * 0.95, 0.1, 'bardak', 200, 'icecek', units='şişe:1000,kutu:200', hyd=0.85)
    if 'r' in tags:
        add(f'{n} reçeli', [f'{n} reçeli', f'{n} marmelatı', f'{L} reçel'], 0.4, 62, 0.1, 'tatlı kaşığı', 8, 'kahvalti', units='yemek kaşığı:20')
    if 'k' in tags:
        add(f'{n} kompostosu', [f'{n} kompostosu', f'{n} hoşafı', f'{n} kompostu'], p * 0.4, c * 0.6 + 9, 0, 'kase', 200, 'tatli')
    if 's' in tags:
        add(f'{L} smoothie', [f'{L} smoothie', f'{n} smoothie', f'{L} smuti'], p * 0.45 + 1.6, c * 0.45 + 4.6, f * 0.45 + 1.5, 'bardak', 300, 'icecek', hyd=0.8)
    if 'm' in tags:
        add(f'{L} milkshake', [f'{L} milkshake', f'{n} milkshake', f'{L} shake'], p * 0.25 + 2.5, c * 0.25 + 8.4, f * 0.25 + 4.4, 'bardak', 350, 'icecek', hyd=0.75)
    if 'y' in tags:
        add(f'{L} yoğurt', [f'{L} yoğurt', f'{n} yoğurt', f'{L} süzme yoğurt'], 3 + 0.1 * p, 4 + 0.1 * c + 5, 2.8 + 0.1 * f, 'kase', 150, 'kahvalti', units='kutu:150')
    if 'f' in tags:
        add(f'{L} kefir', [f'{L} kefir', f'{n} kefir'], 2.8 + 0.1 * p, 4 + 0.1 * c + 5, 1.8, 'şişe', 250, 'icecek', units='bardak:200', hyd=0.85)
    if 'd' in tags:
        add(f'{L} dondurma', [f'{L} dondurma', f'{n} dondurma', f'{n} dondurması'], ICE[0] * 0.85 + p * 0.15, ICE[1] * 0.85 + c * 0.15, ICE[2] * 0.85 + f * 0.15, 'top', 60, 'tatli', units='külah:90,kase:150')
    if 'c' in tags:
        add(f'{L} kek', [f'{L} kek', f'{n} kek', f'{L} kek dilimi'], 6 * 0.85 + p * 0.15, 52 * 0.85 + c * 0.15, 18 * 0.85 + f * 0.15, 'dilim', 70, 'tatli')
    if 't' in tags:
        add(f'{L} tart', [f'{L} tart', f'{n} tart', f'{L} turta'], 5 * 0.7 + p * 0.3, 40 * 0.7 + c * 0.3, 17 * 0.7 + f * 0.3, 'dilim', 100, 'tatli')
        add(f'{L} pasta', [f'{L} pasta', f'{L} yaş pasta', f'{n} pastası'], 5 * 0.8 + p * 0.2, 38 * 0.8 + c * 0.2, 17 * 0.8 + f * 0.2, 'dilim', 120, 'tatli')
    if 'h' in tags:
        add(f'{L} cheesecake', [f'{L} cheesecake', f'{n} cheesecake'], 6 * 0.85 + p * 0.15, 25 * 0.85 + c * 0.15, 22 * 0.85 + f * 0.15, 'dilim', 120, 'tatli')
    if 'x' in tags:
        add(f'kuru {n}', [f'kuru {n}', f'kurutulmuş {n}', f'{n} kurusu'], p * 4.2, c * 4.2, f * 3, 'avuç', 30, 'kuruyemis')
    if 'a' in tags:
        add(f'{n} tatlısı', [f'{n} tatlısı', f'kaymaklı {n} tatlısı', f'fırında {n} tatlısı'], p * 0.6 + 0.5, c * 0.6 + 25, 1.5, 'adet', 150, 'tatli')
    if 'o' in tags:
        add(f'{L} soda', [f'{L} soda', f'{L} maden suyu', f'{n} aromalı soda'], 0, 6, 0, 'şişe', 200, 'icecek', hyd=0.95)
    if u != 'yaprak':
        add(n, [n, f'taze {n}'], p, c, f, u, g, 'meyve')

# ---------------------------------------------------------------- hamur işleri × iç
# iç: (-lı ad, isim, p, k, y)
FILL = {
    'peynir': ('peynirli', 'peynir', 17, 1.5, 21), 'kasar': ('kaşarlı', 'kaşar', 26, 1.5, 28), 'kiyma': ('kıymalı', 'kıyma', 17, 4, 15),
    'ispanak': ('ıspanaklı', 'ıspanak', 3, 4, 5), 'patates': ('patatesli', 'patates', 2, 15, 4), 'pirasa': ('pırasalı', 'pırasa', 1.5, 10, 4),
    'mantar': ('mantarlı', 'mantar', 3, 3, 4), 'tavuk': ('tavuklu', 'tavuk', 20, 2, 6), 'sucuk': ('sucuklu', 'sucuk', 20, 2, 32),
    'pastirma': ('pastırmalı', 'pastırma', 28, 1, 8), 'kavurma': ('kavurmalı', 'kavurma', 25, 1, 20), 'kusbasi': ('kuşbaşılı', 'kuşbaşı', 22, 3, 12),
    'patlican': ('patlıcanlı', 'patlıcan', 1.2, 6, 8), 'kabak': ('kabaklı', 'kabak', 1.2, 3.5, 4), 'ot': ('otlu', 'ot', 3, 5, 4),
    'lor': ('lorlu', 'lor', 13, 3, 6), 'cokelek': ('çökelekli', 'çökelek', 15, 4, 2.5), 'yumurta': ('yumurtalı', 'yumurta', 12.5, 1, 10),
    'sebze': ('sebzeli', 'sebze', 2, 7, 4), 'ton': ('ton balıklı', 'ton balığı', 24, 0, 10), 'karisik': ('karışık', 'karışık', 23, 1.7, 30),
    'isp-pey': ('ıspanaklı peynirli', 'ıspanak peynir', 10, 2.8, 13), 'kas-man': ('kaşarlı mantarlı', 'kaşar mantar', 14, 2.3, 16),
    'kiy-kas': ('kıymalı kaşarlı', 'kıyma kaşar', 21, 3, 21), 'suc-kas': ('sucuklu kaşarlı', 'sucuk kaşar', 23, 1.7, 30),
    'zeytin': ('zeytinli', 'zeytin', 1.5, 4, 19), 'salam': ('salamlı', 'salam', 14, 3, 20), 'sosis': ('sosisli', 'sosis', 12, 5, 17),
    'nutella': ('nutellalı', 'nutella', 6, 57, 31), 'muz': ('muzlu', 'muz', 1.1, 22.8, 0.3), 'cikolata': ('çikolatalı', 'çikolata', 6, 55, 30),
    'hellim': ('hellimli', 'hellim', 22, 2, 25), 'falafel': ('falafelli', 'falafel', 13, 32, 18), 'kofte': ('köfteli', 'köfte', 17, 6, 18),
    'dereotu': ('dereotlu', 'dereotu', 3.5, 7, 1.1), 'tulum': ('tulum peynirli', 'tulum', 24, 1, 29), 'hindi': ('hindi fümeli', 'hindi füme', 17.5, 3, 1.5),
    'domates': ('domatesli', 'domates', 0.9, 3.9, 0.2), 'biber': ('biberli', 'biber', 0.9, 4.6, 0.2), 'sogan': ('soğanlı', 'soğan', 1.1, 9.3, 4),
    'reçel': ('reçelli', 'reçel', 0.4, 62, 0.1), 'bal': ('ballı', 'bal', 0.3, 82, 0), 'kaymak': ('kaymaklı', 'kaymak', 2.5, 3, 40),
}
# taban: ad, eş adlar, (p, k, y), iç oranı, birim, gram, grup, uygun içler, iyelik ("ıspanak böreği")
BASES = [
    ('su böreği', [], (8, 30, 10), 0.35, 'dilim', 150, 'ekmek', 'peynir kiyma ispanak patates pirasa mantar tavuk kabak isp-pey lor kasar ot', None),
    ('kol böreği', [], (7, 35, 15), 0.35, 'dilim', 120, 'ekmek', 'peynir kiyma ispanak patates pirasa mantar tavuk kabak isp-pey lor otlu patlican', None),
    ('sigara böreği', [], (7, 30, 18), 0.3, 'adet', 35, 'ekmek', 'peynir kiyma ispanak patates pastirma sucuk kasar lor isp-pey tavuk', None),
    ('tepsi böreği', ['börek', 'el açması börek'], (8, 32, 12), 0.35, 'dilim', 120, 'ekmek', 'peynir kiyma ispanak patates pirasa mantar tavuk kabak isp-pey lor kasar ot patlican cokelek sebze', 'böreği'),
    ('rulo börek', [], (7, 33, 14), 0.35, 'dilim', 100, 'ekmek', 'peynir kiyma ispanak patates pirasa tavuk isp-pey', None),
    ('kalem böreği', [], (7, 30, 18), 0.3, 'adet', 30, 'ekmek', 'peynir kiyma patates pastirma', None),
    ('çiğ börek', [], (8, 30, 18), 0.35, 'adet', 120, 'ekmek', 'kiyma peynir patates ispanak', None),
    ('pide', ['açık pide', 'kapalı pide'], (9, 50, 4), 0.4, 'adet', 300, 'fastfood', 'peynir kasar kiyma kusbasi sucuk pastirma kavurma yumurta ispanak mantar tavuk patates kiy-kas suc-kas kas-man ton sebze', 'pidesi'),
    ('gözleme', [], (9, 55, 6), 0.45, 'adet', 250, 'ekmek', 'peynir patates ispanak kiyma mantar kasar isp-pey ot cokelek lor sucuk patlican kabak tulum', 'gözlemesi'),
    ('tost', ['tostu'], (9, 48, 6), 0.35, 'adet', 150, 'fastfood', 'peynir kasar sucuk karisik salam sosis ton tavuk kavurma pastirma kas-man yumurta sebze hindi domates', 'tostu'),
    ('omlet', [], (12.5, 1, 11), 0.3, 'porsiyon', 150, 'kahvalti', 'peynir kasar mantar sucuk ispanak sebze pastirma kavurma patates ot tavuk sosis salam isp-pey domates biber sogan lor tulum', None),
    ('menemen', [], (6, 5, 8), 0.25, 'porsiyon', 200, 'kahvalti', 'peynir kasar sucuk pastirma kavurma mantar sogan sosis', None),
    ('sahanda yumurta', [], (13.6, 0.8, 15), 0.3, 'porsiyon', 150, 'kahvalti', 'kasar peynir pastirma kavurma salam ispanak tulum', None),
    ('krep', [], (6, 25, 7), 0.35, 'adet', 150, 'fastfood', 'tavuk peynir kasar ispanak mantar nutella muz cikolata sebze bal recel', None),
    ('poğaça', [], (7, 45, 17), 0.2, 'adet', 70, 'ekmek', 'patates kiyma ispanak sucuk dereotu lor tulum', None),
    ('açma', [], (7, 47, 20), 0.15, 'adet', 80, 'ekmek', 'peynir zeytin cikolata kasar patates', None),
    ('sandviç', [], (9, 49, 3), 0.4, 'adet', 180, 'fastfood', 'peynir kasar tavuk salam sucuk yumurta sebze kavurma hellim kofte domates', None),
    ('dürüm', [], (8, 50, 4), 0.55, 'adet', 250, 'fastfood', 'kasar sucuk kavurma hellim sebze falafel ton mantar patates kofte pastirma', 'dürüm'),
    ('wrap', [], (8, 50, 4), 0.55, 'adet', 220, 'fastfood', 'kofte sebze ton hellim falafel kavurma mantar hindi', None),
    ('pizza', [], (10, 40, 6), 0.3, 'dilim', 110, 'fastfood', 'mantar tavuk sebze salam sosis kavurma pastirma kiyma suc-kas kas-man peynir', None),
    ('pişi', [], (7, 45, 19), 0.2, 'adet', 60, 'ekmek', 'peynir patates kasar', None),
    ('bazlama', [], (8, 50, 3), 0.35, 'adet', 200, 'ekmek', 'peynir patates kasar ot cokelek', None),
    ('katmer', [], (7, 48, 19), 0.3, 'adet', 150, 'ekmek', 'kasar patates kiyma ispanak', None),
    ('simit', [], (10, 52, 9), 0.2, 'adet', 120, 'ekmek', 'peynir kasar cikolata nutella', None),
    ('waffle', [], (6, 35, 12), 0.4, 'adet', 220, 'tatli', 'muz cikolata nutella bal', None),
    ('pankek', [], (6, 28, 9), 0.25, 'adet', 70, 'kahvalti', 'muz cikolata nutella bal', None),
    ('lavaş', [], (8, 50, 4), 0.3, 'adet', 120, 'ekmek', 'kasar peynir', None),
]
for bname, balias, (bp, bc, bf), r, u, g, grp, fills, poss in BASES:
    for key in fills.split():
        if key not in FILL:
            continue
        lw, noun, fp, fc, ff = FILL[key]
        p, c, f = bp * (1 - r) + fp * r, bc * (1 - r) + fc * r, bf * (1 - r) + ff * r
        als = [f'{lw} {bname}'] + [f'{lw} {a}' for a in balias]
        if poss:
            als.append(f'{noun} {poss}')
        add(f'{lw} {bname}', als, p, c, f, u, g, grp)

# ---------------------------------------------------------------- pilav ve makarna çeşitleri
PILAV_BASE = [('pilav', 'pirinç pilavı', (2.8, 27, 4.2)), ('bulgur pilavı', 'bulgur', (3.5, 19, 3.5))]
PILAV_ADD = [
    ('nohutlu', 1.5, 3, 0.3), ('domatesli', 0, 1, 0), ('sebzeli', 0.3, 1, 0), ('mantarlı', 0.5, -1, 0.3), ('bezelyeli', 1, 1.5, 0),
    ('havuçlu', 0, 1, 0), ('mısırlı', 0.3, 2, 0.2), ('etli', 5, -3, 3), ('tavuklu', 6, -3, 1.5), ('kıymalı', 4, -3, 3.5), ('kuşbaşılı', 5, -3, 3),
    ('arpa şehriyeli', 0.3, 1, 0), ('tel şehriyeli', 0.3, 1, 0), ('kestaneli', 0.3, 4, 0.3), ('safranlı', 0, 0, 0), ('zeytinyağlı', 0, 0, 1),
    ('patlıcanlı', 0, -2, 2), ('ciğerli', 4, -2, 1.5), ('biberli', 0, 0, 0), ('ıspanaklı', 0.5, -2, 0.3), ('mercimekli', 2, 2, 0),
    ('maşlı', 2, 2, 0), ('fıstıklı', 1, 0, 2), ('bademli', 1, 0, 2), ('kuş üzümlü', 0.3, 3, 0.5), ('soğanlı', 0, 1, 0.5),
    ('tereyağlı', 0, 0, 2), ('salçalı', 0.2, 1.5, 0), ('acılı', 0, 0, 0), ('kabaklı', 0.2, -2, 0), ('karidesli', 5, -3, 0.5),
]
for bname, alias, (p, c, f) in PILAV_BASE:
    for w, dp, dc, df in PILAV_ADD:
        add(f'{w} {bname}', [f'{w} {bname}', f'{w} {alias}'], p + dp, c + dc, f + df, 'porsiyon', 180, 'ana', units='tabak:250,kepçe:150')
PILAV_USTU = [('tavuk', (14, 4, 6)), ('et', (25, 1, 20)), ('kavurma', (25, 1, 20)), ('köfte', (17, 6, 18)), ('tavuk sote', (14, 4, 6)),
              ('türlü', (2, 7, 4)), ('fasulye', (6, 12, 4.5)), ('etli nohut', (7, 15, 5)), ('kuru', (6, 12, 4.5)), ('tas kebabı', (13, 5, 9)),
              ('et sote', (15, 4, 9)), ('ciğer', (20, 6, 9)), ('tavuk döner', (17, 5, 9)), ('kuşbaşı', (22, 3, 12))]
for n, (p, c, f) in PILAV_USTU:
    add(f'pilav üstü {n}', [f'pilav üstü {n}', f'pilav üstü {n} porsiyon', f'{n} pilav'], 2.8 * 0.55 + p * 0.45, 27 * 0.55 + c * 0.45, 4.2 * 0.55 + f * 0.45, 'porsiyon', 350, 'ana', units='tabak:400')

PASTA = [('makarna', (5.8, 31, 0.9)), ('spagetti', (5.8, 31, 0.9)), ('penne', (5.8, 31, 0.9)), ('fusilli', (5.8, 31, 0.9)),
         ('erişte', (5.5, 25, 2)), ('tam buğday makarna', (5.3, 27, 1.1)), ('burgu makarna', (5.8, 31, 0.9)), ('kelebek makarna', (5.8, 31, 0.9)),
         ('tagliatelle', (5.8, 31, 1.5)), ('linguine', (5.8, 31, 0.9))]
SAUCE = [('domates soslu', 1.5, 7, 4, 0.35), ('kıymalı', 12, 5, 12, 0.35), ('kremalı', 2, 3, 25, 0.25), ('mantarlı', 2.5, 3, 10, 0.3),
         ('tavuklu', 15, 3, 6, 0.35), ('peynirli', 20, 2, 22, 0.2), ('pesto soslu', 5, 6, 43, 0.12), ('sebzeli', 1.5, 6, 5, 0.35),
         ('ton balıklı', 20, 2, 10, 0.3), ('yoğurtlu', 3, 4.5, 5, 0.35), ('tereyağlı', 0.8, 0.1, 81, 0.05), ('sarımsaklı', 0.5, 2, 50, 0.06),
         ('zeytinyağlı', 0, 0, 100, 0.04), ('karidesli', 15, 2, 6, 0.35), ('sucuklu', 18, 2, 30, 0.15), ('kaşarlı', 26, 1.5, 28, 0.15),
         ('mantarlı kremalı', 2, 3, 18, 0.3), ('ıspanaklı', 3, 4, 8, 0.3), ('patlıcanlı', 1.2, 6, 8, 0.35), ('acılı domates soslu', 1.5, 7, 4, 0.35),
         ('salçalı', 2, 10, 4, 0.2), ('bolonez soslu', 12, 5, 12, 0.35), ('beşamel soslu', 4, 8, 9, 0.35), ('fesleğenli', 1.5, 6, 6, 0.3),
         ('somonlu', 18, 2, 14, 0.3), ('brokolili', 3, 5, 6, 0.3), ('cevizli', 6, 5, 45, 0.1), ('limonlu', 0.5, 2, 30, 0.08)]
for bname, (bp, bc, bf) in PASTA:
    for w, sp, sc, sf, r in SAUCE:
        add(f'{w} {bname}', [f'{w} {bname}'], bp * (1 - r) + sp * r, bc * (1 - r) + sc * r, bf * (1 - r) + sf * r, 'porsiyon', 300, 'ana', units='tabak:350')
for w, p, c, f in [('kaşarlı fırın makarna', 9, 22, 9), ('beşamel soslu fırın makarna', 7, 20, 8), ('kıymalı fırın makarna', 9, 20, 9),
                   ('tavuklu fırın makarna', 10, 20, 7), ('sebzeli fırın makarna', 6, 21, 7), ('fırın erişte', 7, 22, 8), ('fırın şehriye', 6, 25, 6)]:
    add(w, [w], p, c, f, 'porsiyon', 250, 'ana')

# ---------------------------------------------------------------- et/tavuk × sebze ev yemekleri
PROT = [('tavuk', (25, 0, 6)), ('et', (27, 0, 11)), ('kuzu', (25, 0, 17)), ('köfte', (17, 6, 18)), ('hindi', (28, 0, 3)),
        ('tavuk but', (24, 0, 9)), ('dana', (27, 0, 11)), ('kuşbaşı', (27, 0, 11))]
SIDE = [('patatesli', (2, 17, 0.1)), ('mantarlı', (3.1, 3.3, 0.3)), ('biberli', (0.9, 4.6, 0.2)), ('bezelyeli', (5.4, 14.5, 0.4)),
        ('nohutlu', (8.9, 27, 2.6)), ('patlıcanlı', (1, 5.9, 0.2)), ('brokolili', (2.8, 6.6, 0.4)), ('kabaklı', (1.2, 3.1, 0.3)),
        ('havuçlu', (0.9, 9.6, 0.2)), ('sebzeli', (1.5, 6, 0.3)), ('domatesli', (0.9, 3.9, 0.2)), ('soğanlı', (1.1, 9.3, 0.1)),
        ('ıspanaklı', (2.9, 3.6, 0.4)), ('enginarlı', (3.3, 10.5, 0.2)), ('bamyalı', (1.9, 7.5, 0.2)), ('fasulyeli', (1.8, 7, 0.2)),
        ('pırasalı', (1.5, 14, 0.3)), ('kerevizli', (1.5, 9.2, 0.3)), ('karnabaharlı', (1.9, 5, 0.3)), ('ayvalı', (0.4, 15.3, 0.1)),
        ('erikli', (0.7, 11.4, 0.3)), ('kestaneli', (3, 53, 2)), ('yoğurtlu', (3.5, 4.7, 3.3)), ('kremalı', (2, 3, 25)),
        ('sarımsaklı', (1, 3, 0)), ('limonlu', (0.5, 3, 0)), ('ballı hardallı', (1, 30, 2)), ('barbekü soslu', (0.8, 30, 0.5)),
        ('teriyaki soslu', (3, 20, 0.1)), ('köri soslu', (1, 6, 6)), ('fesleğenli', (1, 2, 0)), ('kekikli', (1, 2, 0)),
        ('acılı', (1, 6, 0.5)), ('susamlı', (6, 8, 15)), ('fıstıklı', (10, 10, 30)), ('bademli', (10, 10, 30)), ('portakallı', (0.9, 11.8, 0.1)),
        ('kabak çiçekli', (1, 3.3, 0.1)), ('mısırlı', (3.3, 19, 1.4)), ('taze soğanlı', (1.8, 7, 0.2))]
SAUCY = {'yoğurtlu': 0.3, 'kremalı': 0.2, 'sarımsaklı': 0.05, 'limonlu': 0.05, 'ballı hardallı': 0.1, 'barbekü soslu': 0.12,
         'teriyaki soslu': 0.12, 'köri soslu': 0.25, 'fesleğenli': 0.03, 'kekikli': 0.03, 'acılı': 0.08, 'susamlı': 0.05,
         'fıstıklı': 0.08, 'bademli': 0.08, 'portakallı': 0.1}
for pn, (pp, pc, pf) in PROT:
    for sn, (sp, sc, sf) in SIDE:
        r = SAUCY.get(sn, 0.45)
        p, c, f = pp * (1 - r) + sp * r, pc * (1 - r) + sc * r, pf * (1 - r) + sf * r + 3.5
        add(f'{sn} {pn}', [f'{sn} {pn}', f'{sn} {pn} yemeği', f'fırında {sn} {pn}', f'{sn} {pn} sote'], p, c, f, 'porsiyon', 250, 'ana', units='tabak:300')

# ---------------------------------------------------------------- daha fazla ev yemeği
VEGD = {n: (p, c, f) for n, p, c, f, _, _ in VEG}
for v in ['patlıcan', 'ıspanak', 'havuç', 'pancar', 'pazı', 'mantar', 'kereviz', 'brokoli', 'karnabahar', 'bezelye', 'kuşkonmaz',
          'taze fasulye', 'pırasa', 'patates', 'börülce', 'ebegümeci', 'semizotu', 'kabak', 'roka', 'salatalık']:
    p, c, f = VEGD[v]
    add(f'yoğurtlu {v}', [f'yoğurtlu {v}', f'{v} yoğurtlu', f'sarımsaklı yoğurtlu {v}'], p * 0.5 + 1.8, c * 0.5 + 2.4, f * 0.5 + 4, 'porsiyon', 150, 'salata')
for w, (fp, fc, ff) in [('mantarlı', (3, 3, 4)), ('domatesli', (0.9, 3.9, 3)), ('biberli', (0.9, 4.6, 3)), ('soğanlı', (1.1, 9.3, 4)),
                        ('kıymalı', (17, 4, 15)), ('salamlı', (14, 3, 20)), ('kaşarlı', (26, 1.5, 28)), ('otlu', (3, 5, 4)),
                        ('pırasalı', (1.5, 10, 4)), ('kabaklı', (1.2, 3.5, 4)), ('patlıcanlı', (1.2, 6, 8)), ('tavuklu', (20, 2, 6)),
                        ('peynirli domatesli', (9, 3, 11)), ('sucuklu kaşarlı', (23, 1.7, 30)), ('lorlu', (13, 3, 6)), ('avokadolu', (2, 8.5, 14.7))]:
    add(f'{w} yumurta', [f'{w} yumurta', f'{w} yumurta kavurma', f'yumurtalı {w.split()[0]}'], 12.5 * 0.65 + fp * 0.35, 1 * 0.65 + fc * 0.35, 11 * 0.65 + ff * 0.35 + 2, 'porsiyon', 150, 'kahvalti')
for n, p, c, f in [('tavuklu mantı', 9, 22, 6), ('patatesli mantı', 6, 26, 6), ('ıspanaklı mantı', 6, 22, 6), ('peynirli mantı', 8, 22, 7),
                   ('kızarmış mantı', 8, 30, 14), ('çıtır mantı', 8, 30, 14), ('sulu mantı', 6, 15, 5), ('tereyağlı mantı', 7, 22, 9),
                   ('sinop mantısı', 9, 26, 9), ('tatar böreği', 9, 26, 9), ('nohutlu mantı', 8, 24, 6), ('kuru mantı', 8, 30, 8)]:
    add(n, [n], p, c, f, 'porsiyon', 300, 'ana', units='tabak:300')
for n, p, c, f in [('muzlu yulaf', 4, 18, 3), ('çilekli yulaf', 4, 15, 3), ('fıstık ezmeli yulaf', 7, 16, 7), ('kakaolu yulaf', 4.5, 17, 3.5),
                   ('ballı yulaf', 4, 19, 3), ('tarçınlı elmalı yulaf', 3.5, 17, 2.5), ('yoğurtlu yulaf', 5, 13, 3), ('protein yulaf', 9, 15, 3),
                   ('yaban mersinli yulaf', 4, 16, 3), ('chia tohumlu yulaf', 5, 15, 5), ('sulu yulaf', 2.5, 12, 1.4), ('cevizli yulaf', 5, 15, 6)]:
    add(n, [n, n.replace('yulaf', 'yulaf lapası'), n.replace('yulaf', 'yulaf ezmesi')], p, c, f, 'kase', 250, 'kahvalti')
for prot, (pp, pc, pf) in [('tavuklu', (25, 0, 6)), ('somonlu', (22, 0, 12)), ('ton balıklı', (25, 0, 8)), ('köfteli', (17, 6, 18)), ('hindili', (28, 0, 3)), ('karidesli', (24, 0, 2))]:
    for base, (bp, bc, bf) in [('kinoa', (4.4, 21, 1.9)), ('pirinç', (2.7, 28, 0.3)), ('bulgur', (3.1, 19, 0.2)), ('tatlı patates', (1.6, 20, 0.1))]:
        add(f'{prot} {base}', [f'{prot} {base}', f'{prot} {base} kasesi', f'{prot} {base} bowl'], pp * 0.4 + bp * 0.45 + 0.3, pc * 0.4 + bc * 0.45 + 1, pf * 0.4 + bf * 0.45 + 2, 'kase', 350, 'ana')
for n, p, c, f in [('çikolatalı sütlaç', 3.5, 22, 4), ('tarçınlı sütlaç', 3, 20, 3.5), ('fındıklı sütlaç', 4, 20, 5.5), ('muzlu sütlaç', 3, 22, 3.5),
                   ('hindistan cevizli sütlaç', 3, 21, 6), ('karamelli sütlaç', 3, 23, 3.5), ('vanilyalı sütlaç', 3, 20, 3.5), ('dondurmalı sütlaç', 3.3, 22, 6),
                   ('kaymaklı sütlaç', 3.3, 20, 6), ('fıstıklı sütlaç', 4, 20, 5.5)]:
    add(n, [n], p, c, f, 'kase', 180, 'tatli')
for n, p, c, f in [('kaşarlı burger', 14, 18, 15), ('mantarlı burger', 12, 18, 13), ('barbekü burger', 12, 22, 13), ('acılı burger', 12, 19, 13),
                   ('vegan burger', 7, 25, 9), ('kuzu burger', 13, 18, 16), ('ev yapımı burger', 13, 19, 13), ('ızgara köfte burger', 13, 19, 13),
                   ('yumurtalı burger', 13, 18, 14), ('füme etli burger', 14, 18, 15), ('kuşbaşı burger', 14, 19, 12), ('somon burger', 13, 20, 10)]:
    add(n, [n], p, c, f, 'adet', 230, 'fastfood')
for n, p, c, f in [('kaşarlı kumpir', 7, 18, 8), ('sosisli kumpir', 5, 19, 8), ('mısırlı kumpir', 4, 21, 6), ('rus salatalı kumpir', 4, 18, 9),
                   ('zeytinli kumpir', 4, 18, 7), ('tavuklu kumpir', 7, 18, 6), ('peynirli kumpir', 6, 18, 8), ('sucuklu kumpir', 6, 18, 10)]:
    add(n, [n], p, c, f, 'adet', 450, 'fastfood')
for n, p, c, f in [('peynirli patates kızartması', 6, 30, 16), ('soslu patates kızartması', 3, 33, 14), ('trüflü patates', 3.5, 33, 16),
                   ('kaşarlı patates kızartması', 7, 30, 17), ('acılı patates kızartması', 3.5, 34, 14), ('fırında patates kızartması', 3, 30, 6)]:
    add(n, [n], p, c, f, 'porsiyon', 150, 'fastfood')

# ---------------------------------------------------------------- tek tek yazılmış yemekler
# (ad, eş adlar, p, k, y, birim, gram, grup)
LIST = [
    # çorbalar
    ('yeşil mercimek çorbası', 'yeşil mercimekli çorba', 4, 9, 2, 'kase', 250, 'corba'), ('nohut çorbası', 'nohutlu çorba', 4, 9, 2.5, 'kase', 250, 'corba'),
    ('kuru fasulye çorbası', 'fasulye çorbası', 4, 9, 2, 'kase', 250, 'corba'), ('barbunya çorbası', '', 4, 9, 2, 'kase', 250, 'corba'),
    ('maş fasulyesi çorbası', 'maş çorbası', 4, 8, 2, 'kase', 250, 'corba'), ('yarma çorbası', 'dövme çorbası|buğday çorbası', 3, 9, 2.5, 'kase', 250, 'corba'),
    ('arpa çorbası', '', 2, 9, 2, 'kase', 250, 'corba'), ('pirinç çorbası', 'pirinçli çorba', 2, 9, 2, 'kase', 250, 'corba'),
    ('bulgur çorbası', 'bulgurlu çorba', 2.2, 9, 2, 'kase', 250, 'corba'), ('yulaf çorbası', 'yulaflı çorba', 2.5, 8, 2.5, 'kase', 250, 'corba'),
    ('kinoa çorbası', '', 2.5, 8, 2, 'kase', 250, 'corba'), ('ayran aşı', 'ayran aşı çorbası|ayran çorbası', 3.5, 6, 3, 'kase', 250, 'corba'),
    ('yoğurtlu çorba', 'yoğurtlu pirinç çorbası', 3.5, 6, 3, 'kase', 250, 'corba'), ('ekşi aşı', 'ekşili çorba', 3, 7, 2.5, 'kase', 250, 'corba'),
    ('kuzu çorbası', 'kuzu etli çorba|kuzu incik çorbası', 5, 4, 3.5, 'kase', 250, 'corba'), ('et suyu çorbası', 'etli çorba|dana etli çorba', 5, 4, 3.5, 'kase', 250, 'corba'),
    ('tavuklu pirinç çorbası', 'tavuk pirinç çorbası', 4.5, 5, 2.2, 'kase', 250, 'corba'), ('tavuklu sebze çorbası', 'sebzeli tavuk çorbası', 4.5, 4.5, 2.2, 'kase', 250, 'corba'),
    ('tavuklu erişte çorbası', 'tavuk erişte çorbası', 4.5, 6, 2.2, 'kase', 250, 'corba'), ('tavuklu mantar çorbası', '', 4.5, 3.5, 3, 'kase', 250, 'corba'),
    ('karides çorbası', '', 6, 3, 2, 'kase', 250, 'corba'), ('midye çorbası', '', 5, 4, 2.5, 'kase', 250, 'corba'),
    ('deniz mahsulleri çorbası', 'deniz ürünleri çorbası', 6, 3, 2.5, 'kase', 250, 'corba'), ('ciğer çorbası', '', 6, 4, 3, 'kase', 250, 'corba'),
    ('şifa çorbası', 'sebzeli şifa çorbası', 2, 6, 2, 'kase', 250, 'corba'), ('gazpacho', 'soğuk domates çorbası', 1, 5, 3, 'kase', 250, 'corba'),
    ('borş', 'borş çorbası|borsch|pancar çorbası rus', 2, 6, 2.5, 'kase', 300, 'corba'), ('tom yum', 'tom yum çorbası|tom kha', 3, 4, 3, 'kase', 300, 'corba'),
    ('harira', 'harira çorbası|fas çorbası', 4, 9, 2, 'kase', 300, 'corba'), ('sebzeli şehriye çorbası', '', 2, 8, 2, 'kase', 250, 'corba'),
    ('domatesli şehriye çorbası', 'domatesli tel şehriye', 2, 8, 2, 'kase', 250, 'corba'), ('domatesli bulgur çorbası', '', 2.2, 9, 2, 'kase', 250, 'corba'),
    ('arabaşı çorbası', 'arabaşı', 4, 7, 3, 'kase', 300, 'corba'), ('malhıta çorbası', 'malhıta', 4, 9, 2.5, 'kase', 250, 'corba'),
    ('peskütan çorbası', 'peskütan', 4, 6, 3, 'kase', 250, 'corba'), ('gendime çorbası', '', 3, 9, 2.5, 'kase', 250, 'corba'),
    ('bamya çorbası', 'etli bamya çorbası', 3.5, 5, 3, 'kase', 250, 'corba'), ('çiriş çorbası', '', 2, 5, 2.5, 'kase', 250, 'corba'),
    ('sütlü mısır çorbası', 'kremalı mısır çorbası sütlü', 2.5, 10, 3, 'kase', 250, 'corba'), ('kremalı sebze çorbası', '', 2, 6, 4.5, 'kase', 250, 'corba'),
    ('kelle çorbası', '', 7, 3, 5, 'kase', 300, 'corba'), ('şehriyeli yayla çorbası', '', 3.5, 7, 3, 'kase', 250, 'corba'),
    ('mercimekli bulgur çorbası', '', 4, 10, 2, 'kase', 250, 'corba'), ('acılı mercimek çorbası', 'acılı çorba', 4, 9, 2.5, 'kase', 250, 'corba'),
    ('zencefilli havuç çorbası', '', 1, 6, 2.5, 'kase', 250, 'corba'), ('kabak çiçeği çorbası', '', 1.5, 5, 2.5, 'kase', 250, 'corba'),
    ('köz biber çorbası', 'közlenmiş biber çorbası', 1.5, 6, 3, 'kase', 250, 'corba'), ('köz patlıcan çorbası', '', 1.5, 5, 3, 'kase', 250, 'corba'),
    ('tavuk kremalı çorba', 'kremalı tavuk suyu çorbası', 4, 5, 4, 'kase', 250, 'corba'), ('sarımsaklı ekmek çorbası', 'ekmek çorbası', 3, 10, 3, 'kase', 250, 'corba'),
    ('peynirli çorba', 'cheddar çorbası|peynir çorbası', 5, 6, 7, 'kase', 250, 'corba'), ('soya fasulyesi çorbası', '', 5, 5, 3, 'kase', 250, 'corba'),
    ('kestane çorbası', '', 2, 12, 3, 'kase', 250, 'corba'), ('lahana turşusu çorbası', 'turşu çorbası', 1.5, 4, 2, 'kase', 250, 'corba'),
    # köfteler
    ('cızbız köfte', 'cızbız', 17, 5, 18, 'porsiyon', 180, 'et'), ('hasanpaşa köfte', 'hasanpaşa köftesi', 11, 12, 12, 'porsiyon', 250, 'ana'),
    ('patatesli köfte', 'köfteli patates', 12, 10, 12, 'porsiyon', 250, 'ana'), ('ıslama köfte', 'ıslama köfte ekmek|ıslama', 12, 25, 10, 'porsiyon', 300, 'fastfood'),
    ('sivas köftesi', 'sivas köfte', 16, 6, 17, 'porsiyon', 180, 'et'), ('tire köfte', 'tire köftesi', 14, 15, 14, 'porsiyon', 300, 'ana'),
    ('şehzade köfte', 'şehzade köftesi', 13, 10, 13, 'porsiyon', 250, 'ana'), ('misket köfte', 'mini köfte|misket köftesi', 17, 6, 18, 'porsiyon', 150, 'et'),
    ('sebzeli köfte', 'köfteli sebze', 10, 7, 9, 'porsiyon', 250, 'ana'), ('yoğurtlu köfte', 'yoğurtlu köfte yemeği', 12, 6, 12, 'porsiyon', 250, 'ana'),
    ('domates soslu köfte', 'soslu köfte|salçalı köfte', 13, 6, 14, 'porsiyon', 250, 'ana'), ('kaşarlı köfte', 'kaşarlı ızgara köfte|peynirli köfte', 19, 4, 21, 'porsiyon', 180, 'et'),
    ('nohut köftesi', 'nohut köfte', 7, 25, 8, 'adet', 30, 'ana'), ('patates köftesi', 'patates köfte', 4, 20, 8, 'adet', 40, 'ana'),
    ('bulgur köftesi', 'bulgurlu köfte|ekşili bulgur köftesi', 4, 25, 5, 'adet', 30, 'ana'), ('ıspanaklı köfte', '', 12, 6, 12, 'porsiyon', 180, 'ana'),
    ('karnıyarık köfte', 'köfteli karnıyarık', 10, 6, 12, 'porsiyon', 250, 'ana'), ('ekmek köfte', 'ekmek köftesi', 13, 15, 12, 'adet', 40, 'ana'),
    ('kuru köfte', 'kızarmış köfte|tava köfte', 16, 10, 18, 'adet', 30, 'et'), ('fellah köftesi', 'fellah', 5, 30, 6, 'porsiyon', 200, 'ana'),
    ('içli köfte haşlama', 'haşlama içli köfte', 10, 22, 7, 'adet', 70, 'ana'), ('kızarmış içli köfte', 'içli köfte kızartma', 10, 22, 14, 'adet', 70, 'ana'),
    ('mercimekli köfte', '', 5, 22, 5, 'adet', 30, 'ana'), ('kabak köftesi', '', 5, 12, 10, 'adet', 50, 'ana'),
    ('kuzu şiş köfte', 'kuzu köfte şiş', 16, 3, 20, 'şiş', 80, 'et'), ('tavuk şiş köfte', 'tavuk köfte şiş', 18, 4, 9, 'şiş', 80, 'et'),
    # kebaplar
    ('simit kebabı', 'simit kebap', 16, 5, 18, 'porsiyon', 250, 'et'), ('fıstıklı kebap', 'fıstıklı kebabı|antep fıstıklı kebap', 16, 4, 22, 'porsiyon', 250, 'et'),
    ('keme kebabı', 'keme kebap', 14, 6, 16, 'porsiyon', 250, 'et'), ('soğan kebabı', 'soğanlı kebap|soğan kebap', 12, 8, 14, 'porsiyon', 250, 'et'),
    ('erik kebabı', 'erikli kebap', 13, 8, 15, 'porsiyon', 250, 'et'), ('kiraz kebabı', 'kirazlı kebap', 13, 9, 14, 'porsiyon', 250, 'et'),
    ('domatesli kebap', 'domates kebabı', 14, 5, 15, 'porsiyon', 250, 'et'), ('sarımsaklı kebap', '', 15, 4, 17, 'porsiyon', 250, 'et'),
    ('haşhaşlı kebap', '', 15, 4, 18, 'porsiyon', 250, 'et'), ('yaprak kebabı', 'yaprak kebap', 15, 4, 16, 'porsiyon', 250, 'et'),
    ('kuyu kebabı', 'kuyu kebap', 24, 0, 16, 'porsiyon', 200, 'et'), ('kuzu çevirme', 'çevirme kuzu', 24, 0, 18, 'porsiyon', 200, 'et'),
    ('odun kebabı', 'odun kebap', 23, 0, 17, 'porsiyon', 200, 'et'), ('kağıt kebabı', 'kağıt kebap', 14, 4, 10, 'porsiyon', 300, 'et'),
    ('tokat kebabı', 'tokat kebap', 12, 6, 10, 'porsiyon', 400, 'et'), ('çömlek kebabı', 'çömlek kebap', 12, 5, 8, 'porsiyon', 300, 'ana'),
    ('kanat şiş', 'tavuk kanat şiş', 18, 1, 14, 'şiş', 120, 'et'), ('dana şiş', 'dana şiş kebap|bonfile şiş', 22, 1, 12, 'şiş', 100, 'et'),
    ('acılı kebap', 'acılı adana', 15, 4, 18, 'porsiyon', 250, 'et'), ('eli böğründe', 'eli böğründe kebabı', 12, 6, 12, 'porsiyon', 300, 'ana'),
    ('konya fırın kebabı', 'fırın kebabı', 24, 0, 17, 'porsiyon', 200, 'et'), ('elbasan tava', 'tava elbasan', 12, 5, 10, 'porsiyon', 300, 'ana'),
    ('şehzade kebabı', '', 15, 6, 13, 'porsiyon', 300, 'et'), ('ali paşa kebabı', 'alipaşa', 15, 8, 14, 'porsiyon', 300, 'et'),
    ('tavuk çökertme', 'çökertme tavuk', 14, 14, 11, 'porsiyon', 300, 'ana'), ('ciğer kebabı', 'ciğer kebap', 20, 4, 10, 'porsiyon', 200, 'et'),
    ('kuzu şiş kebap', 'kuzu kebap', 19, 1, 16, 'porsiyon', 200, 'et'), ('patlıcanlı köfte kebabı', '', 11, 6, 14, 'porsiyon', 300, 'et'),
    ('meyhane kebabı', '', 14, 5, 14, 'porsiyon', 300, 'et'), ('islim kebabı', 'islim kebap', 11, 6, 13, 'porsiyon', 300, 'ana'),
    ('hünkari kebap', 'hünkari', 12, 7, 12, 'porsiyon', 350, 'ana'), ('tandır kebabı dana', 'dana tandır', 26, 0, 14, 'porsiyon', 200, 'et'),
    # ev ve yöresel yemekler
    ('çerkez tavuğu', 'çerkes tavuğu|cevizli tavuk', 20, 5, 15, 'porsiyon', 200, 'ana'), ('kayseri yağlaması', 'yağlama', 10, 22, 10, 'porsiyon', 300, 'ana'),
    ('cantık', 'bursa cantık', 11, 30, 11, 'adet', 150, 'ekmek'), ('ankara tava', '', 9, 20, 7, 'porsiyon', 300, 'ana'),
    ('aksaray tava', '', 10, 18, 8, 'porsiyon', 300, 'ana'), ('şiveydiz', 'yoğurtlu et yemeği', 9, 5, 7, 'porsiyon', 300, 'ana'),
    ('meftune', 'meftune yemeği', 9, 6, 9, 'porsiyon', 300, 'ana'), ('madımak yemeği', 'madımak kavurma', 5, 6, 6, 'porsiyon', 250, 'ana'),
    ('keledoş', '', 6, 12, 4, 'porsiyon', 300, 'ana'), ('murtuğa', 'murtuga', 8, 40, 20, 'porsiyon', 150, 'kahvalti'),
    ('pepeçura', 'pepecura', 1, 28, 0.5, 'kase', 200, 'tatli'), ('kara lahana diblesi', 'dible|fasulye diblesi|pirinç diblesi', 3, 10, 4, 'porsiyon', 250, 'ana'),
    ('turşu kavurması', 'fasulye turşusu kavurması|turşu kavurma', 2, 6, 6, 'porsiyon', 200, 'ana'), ('ot kavurma', 'otlu kavurma|yabani ot kavurma', 3, 5, 6, 'porsiyon', 150, 'ana'),
    ('şıllık tatlısı', 'şıllık', 6, 40, 15, 'adet', 120, 'tatli'), ('kerebiç', 'kerebiç tatlısı', 6, 60, 20, 'adet', 40, 'tatli'),
    ('maamul', 'mamul|kombe|kombe kurabiyesi', 6, 60, 22, 'adet', 40, 'tatli'), ('haytalı', 'haytalı tatlısı', 2, 22, 2, 'kase', 200, 'tatli'),
    ('kaytaz böreği', 'kaytaz', 9, 30, 13, 'adet', 120, 'ekmek'), ('batırık', 'batırık salatası', 5, 20, 8, 'porsiyon', 200, 'salata'),
    ('zahter salatası', 'antakya salatası|zahter', 2, 6, 8, 'porsiyon', 150, 'salata'), ('öcce', 'öcce mücver', 5, 12, 10, 'adet', 50, 'ana'),
    ('mırra', 'mırra kahvesi|acı kahve', 0.2, 0, 0, 'fincan', 40, 'icecek'), ('cağ kebabı dürüm', 'cağ dürüm', 14, 20, 12, 'adet', 250, 'fastfood'),
    ('herle', 'herle çorbası', 2, 10, 2, 'kase', 250, 'corba'), ('ekşili pilav', '', 3, 25, 5, 'porsiyon', 180, 'ana'),
    ('kesme makarna', 'ev makarnası|kesme makarnası', 6, 30, 5, 'porsiyon', 250, 'ana'), ('hangel', 'hangel yemeği', 8, 28, 9, 'porsiyon', 250, 'ana'),
    ('lor dolması', '', 10, 15, 8, 'adet', 80, 'ana'), ('mutancana', 'mutancana yemeği', 12, 12, 9, 'porsiyon', 250, 'ana'),
    ('paşa böreği', 'paşa böreği tepsi', 10, 28, 14, 'dilim', 150, 'ekmek'), ('paşa pilavı', '', 6, 25, 7, 'porsiyon', 200, 'ana'),
    ('hünkar pilavı', '', 5, 26, 7, 'porsiyon', 200, 'ana'), ('edirne ciğeri', 'edirne tava ciğer', 20, 10, 14, 'porsiyon', 150, 'et'),
    ('arnavut ciğeri meze', 'soğuk arnavut ciğeri', 18, 10, 10, 'porsiyon', 150, 'salata'), ('çiroz', 'çiroz salatası', 25, 1, 8, 'porsiyon', 80, 'salata'),
    ('midye pilaki', '', 9, 10, 6, 'porsiyon', 150, 'salata'), ('levrek marin', 'marine levrek|balık marin', 18, 1, 8, 'porsiyon', 100, 'salata'),
    ('girit ezmesi', 'girit', 8, 4, 22, 'porsiyon', 80, 'salata'), ('patlıcan söğürme', 'söğürme', 2, 7, 6, 'porsiyon', 150, 'salata'),
    ('yoğurtlu kereviz', 'kereviz meze', 3, 6, 6, 'porsiyon', 120, 'salata'), ('pancar tarator', 'pancarlı tarator', 3, 8, 6, 'porsiyon', 120, 'salata'),
    ('acılı havuç', 'acılı havuç salatası', 1, 8, 6, 'porsiyon', 120, 'salata'), ('kavurmalı humus', 'humus kavurmalı|pastırmalı humus', 10, 12, 14, 'porsiyon', 150, 'salata'),
    ('tavuk salatası', 'mayonezli tavuk salatası', 12, 4, 12, 'porsiyon', 200, 'salata'), ('kuskus salatası', '', 4, 18, 5, 'porsiyon', 200, 'salata'),
    ('nar ekşili salata', 'nar ekşili çoban', 1, 7, 5, 'porsiyon', 200, 'salata'), ('mısırlı salata', 'mısır salatası', 2, 10, 5, 'porsiyon', 200, 'salata'),
    ('yumurta salatası', 'yumurtalı salata', 8, 3, 10, 'porsiyon', 200, 'salata'), ('hellimli salata', 'ızgara hellim salatası', 9, 4, 11, 'porsiyon', 250, 'salata'),
    ('avokado salatası', 'avokadolu salata', 2, 6, 12, 'porsiyon', 200, 'salata'), ('meksika salatası', '', 5, 12, 6, 'porsiyon', 250, 'salata'),
    ('waldorf salatası', 'waldorf', 3, 9, 14, 'porsiyon', 200, 'salata'), ('caprese', 'caprese salata|domates mozzarella', 9, 4, 12, 'porsiyon', 200, 'salata'),
    ('şef salata', 'chef salata', 10, 4, 9, 'porsiyon', 300, 'salata'), ('nicoise salata', 'niçoise', 9, 6, 8, 'porsiyon', 300, 'salata'),
    ('somonlu salata', 'füme somonlu salata', 9, 3, 9, 'porsiyon', 250, 'salata'), ('karidesli salata', '', 9, 4, 6, 'porsiyon', 250, 'salata'),
    ('kinoalı tavuk salatası', '', 11, 10, 6, 'porsiyon', 300, 'salata'), ('yeşil fasulye salatası', 'fasulye salatası taze', 2, 6, 5, 'porsiyon', 150, 'salata'),
    ('beyin salatası', '', 10, 2, 12, 'porsiyon', 100, 'salata'), ('ıspanak kökü salatası', 'ıspanak kökü', 2, 4, 5, 'porsiyon', 120, 'salata'),
    ('köz patlıcan ezmesi', 'patlıcan ezme', 1.5, 6, 6, 'porsiyon', 120, 'salata'), ('kısır bulgur salatası', '', 4, 25, 5, 'porsiyon', 150, 'salata'),
    ('soslu patates', 'patates salata soslu', 2, 16, 7, 'porsiyon', 200, 'ana'), ('patates oturtması', '', 6, 12, 7.5, 'porsiyon', 250, 'ana'),
    ('kıymalı ıspanak yemeği', '', 6, 5, 5, 'porsiyon', 250, 'ana'), ('yoğurtlu kabak', 'kabak yoğurtlu meze', 3, 5, 5, 'porsiyon', 150, 'salata'),
    ('yoğurtlu ıspanak', '', 4, 4, 5, 'porsiyon', 150, 'salata'), ('yoğurtlu pancar', 'pancar yoğurtlu', 3, 7, 4, 'porsiyon', 150, 'salata'),
    ('yoğurtlu havuç', 'havuçlu yoğurt', 3, 7, 6, 'porsiyon', 150, 'salata'), ('tavuklu güveç sebzeli', '', 11, 5, 6, 'porsiyon', 300, 'ana'),
    ('sebze güveç', 'zeytinyağlı güveç|sebzeli güveç', 2, 8, 5, 'porsiyon', 300, 'ana'), ('karışık kızartma tabağı', 'kızartma tabağı', 2, 10, 13, 'porsiyon', 250, 'ana'),
    ('patates mücver', 'patates mücveri', 5, 18, 9, 'adet', 50, 'ana'), ('çılbır yumurta', '', 9, 4, 14, 'porsiyon', 200, 'kahvalti'),
    ('ekmek kızartması', 'yumurtalı ekmek kızartması', 9, 30, 12, 'dilim', 60, 'kahvalti'), ('peynirli yumurta', 'peynirli sahanda', 14, 1, 16, 'porsiyon', 150, 'kahvalti'),
    ('haşlanmış bıldırcın yumurtası', 'bıldırcın yumurtası', 13, 0.4, 11, 'adet', 9, 'kahvalti'), ('ördek yumurtası', '', 13, 1.5, 14, 'adet', 70, 'kahvalti'),
    ('yumurta akı omlet', 'beyaz omlet|yumurta beyazı omlet', 11, 1, 2, 'porsiyon', 150, 'kahvalti'), ('avokadolu yumurta', 'yumurtalı avokado', 7, 4, 13, 'porsiyon', 200, 'kahvalti'),
    ('kahvaltılık patates', 'kahvaltı patatesi|elma dilim kahvaltı', 2, 20, 8, 'porsiyon', 150, 'kahvalti'), ('sigara böreği tabağı', '', 7, 28, 18, 'porsiyon', 150, 'ekmek'),
]
for item in LIST:
    n, als, p, c, f, u, g, grp = item
    add(n, [n] + [a for a in als.split('|') if a], p, c, f, u, g, grp)

# ---------------------------------------------------------------- tatlılar
SWEET = [
    # şerbetli
    ('şam tatlısı', 'şam', 4, 55, 12), ('irmik tatlısı', 'şerbetli irmik tatlısı', 4, 50, 10), ('portakallı revani', 'portakal revani', 5, 52, 11),
    ('hurma tatlısı', 'hurma tatlı', 5, 52, 18), ('kadayıf tatlısı cevizli', '', 6, 50, 21), ('fıstıklı kadayıf dürüm', 'kadayıf dürüm', 7, 48, 22),
    ('peynirli kadayıf', '', 8, 40, 18), ('sütlü kadayıf', 'sütlü tel kadayıf', 6, 35, 15), ('sütlü revani', '', 5, 35, 8),
    ('güllü baklava', '', 6, 48, 22), ('çikolatalı baklava', 'kakaolu baklava', 6, 48, 24), ('kuru baklava', 'kuru baklava fıstıklı', 8, 45, 30),
    ('burma baklava', '', 7, 46, 24), ('saray sarması', 'saray burması', 8, 45, 26), ('fıstıklı dolama', 'dolama', 8, 45, 27),
    ('bülbül yuvası fıstıklı', '', 7, 48, 25), ('ballı lokma', 'lokma ballı', 4, 50, 15), ('tahinli lokma', '', 5, 48, 16),
    ('kalburabastı cevizli', '', 5, 52, 17), ('ekmek kadayıfı kaymaklı', '', 5, 50, 15), ('tel kadayıf kaymaklı', '', 6, 45, 22),
    # sütlü
    ('sakızlı muhallebi', 'damla sakızlı muhallebi', 3.5, 20, 3.5), ('su muhallebisi', 'gül sulu muhallebi', 2, 22, 2),
    ('irmik muhallebisi', 'irmikli muhallebi', 3.5, 22, 3.5), ('pirinç muhallebisi', 'pirinçli muhallebi', 3.5, 22, 3.5),
    ('meyveli muhallebi', 'meyveli puding', 3, 24, 3), ('panna cotta', 'pannacotta', 3, 22, 13), ('sütlü irmik', 'sütlü irmik tatlısı', 4, 22, 4),
    ('sütlü nişasta', 'nişasta tatlısı', 3, 20, 3), ('malaga', 'malaga tatlısı', 4, 25, 6), ('tavuk göğsü kazandibi', '', 4, 22, 4),
    ('fırın muhallebi', 'fırında muhallebi', 4, 22, 4), ('kaymaklı muhallebi', '', 4, 22, 7), ('bademli muhallebi', '', 4.5, 22, 6),
    ('hindistan cevizli muhallebi', '', 3.5, 22, 7), ('karamelli puding', '', 3, 23, 4), ('vanilyalı puding', 'vanilya puding', 3, 22, 3.5),
    ('muzlu puding', '', 3, 23, 3.5), ('kahveli puding', '', 3, 22, 3.5), ('chia pudingi', 'chia puding sütlü', 4, 14, 6),
    ('sütlü chia', '', 4, 12, 6), ('keşkül fıstıklı', '', 4.5, 22, 7), ('aşure fındıklı', '', 3, 30, 3),
    # kek ve pasta
    ('havuçlu kek', 'havuçlu tarçınlı kek', 5, 48, 17), ('tarçınlı kek', 'tarçınlı elmalı kek', 5, 50, 16), ('limonlu kek', '', 5, 52, 16),
    ('portakallı kek', '', 5, 52, 16), ('kakaolu kek', 'çikolatalı kek', 6, 50, 19), ('mermer kek', 'mermer', 6, 50, 18),
    ('cevizli kek', '', 6, 46, 22), ('yoğurtlu kek', '', 6, 48, 14), ('zebra kek', '', 6, 50, 17), ('pandispanya', 'pandispanya keki', 7, 55, 6),
    ('rulo pasta', 'çikolatalı rulo pasta', 5, 45, 16), ('profiterollü pasta', 'profiterol pasta', 5, 35, 18), ('kestaneli pasta', '', 5, 40, 18),
    ('fıstıklı pasta', '', 6, 38, 20), ('karamelli pasta', '', 4, 42, 18), ('meyveli pasta', 'meyveli yaş pasta', 4, 36, 14),
    ('red velvet', 'red velvet kek|kırmızı kadife', 5, 45, 20), ('havuçlu pasta', 'carrot cake', 5, 45, 22), ('fırında cheesecake', 'new york cheesecake', 6, 24, 22),
    ('limonlu cheesecake fırın', '', 6, 26, 20), ('tahinli kek', '', 7, 45, 20), ('elmalı turta tarçınlı', '', 3, 38, 13),
    ('kek dilimi', 'sade kek|ev keki', 6, 52, 16), ('pasta dilimi', 'doğum günü pastası dilim', 5, 40, 18),
    ('ekler pasta', 'ekler pastası', 5, 30, 17), ('tiramisu kase', 'kupta tiramisu', 5, 26, 16), ('mozaik kek', '', 5, 50, 22),
    ('trileçe karamelli', '', 5, 34, 9), ('brownie dondurmalı', '', 5, 50, 22), ('sufle dondurmalı', '', 5, 40, 20),
    # kurabiye ve çikolata
    ('cevizli kurabiye', '', 7, 55, 26), ('fındıklı kurabiye', '', 7, 55, 26), ('tahinli kurabiye', '', 8, 52, 26),
    ('yulaflı kurabiye', 'oat cookie', 7, 60, 18), ('hindistan cevizli kurabiye', '', 5, 58, 25), ('kakaolu kurabiye', '', 6, 60, 22),
    ('limonlu kurabiye', '', 5, 62, 21), ('reçelli kurabiye', 'linzer', 5, 63, 19), ('portakallı kurabiye', '', 5, 62, 21),
    ('zencefilli kurabiye', 'gingerbread', 5, 70, 15), ('tereyağlı kurabiye', '', 5, 60, 25), ('susamlı kurabiye', '', 8, 55, 25),
    ('mahlepli kurabiye', '', 6, 58, 23), ('kabak çekirdekli kurabiye', '', 8, 52, 25), ('glutensiz kurabiye', '', 4, 62, 22),
    ('şekersiz kurabiye', 'diyet kurabiye', 7, 50, 22), ('fıstık ezmeli kurabiye', '', 10, 50, 26), ('bademli kurabiye ince', '', 9, 52, 26),
    ('fındıklı çikolata', 'bütün fındıklı çikolata', 8, 48, 36), ('bademli çikolata', '', 9, 45, 36), ('portakallı çikolata', '', 6, 55, 30),
    ('karamelli çikolata', '', 6, 60, 26), ('çikolata kaplı fındık', 'çikolatalı fındık|draje fındık', 8, 45, 38), ('çikolata kaplı badem', 'draje badem', 10, 45, 35),
    ('badem şekeri', 'şekerli badem|draje', 5, 80, 10), ('trüf', 'trüf çikolata', 5, 45, 35), ('çikolatalı pirinç patlağı', '', 6, 65, 20),
    ('fıstıklı lokum', 'antep fıstıklı lokum', 2.5, 75, 6), ('cevizli lokum', '', 2.5, 75, 7), ('güllü lokum', 'gül lokumu', 0.3, 85, 0.5),
    ('çifte kavrulmuş lokum', 'çifte kavrulmuş', 3, 70, 9), ('fındıklı lokum', '', 2.5, 75, 7), ('hindistan cevizli lokum', '', 1, 80, 5),
    ('narlı lokum', '', 0.5, 85, 0.5), ('limonlu lokum', '', 0.3, 85, 0.5), ('sultan lokumu', '', 3, 70, 9), ('damla sakızlı lokum', 'sakızlı lokum', 0.3, 85, 0.5),
    ('kakaolu helva', 'kakaolu tahin helvası', 11, 52, 28), ('fıstıklı helva', 'fıstıklı tahin helvası', 12, 50, 30), ('sade helva', 'sade tahin helvası', 12, 50, 28),
    ('kaymaklı irmik helvası', '', 5, 45, 18), ('dondurmalı irmik helvası', '', 5, 42, 17), ('kar helvası', '', 1, 70, 5),
    ('pekmezli helva', 'tahin pekmezli helva', 7, 60, 18), ('koz helva', 'koz helvası', 3, 75, 10), ('fıstıklı irmik helvası', '', 6, 44, 19),
    ('yaz helvası', 'bademli helva', 8, 50, 25), ('saray helvası', 'yumurtalı helva', 6, 50, 20),
    # dondurmalar
    ('vanilyalı dondurma', 'vanilya dondurma', 3.5, 24, 11), ('fıstıklı dondurma', 'antep fıstıklı dondurma', 5, 23, 15),
    ('fındıklı dondurma', '', 4.5, 23, 14), ('karamelli dondurma', '', 3.5, 27, 11), ('kahveli dondurma', '', 3.5, 24, 11),
    ('sakızlı dondurma', 'damla sakızlı dondurma', 3.5, 24, 10), ('bal badem dondurma', 'ballı bademli dondurma', 4.5, 26, 13),
    ('oreo dondurma', 'oreolu dondurma|bisküvili dondurma', 4, 28, 12), ('tiramisulu dondurma', 'tiramisu dondurma', 3.5, 26, 12),
    ('kestaneli dondurma', '', 3.5, 28, 10), ('yoğurtlu dondurma', 'yoğurt dondurması', 4, 22, 6), ('kaymaklı dondurma top', '', 3.5, 24, 12),
    ('fıstıklı külah', 'külah fıstıklı', 4.5, 30, 15), ('çikolatalı külah dondurma', '', 4, 32, 15), ('dondurmalı waffle', '', 5, 38, 15),
    ('dondurmalı brownie', '', 5, 48, 21), ('bitter çikolatalı dondurma', '', 4, 26, 13), ('beyaz çikolatalı dondurma', '', 3.5, 28, 12),
    ('limonlu sorbe', 'limon sorbe', 0.2, 30, 0.1), ('mangolu sorbe', '', 0.3, 30, 0.2), ('çilekli sorbe', '', 0.3, 29, 0.2),
]
for n, als, p, c, f in SWEET:
    u, g = ('top', 60) if 'dondurma' in n or 'sorbe' in n or 'külah' in n else ('kase', 150) if any(k in n for k in ('muhallebi', 'puding', 'irmik', 'nişasta', 'malaga', 'kazandibi', 'chia', 'keşkül', 'aşure', 'panna')) \
        else ('adet', 15) if any(k in n for k in ('kurabiye', 'lokum', 'trüf', 'şekeri', 'kaplı')) else ('dilim', 30) if 'helva' in n else ('adet', 40) if 'çikolata' in n \
        else ('dilim', 90)
    add(n, [n] + [a for a in als.split('|') if a], p, c, f, u, g, 'tatli')

# ---------------------------------------------------------------- içecekler
TEA = ['kuşburnu çayı', 'elma çayı', 'nar çayı', 'rezene çayı', 'ekinezya çayı', 'melisa çayı', 'zencefil çayı', 'tarçın çayı',
       'zencefilli limonlu çay', 'nane limon', 'hibiskus çayı', 'mate çayı', 'rooibos', 'earl grey', 'beyaz çay', 'oolong çayı',
       'karadut çayı', 'biberiye çayı', 'kekik çayı', 'kiraz sapı çayı', 'mısır püskülü çayı', 'lavanta çayı', 'zerdeçal çayı',
       'limon otu çayı', 'meyve çayı', 'kayısı çayı', 'yasemin çayı', 'nane çayı', 'ısırgan çayı', 'yeşil çay limonlu', 'ada çayı',
       'papatya çayı ballı', 'ihlamur ballı', 'karanfil çayı', 'dağ çayı', 'sumak çayı', 'çay sütlü', 'demlik çay', 'sallama çay',
       'bergamot çayı', 'kakule çayı', 'detoks çayı', 'form çayı', 'maydanoz çayı', 'kuşburnu ihlamur', 'portakal kabuğu çayı']
for n in TEA:
    sweet = 'ballı' in n or n in ('elma çayı', 'meyve çayı', 'nar çayı', 'kayısı çayı')
    milk = 'sütlü' in n
    p, c, f = (0.6, 1.2, 0.6) if milk else (0, 6 if sweet else 0.3, 0)
    add(n, [n, f'{n} şekersiz' if not sweet else n + ' şekerli'], p, c, f, 'bardak', 200, 'icecek', units='kupa:300', hyd=0.95)

MILKS = [('tam yağlı süt', (3.2, 4.8, 3.3)), ('yarım yağlı süt', (3.3, 4.8, 1.5)), ('yağsız süt', (3.4, 5, 0.1)), ('laktozsuz süt', (3.3, 4.8, 1.5)),
         ('yulaf sütü', (1, 6.5, 1.5)), ('badem sütü', (0.5, 0.6, 1.2)), ('soya sütü', (3, 2.5, 1.8)), ('hindistan cevizi sütü', (0.3, 2.7, 1.9))]
COFFEE = [('latte', 0.8, 0), ('cappuccino', 0.6, 0), ('flat white', 0.7, 0), ('cortado', 0.5, 0), ('mocha', 0.75, 7), ('beyaz mocha', 0.75, 9),
          ('vanilyalı latte', 0.8, 5), ('karamelli latte', 0.8, 5.5), ('fındıklı latte', 0.8, 5), ('tarçınlı latte', 0.8, 4),
          ('balkabaklı latte', 0.8, 7), ('lavantalı latte', 0.8, 5), ('kestaneli latte', 0.8, 6), ('karamel macchiato', 0.75, 6),
          ('buzlu latte', 0.6, 0), ('buzlu mocha', 0.6, 6), ('chai latte', 0.75, 7)]
ml = {'tam yağlı süt': 'tam yağlı sütlü', 'yarım yağlı süt': 'yarım yağlı sütlü', 'yağsız süt': 'yağsız', 'laktozsuz süt': 'laktozsuz',
      'yulaf sütü': 'yulaf sütlü', 'badem sütü': 'badem sütlü', 'soya sütü': 'soya sütlü', 'hindistan cevizi sütü': 'hindistan cevizi sütlü'}
for cn, frac, syrup in COFFEE:
    for mn, (mp, mc, mf) in MILKS:
        w = ml[mn]
        add(f'{w} {cn}', [f'{w} {cn}', f'{cn} {w}'], mp * frac, mc * frac + syrup, mf * frac + (1.5 if 'mocha' in cn else 0), 'bardak', 350, 'icecek',
            units='küçük:250,büyük:470', hyd=0.85)
for n, p, c, f, g in [('frappe karamel', 2, 15, 3, 400), ('mocha frappe', 2, 15, 3.5, 400), ('vanilyalı frappe', 2, 15, 3, 400), ('çilekli frappe', 1.5, 16, 2, 400),
                      ('affogato', 3.5, 22, 10, 120), ('sütlü filtre kahve', 0.8, 1.2, 0.8, 250), ('damla sakızlı türk kahvesi', 0.2, 0, 0.1, 70),
                      ('çifte kavrulmuş kahve', 0.2, 0, 0.1, 70), ('irish coffee', 0.5, 4, 4, 200), ('türk kahvesi az şekerli', 0.2, 3, 0.1, 70),
                      ('espresso con panna', 1, 2, 10, 60), ('kremalı kahve', 0.5, 3, 2, 250), ('dalgona kahve', 2.5, 10, 2.5, 250),
                      ('vietnam kahvesi', 2, 15, 2.5, 200), ('buzlu americano şuruplu', 0, 4, 0, 400), ('türk kahvesi sütlü köpüklü', 2, 3, 2, 100)]:
    add(n, [n], p, c, f, 'bardak', g, 'icecek', hyd=0.85)

for n, p, c, f in [('vanilyalı süt', 3, 9, 2.5), ('karamelli süt', 3, 10, 2.5), ('zerdeçallı süt', 3.2, 6, 3.3), ('altın süt', 3.2, 6, 3.3),
                   ('keçi sütü', 3.6, 4.5, 4.1), ('koyun sütü', 6, 5.4, 7), ('manda sütü', 3.8, 5, 7), ('sıcak süt ballı', 3, 9, 3),
                   ('tarçınlı sıcak süt', 3.2, 5.5, 3), ('fındıklı süt', 3, 9, 3), ('protein milkshake', 8, 9, 2), ('kakaolu protein süt', 5.5, 6, 0.5),
                   ('beyaz sıcak çikolata', 3, 15, 5), ('tarçınlı salep', 3, 14, 2), ('fıstıklı salep', 3.5, 14, 3), ('ayran tuzsuz', 1.7, 2.4, 1.9),
                   ('köpüklü ayran', 1.7, 2.4, 1.9), ('naneli ayran', 1.7, 2.6, 1.9), ('kefir sade yağsız', 3.4, 4.5, 0.2), ('laktozsuz kefir', 3.3, 4.2, 1.5),
                   ('hindistan cevizi kefiri', 0.5, 4, 2), ('şalgam acısız', 0.1, 0.8, 0), ('ev limonatası', 0, 9, 0), ('naneli limonata', 0, 10, 0),
                   ('çilekli limonata', 0, 11, 0), ('karpuzlu limonata', 0, 10, 0), ('lavantalı limonata', 0, 10, 0), ('zencefilli limonata', 0, 10, 0),
                   ('şekersiz limonata', 0, 1.5, 0), ('ev yapımı ice tea', 0, 6, 0), ('şeftalili ice tea', 0, 7, 0), ('limonlu ice tea', 0, 7, 0),
                   ('mangolu ice tea', 0, 7, 0), ('şekersiz ice tea', 0, 0.5, 0), ('demirhindi', 0.3, 13, 0), ('meyan kökü şerbeti', 0, 10, 0),
                   ('gül şerbeti', 0, 12, 0), ('vişne şerbeti', 0.2, 13, 0), ('limon şerbeti', 0, 12, 0), ('tamarind', 0.3, 13, 0),
                   ('kombucha zencefilli', 0, 3, 0), ('soğuk demleme çay', 0, 0.2, 0), ('enerji içeceği şekersiz', 0, 0.5, 0),
                   ('hindistan cevizi suyu sade', 0.7, 3.7, 0.2), ('aloe vera içeceği', 0, 9, 0), ('chia suyu', 0.5, 6, 0.5),
                   ('detoks smoothie yeşil', 1, 8, 0.5), ('protein smoothie', 6, 10, 1.5), ('fıstık ezmeli smoothie', 4, 12, 5),
                   ('yulaflı smoothie', 3, 12, 2), ('ıspanaklı smoothie', 1.5, 9, 1), ('karışık meyveli smoothie', 1.5, 13, 1),
                   ('tropik smoothie', 1, 14, 0.5), ('orman meyveli smoothie', 1.5, 11, 1), ('çikolatalı milkshake', 3.5, 18, 5),
                   ('vanilyalı milkshake', 3.5, 17, 5), ('karamelli milkshake', 3.5, 19, 5), ('oreo milkshake', 4, 20, 6),
                   ('fıstıklı milkshake', 4.5, 17, 7), ('kahveli milkshake', 3.5, 16, 5), ('lotus milkshake', 3.5, 20, 6)]:
    g = 350 if any(k in n for k in ('smoothie', 'milkshake')) else 250
    add(n, [n], p, c, f, 'bardak', g, 'icecek', hyd=0.85 if f < 3 else 0.75)

# ---------------------------------------------------------------- peynirler, ekmekler, kuruyemiş, bakliyat
for n, als, p, c, f in [
    ('kars kaşarı', 'kars gravyeri kaşar', 27, 1, 30), ('çerkez peyniri', 'çerkes peyniri|abaza peyniri', 22, 2, 20), ('küflü peynir', 'divle obruk|küflü tulum', 21, 1, 30),
    ('manda peyniri', 'manda mozzarella', 17, 1, 25), ('yarım yağlı beyaz peynir', 'yarım yağlı peynir', 19, 2, 13), ('tuzsuz beyaz peynir', 'tuzsuz peynir', 17, 1.5, 21),
    ('süzme beyaz peynir', '', 18, 1.5, 20), ('rokfor', 'roquefort|mavi peynir', 21, 2, 31), ('gouda', 'gouda peyniri', 25, 2, 27), ('brie', 'brie peyniri', 21, 0.5, 28),
    ('camembert', 'kamember', 20, 0.5, 24), ('edam', 'edam peyniri', 25, 1.4, 28), ('emmental', 'emmental peyniri', 28, 1.5, 30), ('ricotta', 'rikota', 11, 3, 13),
    ('mascarpone', 'maskarpone', 4.6, 4.8, 44), ('telli peynir', '', 24, 2, 22), ('kaşkaval', 'kaşkaval peyniri', 25, 1, 28), ('golot peyniri', 'golot', 26, 2, 20),
    ('mengen peyniri', '', 20, 2, 24), ('deri tulum', 'deri tulum peyniri', 24, 1, 30), ('carra peyniri', 'carra', 20, 2, 25), ('otlu lor', '', 12, 3, 6),
    ('sepet peyniri', '', 20, 2, 24), ('kesik peyniri', 'kesik', 15, 4, 2), ('erzincan tulum', 'erzincan tulum peyniri', 24, 1, 30),
    ('izmir tulum', 'izmir tulum peyniri', 20, 2, 25), ('ezine keçi peyniri', '', 17, 2, 24), ('kaymaklı beyaz peynir', '', 15, 2, 26),
    ('labne light', 'az yağlı labne', 8, 5, 8), ('lor light', 'yağsız lor', 13, 3, 1), ('beyaz peynir yağsız', 'yağsız beyaz peynir', 22, 3, 4),
]:
    add(n, [n] + [a for a in als.split('|') if a], p, c, f, 'dilim', 30, 'kahvalti')

for n, als, p, c, f, u, g in [
    ('glutensiz ekmek', '', 3, 50, 4, 'dilim', 30), ('siyez ekmeği', 'siyez', 9, 45, 2, 'dilim', 30), ('karabuğday ekmeği', '', 8, 45, 3, 'dilim', 30),
    ('baget ekmek', 'fransız ekmeği|baget ekmeği', 9, 52, 3, 'dilim', 40), ('ciabatta', 'çiyabata', 9, 48, 4, 'adet', 80), ('focaccia', 'fokaçya', 8, 45, 9, 'dilim', 70),
    ('brioche', 'briyoş', 8, 50, 13, 'adet', 60), ('sütlü ekmek', '', 9, 50, 5, 'dilim', 30), ('zeytinli ekmek', '', 8, 45, 7, 'dilim', 35),
    ('cevizli ekmek', '', 9, 42, 9, 'dilim', 35), ('üzümlü ekmek', '', 8, 52, 3, 'dilim', 35), ('peksimet', 'kuru ekmek', 12, 75, 5, 'adet', 15),
    ('kumru ekmeği', '', 9, 52, 4, 'adet', 120), ('tırnaklı pide', '', 9, 52, 3, 'adet', 250), ('susamsız simit', '', 10, 55, 6, 'adet', 110),
    ('kepekli simit', 'tam buğday simit', 11, 50, 7, 'adet', 110), ('pekmezli simit', '', 9, 55, 8, 'adet', 110), ('hot dog ekmeği', 'sosisli ekmeği', 9, 50, 4, 'adet', 60),
    ('tam buğday lavaş', '', 9, 48, 4, 'adet', 60), ('mısır tortilla', 'mısır lavaşı', 6, 45, 3, 'adet', 30), ('yulaf ezmeli ekmek', '', 10, 43, 4, 'dilim', 30),
    ('kepekli pide', 'tam buğday pide', 10, 48, 3, 'adet', 250), ('ekşi mayalı tam buğday', '', 9, 45, 2, 'dilim', 35), ('çavdarlı ekşi maya', '', 8, 46, 2, 'dilim', 35),
    ('köy bazlaması', '', 8, 50, 3, 'adet', 200), ('dağ ekmeği', 'saç ekmeği', 9, 55, 2, 'adet', 120), ('kete sade', '', 7, 50, 21, 'adet', 100),
    ('tahinli çörek', 'tahinli çörek dilim', 9, 50, 18, 'adet', 100), ('haşhaşlı rulo', 'haşhaşlı çörek rulo', 8, 52, 18, 'adet', 100),
    ('galeta unu', '', 13, 72, 5, 'yemek kaşığı', 10), ('kraker tuzlu', 'tuzlu kraker', 9, 68, 15, 'adet', 5),
]:
    add(n, [n] + [a for a in als.split('|') if a], p, c, f, u, g, 'ekmek')

NUTS = [('fındık', 15, 17, 61), ('badem', 21, 22, 50), ('ceviz', 15, 14, 65), ('antep fıstığı', 20, 28, 45), ('kaju', 18, 30, 44),
        ('yer fıstığı', 26, 16, 49), ('ay çekirdeği', 21, 20, 51), ('kabak çekirdeği', 30, 11, 49), ('leblebi', 22, 58, 6),
        ('pekan cevizi', 9, 14, 72), ('çam fıstığı', 14, 13, 68), ('brezilya cevizi', 14, 12, 66), ('makademya', 8, 14, 76)]
for n, p, c, f in NUTS:
    add(f'kavrulmuş {n}', [f'kavrulmuş {n}', f'tuzlu {n}', f'kavrulmuş tuzlu {n}', f'tuzsuz {n}'], p, c, f + 1, 'avuç', 30, 'kuruyemis')
    add(f'çiğ {n}', [f'çiğ {n}', f'kabuklu {n}', f'{n} içi'], p, c, f, 'avuç', 30, 'kuruyemis')
    add(f'ballı {n}', [f'ballı {n}', f'karamelize {n}', f'şekerli {n}'], p * 0.8, c * 0.8 + 18, f * 0.8, 'avuç', 30, 'kuruyemis')
    add(f'{n} ezmesi', [f'{n} ezmesi', f'{n} kreması', f'%100 {n} ezmesi'], p, c, f + 2, 'yemek kaşığı', 16, 'kahvalti')

LEG = [('nohut', 19, 61, 6, 8.9, 27.4, 2.6), ('kuru fasulye', 22, 60, 1.5, 8.7, 22, 0.5), ('barbunya', 23, 60, 1, 8, 22, 0.5),
       ('kırmızı mercimek', 24, 60, 1.5, 9, 20, 0.4), ('yeşil mercimek', 25, 60, 1, 9, 20, 0.4), ('maş fasulyesi', 24, 63, 1.2, 7, 19, 0.4),
       ('börülce kuru', 24, 60, 1.3, 8, 21, 0.5), ('bakla kuru', 26, 58, 1.5, 7.6, 19.7, 0.4), ('soya fasulyesi', 36, 30, 20, 17, 10, 9),
       ('karabuğday', 13, 72, 3.4, 3.4, 20, 0.6), ('kinoa', 14, 64, 6, 4.4, 21, 1.9), ('bulgur', 12, 76, 1.3, 3.1, 19, 0.2),
       ('baldo pirinç', 7, 79, 0.6, 2.7, 28, 0.3), ('osmancık pirinç', 7, 79, 0.6, 2.7, 28, 0.3), ('basmati pirinç', 7, 78, 0.6, 2.7, 28, 0.3),
       ('esmer pirinç', 7.5, 76, 2.7, 2.6, 23, 0.9), ('siyah pirinç', 8.5, 72, 3, 3, 23, 1), ('arpa', 12, 73, 2.3, 2.3, 28, 0.4),
       ('yulaf', 13, 66, 7, 2.5, 12, 1.4), ('firik', 12, 70, 2.5, 3, 20, 0.5), ('siyez bulguru', 13, 70, 2, 3.5, 20, 0.5),
       ('kuskus', 13, 77, 0.6, 3.8, 23, 0.2), ('şehriye', 12, 74, 1.5, 5, 30, 0.6), ('irmik', 12.7, 73, 1, 3, 15, 0.2),
       ('mısır irmiği', 7, 79, 1.2, 1.4, 15, 0.2), ('buğday', 13, 71, 2, 5, 28, 0.7), ('chia tohumu', 17, 42, 31, 17, 42, 31)]
for n, p, c, f, hp, hc, hf in LEG:
    add(f'haşlanmış {n}', [f'haşlanmış {n}', f'pişmiş {n}', f'{n} haşlama'], hp, hc, hf, 'kase', 150, 'ana', units='yemek kaşığı:20')
    add(f'çiğ {n}', [f'çiğ {n}', f'kuru {n}', f'{n} kuru'], p, c, f, 'su bardağı', 180, 'diger', units='yemek kaşığı:12')

for n, p, c, f in [('tam buğday unu', 13, 61, 2.5), ('beyaz un', 10, 76, 1), ('çavdar unu', 10, 69, 1.6), ('badem unu', 21, 20, 50),
                   ('hindistan cevizi unu', 19, 60, 14), ('mısır unu', 7, 77, 3.9), ('pirinç unu', 6, 80, 1.4), ('nohut unu', 22, 58, 6.7),
                   ('yulaf unu', 15, 66, 9), ('karabuğday unu', 13, 71, 3.4), ('mısır nişastası', 0.3, 91, 0.1), ('kakao tozu', 20, 58, 14),
                   ('hindistan cevizi yağı katı', 0, 0, 99), ('ayçiçek yağı', 0, 0, 100), ('fındık yağı', 0, 0, 100), ('susam yağı', 0, 0, 100),
                   ('kanola yağı', 0, 0, 100), ('mısırözü yağı', 0, 0, 100), ('toz şeker', 0, 100, 0), ('esmer şeker', 0.1, 98, 0),
                   ('pudra şekeri', 0, 100, 0), ('glikoz şurubu', 0, 77, 0), ('agave şurubu', 0.1, 76, 0.5), ('akçaağaç şurubu', 0, 67, 0.1),
                   ('hurma şurubu', 1, 75, 0.1), ('dut pekmezi', 0, 73, 0), ('üzüm pekmezi', 0, 73, 0), ('keçiboynuzu pekmezi', 1.8, 68, 1.8),
                   ('nar ekşisi', 0.5, 60, 0.3), ('domates sos', 1.5, 7, 3), ('beşamel sos', 4, 9, 8), ('sarımsaklı yoğurt', 3.3, 4.5, 3.2),
                   ('tarator sosu', 6, 9, 30), ('cacık sosu', 3, 4, 3), ('acılı sos domatesli', 1.5, 8, 0.5), ('salata sosu zeytinyağlı', 0, 4, 50),
                   ('balzamik sirke', 0.5, 17, 0), ('üzüm sirkesi', 0, 0.6, 0), ('limon sosu', 0.3, 7, 0.2), ('humus sosu', 7, 14, 10)]:
    unit, g = ('yemek kaşığı', 15) if 'yağı' in n or 'şurub' in n or 'pekmez' in n or 'sos' in n or 'sirke' in n or 'ekşisi' in n or 'yoğurt' in n else ('yemek kaşığı', 10)
    add(n, [n], p, c, f, unit, g, 'diger', units='su bardağı:120' if 'un' in n.split()[-1] or n.endswith('unu') else 'tatlı kaşığı:5')

out = ['// OTOMATİK ÜRETİLDİ: tools/gen_foods.py. Elle düzenlemeyin; oluşturucuyu değiştirip yeniden çalıştırın.',
       '// Tarif şablonlarından hesaplanmış ev yemekleri, sebze/et/balık pişirme çeşitleri, hamur işleri, tatlılar ve içecekler.',
       "import type { ExtRow } from './foods_ext';", '', 'export const GEN_ROWS: ExtRow[] = [']
for r in ROWS:
    i, name, als, kcal, p, c, f, u, g, units, grp, hyd = r
    q = lambda s: "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"
    extra = f', {{ hydration: {hyd} }}' if hyd is not None else ''
    out.append(f'  [{q(i)}, {q(name)}, {q(als)}, {kcal}, {p}, {c}, {f}, {q(u)}, {g}, {q(units)}, {q(grp)}{extra}],')
out.append('];')
open('mobile/src/core/foods_gen.ts', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(ROWS), 'satır üretildi')
