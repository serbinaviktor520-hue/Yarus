# TYSHA tools

The files in `tysha/` are the source. Edit the HTML, `assets/site.css` and `assets/*.js` directly.
These scripts only do the repetitive parts.

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
  `assets/home.js` when the day section approaches;
- points the footer wordmark photo at the 1600 px JPEG and cuts `img/og.jpg` (1200×630, the social
  card) from the home hero `h08`.

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
pencil plan inpainted), Lanczos upscale to 2560 px (3200 for the hero) with a light unsharp mask, cooling of
the warmest renders, a tone curve with blacks lifted to ~12/255 and a soft shoulder, slightly lower
clarity, a subtle vignette and fine monochrome grain. It only crops and scales, never rotates, so masks
drawn on a raw frame map onto the output (`live_masks.py`).

## Phone crops: `<name>m`

A source named `<name>m.jpg` (for example `h08m.jpg`, the portrait hero) is an art-directed version of
`<name>` for screens up to 760 px. `images.py` encodes it like any other source and adds it to every
`<picture data-img="<name>">` as the first `<source media="(max-width: 760px)">` pair, so phones never
download the wide photo. For the page hero it writes two preloads with `media` attributes, one per crop.
Other photos keep one file and get a phone `object-position` in `site.css` (section 11).

## Icons: `icons.py`

`python3 tysha/_tools/icons.py` draws `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png` and `site.webmanifest` from the "A" house mark.

## Styles: `extract_styles.py`

One-shot migration that moved the old inline styles into `assets/site.css`. Kept for reference;
it refuses to run now that the pages have no inline styles.

## Moving to tysha.studio

All internal links are relative, so the site works at any path. When the domain is live:

- `404/index.html`: change `<base href="/tysha/">` to `<base href="/">`;
- `og:image` / `twitter:image` in every page head use the root-relative `/tysha/img/og.jpg`:
  change to `https://tysha.studio/img/og.jpg` (absolute URLs are best for social cards);
- add `<link rel="canonical" href="https://tysha.studio/…">` to each page (left out on purpose
  until the domain exists, so no page points at a URL that does not resolve);
- `sitemap.xml` already uses `https://tysha.studio/`; move it and `robots.txt` to the domain root;
- `vercel.json` (repo root): the `/tysha/` routes become `/` routes. The last route serves
  `404/index.html` with status 404 for unknown paths; `routes` is used because `rewrites` cannot
  set a status code, and `routes` cannot be combined with `cleanUrls` / `trailingSlash` /
  `headers`, so those are expressed as routes too.
