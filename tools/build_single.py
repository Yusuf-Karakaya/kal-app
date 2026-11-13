"""app/ klasöründeki PWA'yı tek bir HTML dosyasına (CSS ve JS gömülü) dönüştürür.

Service worker / manifest gerektirmeyen ortamlarda (ör. claude.ai Artifact sayfası)
yayınlamak içindir. Kullanım:  python3 tools/build_single.py dist/kal.html
"""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent / 'app'
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/kal.html')

html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
js = (root / 'app.js').read_text(encoding='utf-8')
core = (root / 'core.js').read_text(encoding='utf-8')

# <head> içindekileri ayıkla: başlık ve font bağlantıları kalır, manifest/ikon gider
title = re.search(r'<title>.*?</title>', html).group(0)
fonts = '\n'.join(re.findall(r'<link rel="(?:preconnect|stylesheet)" href="https://fonts[^>]*>', html))
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = body.replace('<script src="core.js"></script>', '<script>\n' + core + '\n</script>')
body = body.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>')

single = f"""{title}
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>
{css}
</style>
{body.strip()}
"""
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(single, encoding='utf-8')
print(f'{out} yazıldı ({len(single) // 1024} KB)')
