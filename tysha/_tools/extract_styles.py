#!/usr/bin/env python3
"""Move TYSHA's inline styles into one shared stylesheet (tysha/assets/site.css).

One-shot migration tool, kept for reference. What it does:

1. Collects every `style="..."` attribute in the markup of the five pages.
2. Splits each declaration list into
   - shared tokens: `.label` (Geist Mono, 12px, 0.04em, uppercase) and `.mono` (Geist Mono only);
   - the rest, which becomes one composite class per unique declaration set (deduped across pages).
   Each element ends up with a short class list, e.g. `class="label sec-head"`.
3. Takes the page `<style>` blocks (identical on every page, home is a superset) and rewrites every
   `[style*="..."]` substring selector to `:is(.a,.b,...)`, the exact set of classes whose source
   declarations contained that substring. Specificity stays (0,1,0), so the cascade is unchanged.
   The rewrite is verified element by element on every page before anything is written.
4. Emulates the old "inline beats stylesheet" priority with cascade layers: the hand-written CSS
   goes into `@layer base`, the generated classes are unlayered and therefore win over any normal
   declaration in `base`, exactly like inline styles did; `!important` rules in `base` still win.

Run from the repo root:  python3 tysha/_tools/extract_styles.py
It refuses to run when the pages have no inline styles left (already converted).
"""
import collections, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PAGES = ['index.html', 'project/index.html', 'method/index.html', 'privacy/index.html', '404/index.html']
MONO = "font-family: 'Geist Mono', monospace"
AXIS_LEFT = 'left: calc(20px + (100% - 40px) * 5 / 12)'

# Shared tokens, applied in this order when ALL their declarations are present on an element.
# They carry the design system: type styles, the 12-column grid, the centre axis, tones.
TOKENS = [
    ('label', [MONO, 'font-size: 12px', 'letter-spacing: 0.04em', 'text-transform: uppercase']),
    ('mono', [MONO]),
    ('grid-12', ['display: grid', 'grid-template-columns: repeat(12, minmax(0, 1fr))', 'column-gap: 20px']),
    ('axis', ['position: absolute', 'top: 0', 'bottom: 0', AXIS_LEFT, 'width: 1px']),
    ('fill', ['position: absolute', 'inset: 0']),
    ('cover', ['width: 100%', 'object-fit: cover', 'display: block']),
    ('display', ['font-size: clamp(48px, 6.6vw, 104px)', 'font-weight: 500', 'line-height: 1.02', 'letter-spacing: -0.045em']),
    ('h-xl', ['font-size: 72px', 'font-weight: 500', 'line-height: 0.96', 'letter-spacing: -0.04em']),
    ('h-l', ['font-size: 56px', 'font-weight: 500', 'line-height: 0.98', 'letter-spacing: -0.035em']),
    ('quote', ['font-size: 40px', 'font-weight: 400', 'line-height: 1.12', 'letter-spacing: -0.03em']),
    ('h-m', ['font-size: 40px', 'font-weight: 500', 'letter-spacing: -0.03em']),
    ('h-s', ['font-size: 32px', 'font-weight: 500', 'letter-spacing: -0.03em']),
    ('time', ['font-size: 32px', 'font-weight: 400', 'letter-spacing: -0.02em', 'font-variant-numeric: tabular-nums']),
    ('num-xl', ['font-size: 160px', 'font-weight: 300', 'letter-spacing: -0.05em']),
    ('num-l', ['font-size: 88px', 'font-weight: 300', 'letter-spacing: -0.05em']),
    ('num-m', ['font-size: 56px', 'font-weight: 300', 'letter-spacing: -0.04em', 'line-height: 1']),
    ('big', ['font-size: 104px', 'font-weight: 300', 'line-height: 0.9', 'letter-spacing: -0.05em']),
    ('body-l', ['font-size: 20px', 'line-height: 1.45']),
    ('body', ['font-size: 16px', 'line-height: 1.45']),
    ('tone-2', ['color: #C9C3B8']),
    ('tone-3', ['color: #8C8781']),
    ('tone-4', ['color: #6B665F']),
    ('tone-5', ['color: #7F7A73']),
    ('tone-6', ['color: #5A554E']),
    ('u', ['text-decoration: underline']),
]
TOKEN_NAMES = {n for n, _ in TOKENS}

# Names for composites (what is left after tokens) with a clear role; keys are the joined
# declarations. Everything else gets a descriptive auto name from feature().
NAMES = {
    'position: relative; display: flex; justify-content: space-between': 'sec-head',
    'position: relative; box-sizing: border-box; padding: 20px 20px 120px; background: #EAE6DE; color: #2E2D2B': 'sec-paper',
    'position: relative; box-sizing: border-box; padding: 20px 20px 120px; background: #111110; color: #EAE6DE': 'sec-ink',
    'position: relative; box-sizing: border-box; padding: 20px 20px 120px; background: #DCD5C9; color: #2E2D2B': 'sec-sand',
    'position: relative; box-sizing: border-box; padding: 20px 20px 120px; background: #EAE6DE; color: #2E2D2B; border-top: 1px solid #D8CFC1': 'sec-paper-rule',
    'position: relative; box-sizing: border-box; padding: 20px 20px 0; background: #EAE6DE; color: #2E2D2B': 'sec-paper-open',
    'position: relative; overflow: hidden; box-sizing: border-box; padding: 20px; background: #0B0B0A; color: #EAE6DE': 'site-foot',
    'width: 100%; background: #111110; color: #EAE6DE; font-family: \'Inter Tight\', sans-serif; overflow: hidden': 'site',
    'background: #C2AE8E': 'axis-tan', 'background: #B8A78A': 'axis-tan-2',
    'background: rgba(234, 230, 222, 0.4)': 'axis-light', 'background: rgba(234, 230, 222, 0.35)': 'axis-light-2',
    'background: rgba(234, 230, 222, 0.22)': 'axis-dim', 'background: rgba(234,230,222,0.18)': 'axis-faint',
    'position: relative; margin-top: 120px': 'mt-120', 'position: relative; margin-top: 80px': 'mt-80',
    'margin: 0': 'm-0', 'position: relative': 'rel',
    'border-bottom: 1px solid #EAE6DE; padding-bottom: 4px': 'link-line',
    'justify-self: end; border-bottom: 1px solid #2E2D2B; padding-bottom: 4px': 'link-line-dark-end',
    'justify-self: end; border-bottom: 1px solid #EAE6DE; padding-bottom: 4px': 'link-line-end',
    'aspect-ratio: 4 / 5': 'ar-45', 'aspect-ratio: 4 / 3': 'ar-43', 'aspect-ratio: 3 / 4': 'ar-34',
    'display: flex; flex-direction: column': 'stack', 'display: flex; flex-direction: column; gap: 16px': 'stack-16',
    'display: flex; flex-direction: column; gap: 24px': 'stack-24', 'display: flex; flex-direction: column; gap: 8px': 'stack-8',
    'line-height: 1.45': 'lh-145', 'line-height: 1.6': 'lh-16', 'padding-left: 20px': 'pl-20',
    'display: flex; justify-content: space-between': 'split', 'display: flex; justify-content: space-between; align-items: baseline': 'split-base',
    'text-transform: uppercase': 'caps', 'text-transform: none': 'case-none',
    'all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid rgba(234,230,222,0.3); color: rgba(234,230,222,0.6); min-height: 44px; transition: color 0.4s ease, border-color 0.4s ease': 'day-btn',
    'all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid #EAE6DE; color: #EAE6DE; min-height: 44px; transition: color 0.4s ease, border-color 0.4s ease': 'day-btn-on',
    'all: unset; border-bottom: 1px solid #EAE6DE; padding: 10px 0; font-family: \'Inter Tight\', sans-serif; font-size: 20px; text-transform: none; letter-spacing: 0; min-height: 28px; transition: border-color 0.3s': 'field',
    'all: unset; cursor: pointer; padding: 16px 36px; border: 1px solid #EAE6DE; border-radius: 999px; font-variant-numeric: tabular-nums; transition: background 0.3s, color 0.3s': 'btn-send',
    'height: 100%; object-position: center 60%; opacity: 0; transform: scale(1.08); transition: opacity 0.9s ease, transform 2.4s cubic-bezier(.2,.7,.2,1)': 'day-img',
    'height: 100%; object-position: center 60%; opacity: 1; transform: scale(1); transition: opacity 0.9s ease, transform 2.4s cubic-bezier(.2,.7,.2,1)': 'day-img-on',
    'will-change: transform; height: 100%; object-position: center 30%': 'hero-img',
    'will-change: transform; height: 100%; object-position: center 55%': 'hero-img-2',
    'background: linear-gradient(180deg, rgba(17,17,16,0.55) 0%, rgba(17,17,16,0.05) 35%, rgba(17,17,16,0.1) 60%, rgba(17,17,16,0.75) 100%)': 'shade-hero',
    'z-index: 2; visibility: hidden; overflow: hidden; background: #111110': 'st-layer',
    'position: absolute; inset: 20px; display: flex; flex-direction: column; justify-content: space-between; color: #EAE6DE; opacity: 0': 'st-over',
    'display: inline-block; vertical-align: middle; width: 2.1em; height: 0.82em; border-radius: 999px; object-fit: cover': 'pill-img',
    'display: inline-block; vertical-align: middle; width: 1.6em; height: 0.82em; border-radius: 999px; object-fit: cover': 'pill-img-s',
    'display: inline-block; vertical-align: middle; width: 1.9em; height: 0.82em; border-radius: 999px; object-fit: cover': 'pill-img-m',
    'color: rgba(234,230,222,0.62)': 'tone-dim', 'text-align: right': 'ta-r', 'justify-self: end; text-align: right': 'end-r',
    'line-height: 0.85': 'lh-085', 'line-height: 1': 'lh-1', 'line-height: 0.9': 'lh-09', 'margin-left: 8px': 'ml-8',
    'display: flex; gap: 80px; white-space: nowrap; line-height: 1; will-change: transform': 'marquee',
    'all: unset; cursor: pointer; color: #C9C3B8; border-bottom: 1px solid rgba(234,230,222,0.4); padding-bottom: 4px': 'btn-again',
    'display: grid; grid-template-columns: 48px 1fr auto; align-items: baseline; padding: 18px 0; border-bottom: 1px solid rgba(234,230,222,0.4)': 'link-row',
    'display: grid; grid-template-columns: 48px 1fr auto; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(234,230,222,0.4)': 'step-row',
    'position: relative; height: 1px; background: rgba(234,230,222,0.2); margin-bottom: -1px': 'day-track',
    'background: #C2AE8E; transform-origin: left; transform: scaleX(0)': 'day-bar',
    'display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); column-gap: 20px': 'day-grid',
    'accent-color: #C2AE8E; width: 16px; height: 16px; margin: 0': 'radio',
    'display: flex; align-items: center; gap: 8px; min-height: 44px': 'radio-label',
    'border: 0; margin: 0; padding: 0; display: flex; gap: 24px; flex-wrap: wrap': 'fieldset',
    'padding: 0; margin-bottom: 12px': 'legend',
    'display: none; color: #E8A68C; text-transform: none; letter-spacing: 0; font-family: \'Inter Tight\', sans-serif; font-size: 15px': 'field-err',
    'display: none; margin: 0; padding: 16px 0 0; border-top: 1px solid #E8A68C; font-size: 17px; line-height: 1.45; color: #EAE6DE': 'form-fail',
    'position: relative; line-height: 1.45': 'site-head',
    'position: relative; width: 100%; height: auto; display: block; color: #EAE6DE': 'hero-wm',
    'position: relative; margin-top: 40px; display: block; width: 100%; height: auto': 'foot-wm',
    'position: relative; overflow: hidden; background: #111110; color: #EAE6DE; padding: 40px 0; border-bottom: 1px solid rgba(234,230,222,0.15)': 'marquee-band',
    'display: flex; align-items: center; gap: 16px': 'brand',
    'display: flex; gap: 24px; flex-wrap: wrap; padding-left: 20px': 'nav-main',
}


def decls(s):
    return [d.strip() for d in s.split(';') if d.strip()]


def split_tokens(ds):
    """-> (token class names, remaining declarations)."""
    toks, rest = [], list(ds)
    if 'all: unset' in rest:  # `all` would reset whatever a token set: keep the block whole
        return toks, rest
    for name, group in TOKENS:
        if name == 'mono' and 'label' in toks: continue
        if all(g in rest for g in group):
            toks.append(name); rest = [x for x in rest if x not in group]
    gc = [x for x in rest if x.startswith('grid-column: ')]
    if gc:
        toks.insert(0, 'col-' + '-'.join(re.findall(r'\d+', gc[0]))); rest.remove(gc[0])
    return toks, rest


def feature(ds, tag):
    """Short descriptive name parts for an unnamed composite."""
    d = dict(x.split(': ', 1) for x in ds)
    parts = []
    gtc = d.get('grid-template-columns', '')
    m = re.match(r'repeat\((\d+)', gtc)
    if m: parts.append('grid-' + m.group(1))
    elif gtc: parts.append('grid')
    if 'grid-column' in d:
        a = re.findall(r'\d+', d['grid-column']); parts.append('col-' + '-'.join(a))
    if tag in ('h1', 'h2', 'h3'): parts.append('h')
    if tag == 'blockquote': parts.append('quote')
    if tag == 'img': parts.append('img')
    fs = d.get('font-size', '')
    if fs.endswith('px') and fs[:-2].isdigit(): parts.append('fs-' + fs[:-2])
    elif fs.startswith('clamp'): parts.append('fs-fluid')
    elif fs.endswith('vw'): parts.append('fs-' + fs.replace('.', ''))
    if d.get('display') == 'flex': parts.append('stack' if d.get('flex-direction') == 'column' else 'row')
    if d.get('display') == 'none': parts.append('hidden')
    if d.get('position') == 'absolute' and d.get('inset') == '0': parts.append('fill')
    elif d.get('position') in ('absolute', 'fixed'): parts.append(d['position'][:3])
    for k, p in (('height', 'h-'), ('margin-top', 'mt-'), ('aspect-ratio', 'ar-')):
        v = d.get(k, '')
        if v.endswith('px'): parts.append(p + v[:-2])
        elif k == 'aspect-ratio' and v: parts.append(p + re.sub(r'\D', '', v))
    if 'background' in d and not parts: parts.append('bg')
    if 'color' in d and len(parts) < 2: parts.append('c')
    if not parts: parts.append(tag)
    return '-'.join(parts[:3])


def main():
    srcs = {p: open(os.path.join(ROOT, p), encoding='utf-8').read() for p in PAGES}
    rx = re.compile(r'<(\w+)((?:[^<>"]|"[^"]*")*?)\sstyle="([^"]*)"')

    def body_ranges(t):
        """(start, end) spans of markup outside <script> blocks in <body>."""
        b = t.index('<body'); spans = []; pos = b
        for m in re.finditer(r'<script\b.*?</script>', t[b:], flags=re.S):
            spans.append((pos, b + m.start())); pos = b + m.end()
        spans.append((pos, len(t)))
        return spans

    elems = []  # (page, tag, raw style)
    for p, t in srcs.items():
        for a, z in body_ranges(t):
            for m in rx.finditer(t, a, z):
                elems.append((p, m.group(1), m.group(3)))
    if not elems:
        sys.exit('No inline styles left: pages already converted.')

    # composites keyed by remaining declaration set
    comp_tags = collections.defaultdict(set); comp_count = collections.Counter()
    for p, tag, s in elems:
        toks, rest = split_tokens(decls(s))
        if rest:
            k = '; '.join(rest); comp_tags[k].add(tag); comp_count[k] += 1
    names, used = {}, set()
    for k in sorted(comp_tags, key=lambda k: (k not in NAMES, -comp_count[k])):
        n = NAMES.get(k) or feature(k.split('; '), sorted(comp_tags[k])[0])
        base, i = n, 2
        while n in used: n = f'{base}-{i}'; i += 1
        used.add(n); names[k] = n
    def classes_for(s):
        toks, rest = split_tokens(decls(s))
        return toks + ([names['; '.join(rest)]] if rest else [])

    # ---- legacy CSS (identical across pages; home is a superset) ----
    css_home = re.findall(r'<style>(.*?)</style>', srcs['index.html'][:srcs['index.html'].index('</head>')], flags=re.S)
    legacy = '\n'.join(c.strip() for c in css_home)
    for p, t in srcs.items():
        for c in re.findall(r'<style>(.*?)</style>', t[:t.index('</head>')], flags=re.S):
            for line in c.strip().splitlines():
                if line.strip() and line.strip() not in legacy:
                    sys.exit(f'{p}: CSS line not present on home: {line}')

    # ---- rewrite [style*="X"] selectors ----
    full_by_class = collections.defaultdict(set)  # composite name -> raw styles
    for p, tag, s in elems:
        for c in classes_for(s): full_by_class[c].add(s)
    problems = []

    def rewrite(m):
        x = m.group(1)
        hit = sorted(c for c, ss in full_by_class.items() if all(x in s for s in ss))
        ok = all((x in s) == any(c in hit for c in classes_for(s)) for p, tag, s in elems)
        if hit and ok:
            return ':is(' + ','.join('.' + c for c in hit) + ')'
        # the substring spans several classes: fall back to the exact compound class lists
        combos = sorted({'.' + '.'.join(classes_for(s)) for p, tag, s in elems if x in s})
        if not combos:
            problems.append((x, 'no element')); return m.group(0)
        notes.append(f'compound selector for [style*="{x}"]: {combos}')
        return ':is(' + ','.join(combos) + ')'
    notes = []
    legacy = re.sub(r'\[style\*="([^"]+)"\]', rewrite, legacy)
    if problems:
        for pr in problems: print('UNMAPPED', pr)
        sys.exit(1)
    for n in notes: print('note:', n)

    # ---- generated classes ----
    def rule(name, ds): return f'.{name}{{' + ';'.join(d.replace(': ', ':', 1) for d in ds) + '}'
    used_toks = {c for p, tag, s in elems for c in classes_for(s)}
    gen = ['/* tokens: type, grid, axis, tones */']
    gen += [rule(n, g) for n, g in TOKENS if n in used_toks]
    cols = sorted({c for c in used_toks if c.startswith('col-')}, key=lambda c: [int(x) for x in c[4:].split('-')])
    gen += [rule(c, ['grid-column: ' + ' / '.join(c[4:].split('-'))]) for c in cols]
    gen.append('/* components */')
    gen += [rule(names[k], k.split('; ')) for k in sorted(names, key=lambda k: names[k])]

    # ---- write HTML ----
    for p, t in srcs.items():
        out, pos = [], 0
        for a, z in body_ranges(t):
            out.append(t[pos:a]); seg = t[a:z]
            def sub(m):
                attrs, cls = m.group(2), ' '.join(classes_for(m.group(3)))
                cm = re.search(r'\sclass="([^"]*)"', attrs)
                if cm:
                    attrs = attrs[:cm.start()] + f' class="{cm.group(1)} {cls}"' + attrs[cm.end():]
                    return f'<{m.group(1)}{attrs}'
                return f'<{m.group(1)}{attrs} class="{cls}"'
            out.append(rx.sub(sub, seg)); pos = z
        out.append(t[pos:])
        html = ''.join(out)
        # head: drop the page <style> blocks, link the shared stylesheet
        head_end = html.index('</head>')
        head = re.sub(r'\n?<style>.*?</style>\n?', '\n', html[:head_end], flags=re.S)
        depth = p.count('/')
        href = ('../' * depth) + 'assets/site.css' if p != '404/index.html' else 'assets/site.css'
        head = head.rstrip('\n') + f'\n<link rel="stylesheet" href="{href}">\n'
        html = head + html[head_end:]
        html = html.replace('[style*="Geist Mono"], [data-scramble]', '.mono, .label, [data-scramble]')
        open(os.path.join(ROOT, p), 'w', encoding='utf-8').write(html)

    css = ('/* TYSHA — shared stylesheet\n'
           '   1. base: hand-written rules (layered, so the component classes below win over them,\n'
           '      the way the old inline styles did; !important rules here still win)\n'
           '   2. components: classes extracted from the former inline styles (_tools/extract_styles.py)\n'
           '*/\n@layer base {\n' + legacy + '\n}\n\n/* ---- 2. components ---- */\n' + '\n'.join(gen) + '\n')
    open(os.path.join(ROOT, 'assets/site.css'), 'w', encoding='utf-8').write(css)
    print(f'{len(elems)} inline styles -> {len(names)} component classes + {len([n for n, _ in TOKENS if n in used_toks])} tokens')


if __name__ == '__main__':
    main()
