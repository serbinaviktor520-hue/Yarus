#!/usr/bin/env python3
"""Favicons and web-app manifest for TYSHA, drawn from the site's own "A" house mark (#l-arch).

    python3 tysha/_tools/icons.py

Writes tysha/favicon.svg, favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png
and site.webmanifest.
"""
import json, os
from PIL import Image, ImageDraw

SITE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
BG, FG = '#111110', '#EAE6DE'
# the mark: an arch 200x240 with a door and a window cut out (same geometry as #l-arch in the pages)
PATH = 'M0 240V70Q0 0 70 0h60q70 0 70 70v170zM69 240h62l-21-70H90zM92 84h16v44H92z'

SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="{BG}"/><path transform="translate(15.33 12) scale(.16667)" fill="{FG}" fill-rule="evenodd" d="{PATH}"/></svg>
'''


def quad(p0, c, p1, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in (i / n for i in range(n + 1))]


def png(size, radius, pad, maskable=False):
    S = size * 8
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle((0, 0, S, S), fill=BG)
    else:
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=radius * S, fill=BG)
    h = S * (1 - 2 * pad); k = h / 240; w = 200 * k; ox, oy = (S - w) / 2, (S - h) / 2
    P = lambda x, y: (ox + x * k, oy + y * k)
    arch = [P(0, 240), P(0, 70)] + [P(*q) for q in quad((0, 70), (0, 0), (70, 0))] + [P(130, 0)] + [P(*q) for q in quad((130, 0), (200, 0), (200, 70))] + [P(200, 240)]
    d.polygon(arch, fill=FG)
    d.polygon([P(69, 240), P(131, 240), P(110, 170), P(90, 170)], fill=BG)
    d.rectangle([P(92, 84), P(108, 128)], fill=BG)
    return im.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    open(os.path.join(SITE, 'favicon.svg'), 'w').write(SVG)
    png(32, .22, .19).save(os.path.join(SITE, 'favicon-32.png'), optimize=True)
    png(180, 0, .22, maskable=True).convert('RGB').save(os.path.join(SITE, 'apple-touch-icon.png'), optimize=True)
    png(192, .22, .2).save(os.path.join(SITE, 'icon-192.png'), optimize=True)
    png(512, 0, .28, maskable=True).convert('RGB').save(os.path.join(SITE, 'icon-512.png'), optimize=True)
    json.dump({
        'name': 'TYSHA — Architecture of silence', 'short_name': 'TYSHA', 'start_url': './', 'scope': './',
        'display': 'browser', 'background_color': BG, 'theme_color': BG,
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                  {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'},
                  {'src': 'favicon.svg', 'sizes': 'any', 'type': 'image/svg+xml'}],
    }, open(os.path.join(SITE, 'site.webmanifest'), 'w'), indent=2, ensure_ascii=False)
    print('icons written')
