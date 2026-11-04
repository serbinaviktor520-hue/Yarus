# TYSHA tools

The pages in `tysha/` are the source. Edit the HTML directly; edit the stylesheet and scripts in `tysha/_src/`
(`site.css`, `site.js`, `home.js`, `live.js`, `sound.js`, `modal.js`), never in `tysha/assets/`.
These scripts only do the repetitive parts.

## Build: `build.py`

`tysha/assets/*.css|js` are generated: `build.py` minifies `tysha/_src/<file>` into `tysha/assets/<file>` with
esbuild (comments, whitespace and local names only; the syntax is kept as written, no source maps).
`images.py` runs it first, so after any change run, from the repo root:

```sh
python3 tysha/_tools/images.py      # build + photos + ?v= hashes on every page
```

It uses `$ESBUILD`, an `esbuild` on PATH, or `npx --yes esbuild@0.28.2`.

`images.py` finds every page by itself (all `index.html` under `tysha/`, nested folders included) and ends with a
check that fails the run if any page carries a `?v=` other than the current one on a script or stylesheet, if a
footer wordmark has lost its `data-href`, or if a doubled `data-data-` attribute appears. `tysha/_src/` is not deployed
(`.vercelignore`). Commit both `_src/` and the built `assets/`, since Vercel serves the repo as it is.

## Photos: `images.py`

Workflow for new or replaced photos (for example the 3200 px renders):

1. Put the files in `tysha/img/src/`. Keep the existing file names (`h08.jpg`, `g16.jpg`, …) to
   replace a photo everywhere it is used. JPEG or PNG; any size, wider is better.
2. Run, from the repo root:

   ```sh
   pip install pillow pillow-avif-plugin   # once; Pillow 11+ already includes AVIF
   python3 tysha/_tools/images.py
   ```

3. Commit `tysha/img/` and the pages.

What it does:

- encodes every source to `tysha/img/<name>-<width>.avif` and `.webp` at 480, 960, 1600 and
  2560 px wide, never larger than the source (a source between steps also gets its own width),
  plus one `.jpg` fallback (the largest width up to 1600);
- only re-encodes sources that are newer than their outputs (`--force` re-encodes all) and deletes
  outputs for widths that no longer apply;
- rewrites every page: each photo is a `<picture data-img="name">` with AVIF/WebP `srcset`,
  `sizes`, `width`/`height` (from the source, to prevent layout shift) and `loading="lazy"
  decoding="async"`. The hero (`data-hero-img`) loads eagerly with `fetchpriority="high"` and a
  `<link rel="preload">` in the head; the four hidden day photos (`data-defer`) are loaded by
  `home.js` when the day section approaches;
- points the footer wordmark photo at the 1600 px JPEG and cuts `img/og.jpg` (1200×630, the social
  card) from the home hero `h08`.

- writes `?v=<8 hex of the source's hash>` on every image URL (the files keep their names; `img/` is cached for a
  week, so a replaced photo needs a new URL) and `data-tone="#rrggbb"`, the photo's average colour, on every `<img>`.

`site.js` paints each photo's tone behind it until the photo arrives, starts every lazy photo ~1.8 viewports
before it reaches the screen (eager, low priority, decoded off-thread) and opens a photo's reveal only once it is
decoded. That warm-up matters: a lazy `<img>` under the reveal's `clip-path: inset(100% …)` has no visible area, so
the browser's own lazy loader would not start it until it was already on screen.

`sizes` were measured from the layout. If you move a photo into a slot of a different width, edit
the `sizes` attribute on its `<source>` tags; the script keeps whatever is there.

To add a new photo to a page, write a plain `<img src="img/<name>.jpg" alt="…" class="…"
sizes="…">` (or `../img/` in a subpage) and run the script: it becomes a `<picture>`.

## Film grade: `grade.py`

The photos share one "film" look. `grade.py` makes `img/src/<slot>.jpg` from the raw renders:

```sh
python3 tysha/_tools/grade.py --raw /path/to/raw          # every slot, or name slots: ... h08 g16
python3 tysha/_tools/images.py --force
```

The raw PNGs are not committed (large; only this script reads them). `SLOTS` at the top of the script maps
each slot to its raw file, crop box, white-balance shift and saturation. The chain: slot fixes at raw size
(crops, the calm 14:30 lake patched into the 09:00 frame, a softer 23:40 moon, the scribbled notes on the
pencil plan inpainted, a very slight softening of the two tiny people on the hero steps in `h08` / `h08m`), Lanczos upscale to 2560 px (3200 for the two heroes, `h08` and `g16w`) with a light unsharp mask, cooling of
the warmest renders, a tone curve with blacks lifted to ~12/255 and a soft shoulder, slightly lower
clarity, a subtle vignette and fine monochrome grain. It only crops and scales, never rotates, so masks
drawn on a raw frame map onto the output (`live_masks.py`).

## Phone crops: `<name>m`

A source named `<name>m.jpg` (for example `h08m.jpg`, the portrait hero) is an art-directed version of
`<name>` for screens up to 760 px. `images.py` encodes it like any other source and adds it to every
`<picture data-img="<name>">` as the first `<source media="(max-width: 760px)">` pair, so phones never
download the wide photo. For the page hero it writes two preloads with `media` attributes, one per crop.
Other photos keep one file and get a phone `object-position` in `site.css` (section 11).

`g16w` (the landscape view of Lull House from the forest, `02_forest_landscape.png`) is the project hero
on every screen: phones show its centre, the door, so its `sizes` there is `220vw`. The portrait `g16` stays
for the home card, the statement pill and the entrance row of the plan.

Full-bleed photos behind the centre axis can carry `data-axis-gap="top bottom"` (fractions of the image
height) on the `<img>`: `site.js` maps it through `object-fit: cover` and stops the line there, so it never
crosses a building. Drawn type (`svg[role=img]`, the wordmarks) stops it too.

## Living photos: `live_masks.py`

`live.js` animates one element of a few photos (hero lake, the day frames, the blue-hour contact
photo) with a small WebGL shader while they are on screen. Where it acts is set by a mask per photo,
`img/<name>-live.png`, drawn by `python3 tysha/_tools/live_masks.py` on the raw frame geometry:
R = water ripple and shimmer, G = drift or waver (mist, smoke, caustics), B = a lamp that breathes.
Strengths are in the `FX` table at the top of `live.js`. If you re-crop one of these photos in
`grade.py`, redraw its mask. Nothing runs under reduced motion, Save-Data or without WebGL.

## Sound: `sound.js`

Opt-in from the header toggle; the file loads only when sound is switched on. All sound is synthesised
(Web Audio), so there are no audio files. The scenes (city, forest, the five hours of the day section)
are arrays near the bottom of the file.

## Icons: `icons.py`

`python3 tysha/_tools/icons.py` draws `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png` and `site.webmanifest` from the "A" house mark.

## Styles: `extract_styles.py`

One-shot migration that moved the old inline styles into `site.css` (now `_src/site.css`). Kept for reference;
it refuses to run now that the pages have no inline styles.

## Moving to tysha.studio

`https://tysha.studio/` is a placeholder domain: it is not bought yet. It is already written into
`og:image`, `twitter:image`, `og:url` and `<link rel="canonical">` in every page head (the 404 page has
no canonical or `og:url`, on purpose) and into `sitemap.xml`. **If the studio ends up on another domain,
search for `tysha.studio/` and swap it everywhere** (pages, `sitemap.xml`, `robots.txt`). All internal
links are relative, so the site works at any path. When the domain is live:

- `404/index.html`: change `<base href="/tysha/">` to `<base href="/">`;
- move `sitemap.xml` and `robots.txt` to the domain root;
- `vercel.json` (repo root): the `/tysha/` routes become `/` routes. The last route serves
  `404/index.html` with status 404 for unknown paths; `routes` is used because `rewrites` cannot
  set a status code, and `routes` cannot be combined with `cleanUrls` / `trailingSlash` /
  `headers`, so those are expressed as routes too.

## Experiments: `_src/fx.js` (branch fx-depth)

Loaded by `site.js` only after `?fx=depth` (remembered for the tab in sessionStorage, `?fx=off` clears it); without
the flag nothing of it runs. "Quiet depth" hinges sections a few degrees at their boundary, eased over the whole viewport;
"Curtain" is hover only: the hovered photo becomes silk in a breeze from the pointer's side
(a perspective mesh with diagonal travelling folds and a billowing edge), then hands back to the plain <img>. Desktop and tablet with a fine pointer, never under reduced motion,
never on a software renderer (`?live=force` overrides, for testing). All amplitudes are the constants at the top.
