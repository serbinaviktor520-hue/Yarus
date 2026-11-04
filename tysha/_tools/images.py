#!/usr/bin/env python3
"""TYSHA image pipeline: source photos -> responsive AVIF / WebP / JPEG + <picture> markup.

    python3 tysha/_tools/images.py            # from the repo root (or anywhere)
    python3 tysha/_tools/images.py --force    # re-encode everything

1. Every tysha/img/src/<name>.jpg (or .jpeg/.png) is encoded to tysha/img/<name>-<width>.{avif,webp,jpg}
   at 480 / 960 / 1600 / 2560 px wide (AVIF and WebP), never upscaled; when the source is wider
   than the last step that fits, its own width is added so the sharpest version is kept. One JPEG
   (the largest width up to 1600) is the fallback for browsers without AVIF/WebP. Files are only
   re-encoded when the source is newer; outputs for widths that no longer apply are deleted.
2. Every page is rewritten: a plain <img src="img/<name>.jpg"> becomes a <picture>, and an
   existing <picture data-img="<name>"> is refreshed (srcset, width/height). Attributes you set on
   the <img> (class, alt, sizes, data-*, loading) are kept.
     - images marked data-hero-img load eagerly with fetchpriority="high" and get a
       <link rel="preload"> in the page head;
     - images marked data-defer get data-srcset only (site JS loads them when needed);
     - everything else gets loading="lazy" decoding="async".
3. The footer wordmark (<svg><image>) points at the 1600 px JPEG of its photo, and
   img/og.jpg (1200x630, for social cards) is cut from the home hero photo.

To swap photos: drop the new files into tysha/img/src/ under the same names and run the script.
"""
import hashlib, html, os, re, sys
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, '..'))
SRC = os.path.join(SITE, 'img', 'src')
OUT = os.path.join(SITE, 'img')
PAGES = {'index.html': '', 'project/index.html': '../', 'project/pine-court/index.html': '../../', 'project/lull-house/index.html': '../../', 'method/index.html': '../', 'privacy/index.html': '../', '404/index.html': ''}
WIDTHS = [480, 960, 1600, 2560]
FMT = {'avif': dict(format='AVIF', quality=52, speed=6), 'webp': dict(format='WEBP', quality=78, method=6), 'jpg': dict(format='JPEG', quality=80, progressive=True, optimize=True)}
OG_FROM, OG_FOCUS_Y = 'h08', 0.30
OG_MORE = {'og-pine': ('p01', 0.45)}   # one social card per case
MQ = '(max-width: 760px)'
# the day frames' portrait crops: phones held upright (a portrait tablet's photo box is landscape, it keeps the 3:2 frames)
MQ_FOR = {n: '(max-width: 760px) and (orientation: portrait)' for n in ('g15', 'h03', 'g14', 'h06', 'h09')}
MOBILE = lambda name, man: (name + 'm') if (name + 'm') in man and not name.endswith('m') else None
PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
FORCE = '--force' in sys.argv


# the day frames are served at 1600 px at most: enlarged further, their pines turn painterly
CAP = {n: 1600 for n in ('g15', 'h03', 'g14', 'h06', 'h09')}


def widths_for(w, cap=None):
    if cap:
        return [x for x in WIDTHS if x <= min(w, cap)]
    ws = [x for x in WIDTHS if x <= w]
    if not ws or max(ws) < 0.9 * w:
        ws.append(w)
    return ws


def jpg_width(ws):
    return max([w for w in ws if w <= 1600] or [ws[0]])


def encode():
    manifest = {}
    for f in sorted(os.listdir(SRC)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        src = os.path.join(SRC, f)
        im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
        ws = widths_for(im.width, CAP.get(name))
        # cache-busting: every URL carries ?v=<hash of the source>, so a replaced photo under an old file name
        # is a new URL for browsers and CDNs (img/ is served with a week-long max-age)
        v = hashlib.md5(open(src, 'rb').read()).hexdigest()[:8]
        # placeholder: the photo's average colour (a little darker), shown on the <img> until it paints
        c = im.resize((1, 1), Image.BOX).getpixel((0, 0))
        tone = '#%02x%02x%02x' % tuple(round(x * 0.85) for x in c)
        manifest[name] = {'w': im.width, 'h': im.height, 'widths': ws, 'v': v, 'tone': tone}
        fb = jpg_width(ws)
        for w in ws:
            small = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            for e, opts in FMT.items():
                if e == 'jpg' and w != fb:
                    continue
                dst = os.path.join(OUT, f'{name}-{w}.{e}')
                if FORCE or not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                    small.save(dst, **opts)
        # drop outputs for widths that no longer apply
        for g in os.listdir(OUT):
            m = re.fullmatch(re.escape(name) + r'-(\d+)\.(avif|webp|jpg)', g)
            if m and (int(m.group(1)) not in ws or (m.group(2) == 'jpg' and int(m.group(1)) != fb)):
                os.remove(os.path.join(OUT, g))
        print(f'{name}: {im.width}x{im.height} -> {ws}')
    return manifest


def og(manifest):
    src = next(os.path.join(SRC, f) for f in os.listdir(SRC) if os.path.splitext(f)[0] == OG_FROM)
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    W, H = 1200, 630
    s = max(W / im.width, H / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    top = min(max(0, round(r.height * OG_FOCUS_Y - H / 2)), r.height - H)
    left = (r.width - W) // 2
    r.crop((left, top, left + W, top + H)).save(os.path.join(OUT, 'og.jpg'), quality=82, progressive=True, optimize=True)
    for out, (name, fy) in OG_MORE.items():
        im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, name + '.jpg'))).convert('RGB')
        s = max(W / im.width, H / im.height)
        r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        top = min(max(0, round(r.height * fy - H / 2)), r.height - H)
        r.crop(((r.width - W) // 2, top, (r.width - W) // 2 + W, top + H)).save(os.path.join(OUT, out + '.jpg'), quality=82, progressive=True, optimize=True)


def _attrs(tag):
    out = []
    for m in re.finditer(r'([\w:-]+)(?:="([^"]*)")?', tag[len('<img'):-1]):
        out.append((m.group(1), m.group(2)))
    return out


def picture(name, img_attrs, prefix, man):
    info = man[name]
    ws = info['widths']
    a = [(k, v) for k, v in img_attrs if k not in ('src', 'srcset', 'width', 'height', 'data-srcset', 'data-src', 'fetchpriority', 'decoding', 'data-tone')]
    keys = [k for k, _ in a]
    sizes = dict(a).get('sizes') or '100vw'
    a = [(k, v) for k, v in a if k != 'sizes']
    keys = [k for k, _ in a]
    # data-lcp: a first-screen photo that is not a hero (the projects index card): loaded and preloaded like one
    hero, defer = 'data-hero-img' in keys or 'data-lcp' in keys, 'data-defer' in keys
    if hero:
        a = [(k, v) for k, v in a if k != 'loading']
    elif 'loading' not in keys and not defer:
        a.append(('loading', 'lazy'))
    v = info['v']
    ss = lambda e: ', '.join(f'{prefix}img/{name}-{w}.{e}?v={v} {w}w' for w in ws)
    fallback = jpg_width(ws)
    sattr = 'data-srcset' if defer else 'srcset'
    parts = [f'<picture data-img="{name}">']
    mob = MOBILE(name, man)
    if mob:
        # art-directed phone crop first: the browser takes the first <source> whose media matches
        ms = lambda e: ', '.join(f'{prefix}img/{mob}-{w}.{e}?v={man[mob]["v"]} {w}w' for w in man[mob]['widths'])
        mq = MQ_FOR.get(name, MQ)
        parts += [f'<source media="{mq}" type="image/avif" {sattr}="{ms("avif")}" sizes="100vw">',
                  f'<source media="{mq}" type="image/webp" {sattr}="{ms("webp")}" sizes="100vw">']
    parts += [f'<source type="image/avif" {sattr}="{ss("avif")}" sizes="{sizes}">',
             f'<source type="image/webp" {sattr}="{ss("webp")}" sizes="{sizes}">']
    tag = ['<img']
    if defer:
        tag.append(f'src="{PLACEHOLDER}" data-src="{prefix}img/{name}-{fallback}.jpg?v={v}"')
    else:
        tag.append(f'src="{prefix}img/{name}-{fallback}.jpg?v={v}"')
    tag.append(f'width="{info["w"]}" height="{info["h"]}" data-tone="{info["tone"]}"')
    for k, v in a:
        tag.append(k if v is None else f'{k}="{v}"')
    tag.append('fetchpriority="high"' if hero else 'decoding="async"')
    parts.append(' '.join(tag) + '>')
    parts.append('</picture>')
    return ''.join(parts)


# one version for the code: a hash of every stylesheet and script, written on each <script>/<link> as ?v= (site.js
# passes its own ?v= on to sound.js), so a returning visitor never runs yesterday's code under today's page
ASSETS = ['site.css', 'site.js', 'home.js', 'live.js', 'sound.js', 'modal.js']


def asset_version():
    h = hashlib.md5()
    for a in ASSETS:
        h.update(open(os.path.join(SITE, 'assets', a), 'rb').read())
    return h.hexdigest()[:8]


def rewrite(man):
    av = asset_version()
    for page, prefix in PAGES.items():
        path = os.path.join(SITE, page)
        t = open(path, encoding='utf-8').read()
        t = re.sub(r'((?:src|href)="(?:\.\./)?assets/(?:' + '|'.join(re.escape(a) for a in ASSETS) + r'))(?:\?v=\w+)?"', lambda m: f'{m.group(1)}?v={av}"', t)
        imgrx = r'<img\b[^>]*>'

        def name_from(tag):
            m = re.search(r'\b(?:data-)?src="(?:\.\./)*img/([\w-]+?)(?:-\d+)?\.(?:jpg|jpeg|png)"', tag)
            return m.group(1) if m and m.group(1) in man else None

        # refresh existing pictures
        def refresh(m):
            name = m.group(1)
            img = re.search(imgrx, m.group(0)).group(0)
            at = _attrs(img)
            sz = re.search(r'<source type="[^"]*"[^>]*\bsizes="([^"]*)"', m.group(0))
            if sz and 'sizes' not in dict(at):
                at.append(('sizes', sz.group(1)))
            return picture(name, at, prefix, man) if name in man else m.group(0)
        t = re.sub(r'<picture data-img="([\w-]+)">.*?</picture>', refresh, t, flags=re.S)
        # convert plain images (outside pictures and scripts)
        out, pos = [], 0
        for m in re.finditer(r'<picture\b.*?</picture>|<script\b.*?</script>|' + imgrx, t, flags=re.S):
            out.append(t[pos:m.start()]); pos = m.end(); s = m.group(0)
            if s.startswith('<img'):
                n = name_from(s)
                s = picture(n, _attrs(s), prefix, man) if n else s
            out.append(s)
        out.append(t[pos:]); t = ''.join(out)
        # footer wordmark photo
        # the footer wordmark photo: written as data-href, set by site.js when the footer comes near (an SVG <image>
        # cannot be lazy, and this one would otherwise compete with the first screen on every page)
        t = re.sub(r'(<image\b[^>]*\b)href="((?:\.\./)*img/[\w-]+?(?:-\d+)?\.jpg(?:\?v=\w+)?)"', r'\1data-href="\2"', t)
        t = re.sub(r'(<image\b[^>]*\bdata-href=")(?:\.\./)*img/([\w-]+?)(?:-\d+)?\.jpg(?:\?v=\w+)?"',
                   lambda m: f'{m.group(1)}{prefix}img/{m.group(2)}-{jpg_width(man[m.group(2)]["widths"])}.jpg?v={man[m.group(2)]["v"]}"' if m.group(2) in man else m.group(0), t)
        # preload the hero image
        t = re.sub(r'<link rel="preload" as="image"[^>]*data-img-preload[^>]*>\n', '', t)
        hm = re.search(r'<picture data-img="([\w-]+)">(?:(?!</picture>).)*data-(?:hero-img|lcp)', t, flags=re.S)
        if hm:
            name = hm.group(1); ws = man[name]['widths']
            sizes = re.search(r'<source type="[^"]*"[^>]*\bsizes="([^"]*)"', hm.group(0)).group(1)
            mob = MOBILE(name, man)
            # with a phone crop, each viewport preloads only the file it will show
            media = f' media="(min-width: 761px)"' if mob else ''
            link = (f'<link rel="preload" as="image" type="image/avif" fetchpriority="high"{media} imagesrcset="'
                    + ', '.join(f'{prefix}img/{name}-{w}.avif?v={man[name]["v"]} {w}w' for w in ws) + f'" imagesizes="{sizes}" data-img-preload>\n')
            if mob:
                link = (f'<link rel="preload" as="image" type="image/avif" fetchpriority="high" media="{MQ}" imagesrcset="'
                        + ', '.join(f'{prefix}img/{mob}-{w}.avif?v={man[mob]["v"]} {w}w' for w in man[mob]['widths']) + '" imagesizes="100vw" data-img-preload>\n') + link
            t = t.replace('<link rel="stylesheet"', link + '<link rel="stylesheet"', 1)
        open(path, 'w', encoding='utf-8').write(t)
        print('rewrote', page)


if __name__ == '__main__':
    import build                      # _src/ -> minified assets/, before the ?v= hash is taken
    build.build(quiet=True)
    man = encode()
    og(man)
    rewrite(man)
