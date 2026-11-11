# CLAUDE.md — Brilliant concept landings (YARUS + STRATA)

Owner: Viktor Serbina (Brilliant, premium web design). Language with the owner: **Ukrainian**, short, direct.
These are portfolio / lead-gen concept cases for the real-estate & architecture niche (Behance + vbrilliant.com).

> This file lives in `strata/` because the repo also hosts other projects (e.g. **TYSHA** in `/tysha`, served on its own domains via `vercel.json` rewrites). Do not touch TYSHA or the root `vercel.json` routing when working on STRATA/YARUS.

## What is in this repo (relevant part)

| Path | Project | Live URL |
|---|---|---|
| `/index.html`, `/ua/index.html` | **YARUS** — light residential presale landing (EN / UA) | https://yarus-vercel.vercel.app/ |
| `/strata/index.html`, `/strata/ua/index.html` | **STRATA** — Class A office tower, grey-white (EN / UA) | https://yarus-vercel.vercel.app/strata/ |
| `assets/`, `strata/assets/` | `dc-runtime.js` + images | |
| `vercel.json` | clean URLs, trailing slash, immutable cache on `/assets/*` | |

GitHub: `serbinaviktor520-hue/Yarus` (branch `main`). Vercel project `yarus-vercel` auto-deploys on push to `main` (~1 min).
Static site — no build step. Every push to `main` is live.

## How the pages are built (read before editing)

Each `index.html` is a single self-contained file in the **Claude Design `.dc` format**:
- `<x-dc>` contains `<helmet>` (fonts + one big `<style>`) and the markup template.
- Template syntax: `{{ value }}`, `<sc-for list="{{ arr }}" as="x">`, `<sc-if value="{{ bool }}">`, events as `onClick="{{ fn }}"`.
- Logic lives in `<script type="text/x-dc">` → `class Component extends DCLogic` with `state`, `componentDidMount()` (all scroll/animation code), `componentWillUnmount()` and `renderVals()` (returns everything the template uses).
- `assets/dc-runtime.js` renders it in the browser. Don't remove it.
- EN and UA are **separate files with the same structure** — every change must be applied to both (`strata/index.html` + `strata/ua/index.html`; for YARUS `index.html` + `ua/index.html`). UA files reference assets as `../assets/...`.
- Layout rules are mostly CSS in `<style>`; mobile = `@media (max-width:900px)`. Several later overrides are appended in blocks near the end of the `<style>` (search for comments like `/* striped CTA */`, `/* accent colour */`, `.hfirst{display:contents}` mobile block). Later rules win — check there first.

## STRATA — current design system

- Background grey `#C6C5C1` (desktop) / `#A6A5A1` (mobile, for contrast). Dark blocks `.dk` = `#121212` with grey text. One white block (`.wt`, "From memo to keys").
- **No black text anywhere.** Text is white; secondary parts of headings are semi-transparent white (`.k`, `--k`). Dividers 20 % opacity.
- Headings: **Unbounded 700**, uppercase, tight leading (~0.84). Body: **Manrope** 400–600.
- Accent colour `--ac` (default **pink `#FF5CA8`**). A temporary colour switcher `.asw` (right edge) lets the owner try lime / pink / blue / orange / mint / off — **remove it once a colour is chosen** (markup at end of `<main>`, CSS block `/* accent colour (switcher) */`, JS `setAc` in componentDidMount).
- Brand motif = **logo**: circle cut into horizontal stripes (`.mk`). Reused in: icons (`.ico`, stripes split left/right in a loop), striped CTA buttons (`.sbtn`, `.gp.sb` — stripes slide apart on hover), photo reveals (stripe mask `--sw`), footer wordmark, preloader, popup/menu opening.
- Square corners everywhere (no radius).
- Spacing: 160 between sections (desktop), 120 inside coloured blocks, 64 heading→content, 40 gutters; mobile ≈ 96 / 72 / 40 / 20.

### STRATA sections (top → bottom)
1. **Preloader** — striped circle assembles, closes as a shrinking circle. Skipped once per session (`sessionStorage 'strata-pre'`).
2. **Header** — transparent; hides completely on first scroll. A compact black **mini-header** `.mb` slides in from the top only on scroll-up (past hero). Burger + full-screen **mobile menu** `.mm`.
3. **Hero** (`#top`, two screens) — vertical tower photo + **cut-out tower layer** (`st-hero-cut2.webp`) over the headline so words go behind the building. Desktop: words in a 2×2 grid around the tower (left column right-aligned, right column left-aligned); on scroll the top pair `OFFICES · ABOVE` slides together (JS `hzL`). Then description + striped CTA, 4 advantages with animated icons, big numbers on screen 2. Mobile: title & text up top, CTA pinned to bottom of first screen, cards start on screen 2.
4. **Building** (dark) — manifesto words light up on scroll, B/W facade photo + 4 counters.
5. **Morph** (`#morph`, pinned 360vh) — striped logo circle → splits into tower of 4 blocks → stripes fill the screen into a full photo. Captions: steps 1–2 heading left / figure centre / text right (centred on mobile); step 3 text left + 4 facts + hotspots on the tower (click → Floors).
6. **Floors** (`#tw`, pinned) — scroll switches Podium / Block A / B / C; photo + 3 specs.
7. **Lights on** (dark) — 4 continuity items with icons.
8. **Invest** — calculator (area slider 250–1450 m², pre-launch $2,350 / public $2,750, rent $26/m²/mo, $3,200 at delivery).
9. **Location** — interactive dark SVG map: hover/tap a list item → route draws from STRATA; auto-cycles every 3.2 s.
10. **Marquee** — two lines moving opposite ways, alternating white / white 30 %.
11. **Gardens** — full-screen gallery, 4 slides, autoplay 6 s, swipe on mobile.
12. **Halden Development** (dark) — sticky heading left, numbers 11 / 6 / 310k in a column right, 4 trust rows.
13. **From memo to keys** (white) — 4 steps, progress line on scroll.
14. **FAQ**, 15. **Request the memo** — sentence-form ("I want to [lease ↓] around [300–700 m² ↓]. My name is __, call me on __."), 16. **Footer** (dark) — 3 big CTA bars, striped STRATA wordmark.
- **Popup form** `.mdl` — opens from header / mini-header / hero CTA; photo + form; Esc / backdrop closes.

Animations note: reveal-on-scroll uses `.rv` / `.ln.sv` + `data-in` set by an IntersectionObserver **plus** a fallback sweep (`sweepT`) and an in-iframe fallback (`html.infr`). On mobile `.rv` is forced visible. Keep these fallbacks — without them content stays invisible in some embeds.

## Open items / next steps (owner's backlog)
1. **Mobile pass** — owner is reviewing on a real phone; expect more spacing/size fixes. Check 360 / 390 / 430.
2. Pick the final accent colour → remove `.asw` switcher.
3. Mobile morph step 3 text still says "Hover the points…" but hotspots are hidden on mobile → reword or hide that sentence on mobile.
4. UA hero uses a 4th word for symmetry: «ОФІСИ · НАД / ПАРКОМ · КИЄВА» — owner hasn't confirmed.
5. Hero desktop photo is upscaled ×2 (slightly soft) — replace when owner sends a higher-res render. If the photo changes, regenerate the cut-out PNG/WebP (tower alpha) so the words-behind-tower effect still works.
6. Optional: move STRATA to its own repo/Vercel project (owner creates the repo, then copy `/strata` to root and fix `../assets` paths in UA).
7. Run a final typography & spacing audit (rules: ≤8 text styles, one spacing ladder; big numbers / marquee / wordmark are graphics and may break the scale).

## Workflow conventions
- Make every change in **both languages**, verify at desktop 1440 and mobile 390 (Playwright works well: serve the folder with `python3 -m http.server` and screenshot), check no horizontal overflow, then commit & push to `main`.
- Commit messages: short English summary.
- Keep the owner's references in mind: rayphilly.com, yodezeen.com, era-residence.com, lenvalproperties.com — calm grey/white editorial, bold uppercase grotesk, full-bleed photography, scroll-driven interaction.
- Owner prefers: bold decisions, contrast, no glassmorphism, no black text, square shapes, interactive/scroll-linked moments, one clear visual axis (headings left, secondary column from the page centre).
