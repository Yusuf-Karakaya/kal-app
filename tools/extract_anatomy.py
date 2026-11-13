"""react-native-body-highlighter (MIT, © 2022 ELABBASSI Hicham) paketindeki anatomik SVG yollarını
uygulamanın çekirdeğine veri olarak aktarır. Paketin kodu çalıştırılmaz; dosyalar metin olarak okunur.

Kullanım:
  npm pack react-native-body-highlighter   (ayrı bir klasörde) && tar -xzf *.tgz
  python3 -I tools/extract_anatomy.py <paket/dist klasörü> mobile/src/core/anatomy.ts
"""
import json
import re
import sys
from pathlib import Path

dist = Path(sys.argv[1])
out = Path(sys.argv[2])

ASSETS = {
    ('male', 'front'): 'assets/bodyFront.js',
    ('male', 'back'): 'assets/bodyBack.js',
    ('female', 'front'): 'assets/bodyFemaleFront.js',
    ('female', 'back'): 'assets/bodyFemaleBack.js',
}
WRAPPERS = {'male': 'components/SvgMaleWrapper.js', 'female': 'components/SvgFemaleWrapper.js'}

STR = re.compile(r'"((?:[^"\\]|\\.)*)"')


def parse_parts(text):
    parts = []
    blocks = re.split(r'\bslug:\s*', text)[1:]
    for b in blocks:
        slug = STR.match(b.strip()).group(1)
        for side in ('left', 'right', 'common'):
            m = re.search(side + r':\s*\[(.*?)\]', b, re.S)
            if not m:
                continue
            for d in STR.findall(m.group(1)):
                parts.append((slug, side, d))
    return parts


# ---- Yol sınır kutusu (uç ve kontrol noktalarından yaklaşık) ----
NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')
ARGS = {'m': 2, 'l': 2, 'h': 1, 'v': 1, 'c': 6, 's': 4, 'q': 4, 't': 2, 'a': 7, 'z': 0}


def tokens(d):
    i = 0
    while i < len(d):
        ch = d[i]
        if ch.isalpha():
            yield ch
            i += 1
        elif ch in ' ,\n\t':
            i += 1
        else:
            m = NUM.match(d, i)
            if not m:
                raise ValueError(f'çözülemedi: {d[i:i+20]}')
            yield m.group(0)
            i = m.end()


def bbox(d):
    toks = list(tokens(d))
    xs, ys = [], []
    x = y = sx = sy = 0.0
    i = 0
    cmd = None
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in 'zZ':
                x, y = sx, sy
                continue
        lc = cmd.lower()
        rel = cmd.islower()
        n = ARGS[lc]
        if lc == 'a':
            # bayraklar bitişik yazılabilir ("012.89"): sırayla ayrıştır
            vals = []
            while len(vals) < 7:
                tk = toks[i]
                if len(vals) in (3, 4) and len(tk) > 1 and tk[0] in '01':
                    vals.append(float(tk[0]))
                    toks[i] = tk[1:]
                    continue
                vals.append(float(tk))
                i += 1
            nx, ny = vals[5], vals[6]
            if rel:
                nx += x
                ny += y
            x, y = nx, ny
            xs.append(x)
            ys.append(y)
            continue
        vals = [float(v) for v in toks[i:i + n]]
        i += n
        if lc == 'h':
            x = x + vals[0] if rel else vals[0]
        elif lc == 'v':
            y = y + vals[0] if rel else vals[0]
        else:
            pts = [(vals[k], vals[k + 1]) for k in range(0, n, 2)]
            if rel:
                pts = [(px + x, py + y) for px, py in pts]
            for px, py in pts:
                xs.append(px)
                ys.append(py)
            x, y = pts[-1]
            if lc == 'm':
                sx, sy = x, y
                cmd = 'l' if rel else 'L'
        xs.append(x)
        ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def border(text, side):
    m = re.search(r'side === "' + side + r'" && \(<react_native_svg_1\.Path[^>]*?d="([^"]+)"', text)
    return m.group(1) if m else ''


def viewbox(text, side):
    m = re.search(r'viewBox = side === "front" \? "([^"]+)" : "([^"]+)"', text)
    return m.group(1) if side == 'front' else m.group(2)


data = {}
for (sex, view), rel in ASSETS.items():
    text = (dist / rel).read_text(encoding='utf-8')
    wrap = (dist / WRAPPERS[sex]).read_text(encoding='utf-8')
    parts = []
    allx, ally = [], []
    for slug, side, d in parse_parts(text):
        x0, y0, x1, y1 = bbox(d)
        allx += [x0, x1]
        ally += [y0, y1]
        parts.append([slug, side[0], d, round((x0 + x1) / 2, 1), round((y0 + y1) / 2, 1)])
    head = [p for p in parts if p[0] in ('head', 'hair')]
    data.setdefault(sex, {})[view] = {
        'vb': viewbox(wrap, view),
        'border': border(wrap, view),
        # vücudun dikey ekseni (simetri merkezi): kafa yollarının ortası
        'cx': round(sum(p[3] for p in head) / len(head), 1) if head else round((min(allx) + max(allx)) / 2, 1),
        'box': [round(min(allx), 1), round(min(ally), 1), round(max(allx), 1), round(max(ally), 1)],
        'parts': parts,
    }

header = '''// OTOMATİK ÜRETİLDİ: tools/extract_anatomy.py — elle düzenleme.
// Anatomik vücut çizimleri: react-native-body-highlighter v3.2.0
// MIT License, Copyright (c) 2022 ELABBASSI Hicham — https://github.com/HichamELBSI/react-native-body-highlighter
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction [...]. The above copyright
// notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

/** [kas adı, taraf (l/r/c), yol, merkez x, merkez y] */
export type AnatomyPart = [string, string, string, number, number];
export interface AnatomyFigure { vb: string; border: string; cx: number; box: [number, number, number, number]; parts: AnatomyPart[] }

'''
out.write_text(header + 'export const ANATOMY: Record<\'male\' | \'female\', Record<\'front\' | \'back\', AnatomyFigure>> = '
               + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print(out, f'{out.stat().st_size // 1024} KB', {f'{s}/{v}': len(f["parts"]) for s, vv in data.items() for v, f in vv.items()})
for s, vv in data.items():
    for v, f in vv.items():
        print(s, v, 'vb', f['vb'], 'cx', f['cx'], 'box', f['box'], 'border', len(f['border']))
