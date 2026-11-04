#!/usr/bin/env python3
"""Minify the stylesheet and scripts: tysha/_src/<file> -> tysha/assets/<file>.

The sources in tysha/_src/ are what you edit. The served copies in tysha/assets/ are generated, minified with
esbuild (whitespace, comments, local names; syntax is kept as written, no transpiling) and without source maps.
images.py runs this first and then writes the ?v= hash of the minified files on every <script>/<link>.

esbuild: uses $ESBUILD if set, else `esbuild` on PATH, else `npx --yes esbuild@0.28.2`.
"""
import os, shutil, subprocess, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(SITE, '_src'), os.path.join(SITE, 'assets')
FILES = ['site.css', 'site.js', 'home.js', 'live.js', 'sound.js', 'modal.js', 'fx.js']


def esbuild():
    if os.environ.get('ESBUILD'):
        return [os.environ['ESBUILD']]
    exe = shutil.which('esbuild')
    return [exe] if exe else ['npx', '--yes', 'esbuild@0.28.2']


def build(quiet=False):
    cmd = esbuild()
    for f in FILES:
        src, dst = os.path.join(SRC, f), os.path.join(OUT, f)
        loader = 'css' if f.endswith('.css') else 'js'
        # stdin keeps esbuild in transform mode: no bundling, top-level names stay as they are (pages share globals)
        r = subprocess.run(cmd + ['--minify', '--loader=' + loader, '--legal-comments=none', '--log-level=warning'],
                           stdin=open(src, 'rb'), capture_output=True)
        if r.returncode:
            sys.exit(f'esbuild failed on {f}:\n{r.stderr.decode()}')
        if r.stderr and not quiet:
            print(r.stderr.decode(), file=sys.stderr)
        old = open(dst, 'rb').read() if os.path.exists(dst) else None
        if old != r.stdout:
            open(dst, 'wb').write(r.stdout)
        if not quiet:
            print(f'{f}: {os.path.getsize(src):>6} -> {len(r.stdout):>6} bytes')


if __name__ == '__main__':
    build()
