#!/usr/bin/env python3
"""TYSHA "film" grade: raw renders -> tysha/img/src/<slot>.jpg, one consistent look for the whole set.

    python3 tysha/_tools/grade.py --raw /path/to/raw            # all slots
    python3 tysha/_tools/grade.py --raw /path/to/raw h08 g16    # only these slots
    python3 tysha/_tools/images.py --force                      # then encode for the web
    python3 tysha/_tools/grade.py --day-mobile                  # the 4:5 phone crops of the day frames (after grading)

The raw folder holds the original PNG renders under the names in SLOTS below (they are not committed:
they are large and only this script reads them). Every slot goes through the same chain:

  0. slot-specific fixes at source resolution: crops, the 09:00 lake patch, the 23:40 moon,
     covering scribbled "handwriting" on the pencil plan;
  1. upscale to 2560 px on the long side (3200 for the hero) with Lanczos + a light unsharp mask;
  2. white balance: the warmest renders are cooled a little so the set matches (bedroom -400 K, -20 % sat);
  3. a gentle tone curve: blacks lifted to ~12/255, a soft highlight shoulder;
  4. clarity slightly down, a subtle vignette, fine monochrome grain (sigma ~2.5/255, stronger in shadows).

Geometry is only ever cropped and scaled (never rotated), so masks drawn on the raw frame map onto the
output by the same crop + scale; see live_masks.py.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', 'img', 'src'))

# slot: (raw file, crop box on the raw frame or None, kelvin shift, saturation factor)
SLOTS = {
    'h08': ('v3/hero_gpt.png', None, 0, 1.0),       # stage 3: strictly frontal, steps centred
    'h08m': ('v5/hero_mobile.png', None, 0, 1.0),   # art-directed portrait hero for phones (stage 5: full reflection)
    'g02': ('01_hero_straight.png', (280, 300, 1290, 760), 0, 1.0),
    'g16': ('v4/lull_entrance_tall.png', None, -100, 1.0),   # stage 4: the entrance side of the hero pavilion
    'g16w': ('v4/lull_entrance_wide.png', None, -100, 1.0),  # landscape: the project hero on every screen
    'g15': ('06_day_0610.png', None, 0, 1.0),
    'h03': ('07_day_0900.png', None, 0, 1.0),
    'g14': ('05_day_1430.png', None, 0, 1.0),
    'h06': ('v3/08_day_1900_nolamp.png', None, 0, 1.0),   # lamp removed (see the note on the day lamp below)
    'h09': ('v3/09_day_2340_nolamp.png', None, 0, 1.0),
    'h04': ('v4/lull_aerial.png', None, -150, 1.0),
    'g03': ('v4/lull_plan.png', None, 0, 0.9),
    'g11': ('10_bedroom.png', None, -400, 0.8),
    'h01': ('11_corridor.png', None, 0, 1.0),
    'g09': ('v5/contact.png', None, 0, 1.0),       # stage 5: the hero pavilion at blue hour, house left, dark right half
    'g06': ('13_panorama.png', (420, 0, 1536, 1024), -100, 1.0),
    'h00': ('14_hollow.png', None, 700, 1.05),            # warmed: it read cold grey next to the set
    'g01': ('15_pinecourt.png', None, -100, 1.0),
    'g13': ('16_construction.png', None, -150, 0.92),    # the hi-vis orange is tamed in fixes()
    'g10': ('v4/lull_model.png', (0, 232, 1280, 878), -100, 1.0),   # cropped: no book titles, sheet title or pencil brand
    'h02': ('h02_earth_wall.png', None, -250, 0.92),
    'h05': ('h05_materials.png', None, 0, 1.0),
    'g07': ('g07_meter_aerial.png', None, -200, 1.0),
    'g08': ('g08_architect_meter.png', None, 0, 1.0),
    'g04': ('v3/road.png', None, -450, 0.7),       # misty pine road into the lake valley (portrait), muted
    # Pine Court (stage 4): three travertine-and-larch houses on a pine slope
    'p01': ('v4/pine_hero.png', None, -100, 0.95),
    'p01m': ('v4/pine_hero.png', (60, 0, 879, 1024), -100, 0.95),   # phones: the first house and the woman on its steps
    'p02': ('v4/pine_aerial.png', None, -150, 0.95),
    'p03': ('v4/pine_interior.png', None, -200, 0.95),
    'p04': ('v4/pine_detail.png', None, -100, 0.95),
}
LONG = {'h08': 3200, 'g16w': 3200, 'p01': 3200}
# Heroes are upscaled with a compact Real-ESRGAN model (--sr x4.onnx, made by _tools/esrgan_onnx.py), blended with
# Lanczos so stone keeps its grain; inside these raw-frame boxes (people a few dozen pixels tall) Lanczos alone, since the
# model paints faces. Without --sr every slot uses Lanczos.
SR = {'h08': [(990, 500, 1080, 590)], 'h08m': [(650, 705, 750, 785)], 'g16w': [], 'p01': [(235, 530, 340, 675)]}
SR_MIX = 0.65
# Day lamp (stage 3): the raw 19:00 frame had a mushroom lamp behind the sofa, the 23:40 frame a different drum lamp at
# the left edge, the other hours none. A composite of one lamp into all five frames was tried and rejected (the unlit
# day-time lamp read as pasted), so both lamps were taken out of the raws instead: the wall behind them is the same
# travertine panel from the 14:30 frame (same camera), relit to each frame; at 23:40 the light now falls from a lamp
# just outside the frame, left. The cleaned raws are v3/08_day_1900_nolamp.png and v3/09_day_2340_nolamp.png.
DAY = ('g15', 'h03', 'g14', 'h06', 'h09')        # same camera: identical crop, size and chain


def f32(im):
    return np.asarray(im.convert('RGB'), dtype=np.float32) / 255.0


def img(a):
    return Image.fromarray(np.clip(a * 255.0 + 0.5, 0, 255).astype(np.uint8))


def blur(a, s):
    from scipy.ndimage import gaussian_filter
    return gaussian_filter(a, sigma=(s, s, 0) if a.ndim == 3 else s)


# ---------- 0. slot fixes (raw resolution) ----------
def lake_patch(raw_dir, a):
    """09:00: the water has a scaly AI texture. Take the calm lake of 14:30 (same camera, same pixels),
    regrade it to the warm morning water around it and feather it in, keeping the woman, the mullions
    and the terrace untouched."""
    b = f32(Image.open(os.path.join(raw_dir, '05_day_1430.png')))
    H, W, _ = a.shape
    from PIL import ImageDraw
    yy, xx = np.mgrid[0:H, 0:W]
    lum14 = b.mean(2)
    # water band between the far shore and the terrace edge, right of the left pine
    band = (yy >= 474) & (yy <= 590) & (xx >= 505)
    water = band & (lum14 < 0.70)
    from scipy.ndimage import binary_closing, binary_opening
    water = binary_opening(binary_closing(water, iterations=3), iterations=2)
    # mullions are identical in both frames; keep the morning ones
    for x0, x1 in ((622, 641), (1232, 1252)):
        water[:, x0:x1] = False
    # the woman with her cup
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(930, 438), (908, 449), (898, 477), (888, 505), (873, 512), (864, 545), (862, 610),
                               (1024, 610), (1018, 570), (1003, 563), (998, 545), (993, 522), (995, 512), (993, 500),
                               (985, 487), (961, 484), (961, 470), (954, 444)], fill=255)
    woman = np.asarray(m.filter(ImageFilter.MaxFilter(3))) > 0
    keep = water & ~woman
    # colour transfer: match the 09:00 water statistics (std pulled halfway, the morning glints are part of the look)
    ref = water & ~woman
    out = b.copy()
    for c in range(3):
        ms, ss = b[..., c][ref].mean(), b[..., c][ref].std()
        mt, st = a[..., c][ref].mean(), a[..., c][ref].std()
        k = (0.5 * st + 0.5 * ss) / max(ss, 1e-4)
        out[..., c] = (b[..., c] - ms) * k + mt
    al = blur(keep.astype(np.float32), 2.5)
    al = np.minimum(al, 1 - blur(woman.astype(np.float32), 1.5))[..., None]
    return a * (1 - al) + out * al


def soft_moon(a):
    """23:40: the moon disc is too perfect. Soften its edge and add a faint halo."""
    y0, y1, x0, x1 = 170, 250, 1010, 1090
    reg = a[y0:y1, x0:x1].copy()
    soft = blur(reg, 1.6)
    halo = blur(reg, 7.0)
    lum = reg.mean(2, keepdims=True)
    w = np.clip((lum - 0.25) / 0.5, 0, 1)
    w = blur(w, 3.0)
    a[y0:y1, x0:x1] = reg * (1 - w) + (0.82 * soft + 0.18 * halo) * w + 0.05 * halo
    return a


def paper_cover(a, boxes):
    """Pencil plan: remove the fake handwriting. Pencil strokes inside each box are inpainted from the
    surrounding paper, then the paper's own fine grain is put back from a clean patch."""
    import cv2
    u8 = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    gray = cv2.cvtColor(u8, cv2.COLOR_RGB2GRAY).astype(np.float32)
    med = cv2.medianBlur(gray.astype(np.uint8), 21).astype(np.float32)
    mask = np.zeros(gray.shape, np.uint8)
    for (x0, y0, x1, y1) in boxes:
        sub = (med[y0:y1, x0:x1] - gray[y0:y1, x0:x1]) > 9
        mask[y0:y1, x0:x1][sub] = 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    fill = cv2.inpaint(u8, mask, 6, cv2.INPAINT_TELEA).astype(np.float32) / 255
    # grain from a clean stretch of paper
    clean = a[210:300, 560:700] if a.shape[0] > 300 else a[:90, :140]
    hp = clean - blur(clean, 3)
    tex = np.tile(hp, (a.shape[0] // hp.shape[0] + 1, a.shape[1] // hp.shape[1] + 1, 1))[:a.shape[0], :a.shape[1]]
    al = blur(mask.astype(np.float32) / 255, 2)[..., None]
    return a * (1 - al) + (fill + tex) * al


def soften(a, box, sigma=0.5, feather=4):
    """Hero: the two people on the steps are a few dozen pixels tall and the render smears their faces.
    A very slight blur inside a feathered box reads as natural softness at that distance; the grain
    added later in the chain covers the region like the rest of the frame."""
    x0, y0, x1, y1 = box
    m = np.zeros(a.shape[:2], np.float32)
    m[y0:y1, x0:x1] = 1
    al = blur(m, feather)[..., None]
    return a * (1 - al) + blur(a, sigma) * al


def deep_blue(a):
    """Contact (stage 3): a later blue hour on the right, where the form sits on the photo with no scrim. A graduated
    exposure in linear light on the blue sky and water only (warm stone and lit windows are left alone), stronger to
    the right, so every line of the form keeps >= 4.5:1 against the pixels behind it."""
    H, W, _ = a.shape
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    w = np.clip((a[..., 2] - a[..., 0]) / 0.10, 0, 1)                     # how blue: sky and water 1, stone 0
    w = blur(w, 2.0)
    x = np.linspace(0, 1, W)[None, :]
    g = 0.62 + (0.32 - 0.62) * np.clip((x - 0.30) / 0.28, 0, 1)            # 0.62 over the house, 0.32 right of it
    gain = 1 - w * (1 - g)
    lin = lin * gain[..., None]
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, None), 1 / 2.4) - 0.055)


def tame_orange(a):
    """Construction site: the hi-vis vest and the orange machinery pulled toward the warm, muted set (orange hues only,
    desaturated by ~60 % and a touch darker)."""
    from matplotlib.colors import rgb_to_hsv, hsv_to_rgb
    hsv = rgb_to_hsv(np.clip(a, 0, 1))
    h, sat = hsv[..., 0], hsv[..., 1]
    w = np.clip(1 - np.abs(h - 0.075) / 0.07, 0, 1) * np.clip((sat - 0.58) / 0.12, 0, 1)
    w = blur(w, 1.5)
    hsv[..., 1] = sat * (1 - 0.82 * w)
    hsv[..., 2] = hsv[..., 2] * (1 - 0.2 * w)
    return hsv_to_rgb(hsv)


def fixes(slot, raw_dir, a):
    if slot == 'h08':
        a = soften(a, (1000, 512, 1070, 576), sigma=0.4)   # raw-frame box around the couple
    if slot == 'h08m':
        a = soften(a, (660, 715, 740, 775), sigma=0.4)
    if slot == 'h03':
        a = lake_patch(raw_dir, a)
    if slot == 'g09':
        a = deep_blue(a)
    if slot == 'g13':
        a = tame_orange(a)
    if slot == 'h09':
        a = soft_moon(a)
    return a


# ---------- 1-4. the shared chain ----------
def upscale(a, long_side, sr=None, keep=()):
    im = img(a)
    w, h = im.size
    s = long_side / max(w, h)
    size = (round(w * s), round(h * s))
    lz = f32(im.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.6, percent=45, threshold=2)))
    if not sr:
        return lz
    sys.path.insert(0, HERE)
    from esrgan_onnx import upscale4
    up = f32(upscale4(im, sr).resize(size, Image.LANCZOS))
    m = np.full(size[::-1], SR_MIX, np.float32)
    for (x0, y0, x1, y1) in keep:
        m[round(y0 * s):round(y1 * s), round(x0 * s):round(x1 * s)] = 0
    m = blur(m, 6 * s)[..., None]
    return up * m + lz * (1 - m)


def white_balance(a, kelvin, sat):
    if kelvin:
        k = kelvin / 1000.0   # -0.4 for -400 K: red down ~4.5 %, blue up ~5 %
        a = a * np.array([1 + 0.11 * k, 1 + 0.015 * k, 1 - 0.12 * k], np.float32)
    if sat != 1.0:
        l = (a * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(2, keepdims=True)
        a = l + (a - l) * sat
    return a


def tone(a):
    b = 12 / 255
    t = np.clip((a - 0.7) / 0.3, 0, None)
    f = a - 0.04 * t * t          # soft shoulder: 1.0 -> 0.96, slope stays positive
    return b + (1 - b) * f


def clarity(a, amount=-0.12, s=None):
    s = s or max(a.shape[:2]) / 128
    return a + amount * (a - blur(a, s))


def vignette(a, strength=0.10):
    H, W = a.shape[:2]
    y, x = np.ogrid[-1:1:H * 1j, -1:1:W * 1j]
    r = np.sqrt((x * x + y * y) / 2)
    return a * (1 - strength * r ** 2.2)[..., None]


def grain(a, sigma=2.5 / 255, seed=7):
    rng = np.random.default_rng(seed)
    H, W = a.shape[:2]
    n = rng.standard_normal((H, W)).astype(np.float32)
    n = blur(n, 0.55)
    n /= n.std()
    lum = (a * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(2)
    amp = sigma * (1 + 0.7 * np.clip(1 - lum / 0.5, 0, 1))      # a bit stronger in the shadows
    return a + (n * amp)[..., None]


def grade(slot, raw_dir, sr=None):
    name, box, kelvin, sat = SLOTS[slot]
    a = f32(Image.open(os.path.join(raw_dir, name)))
    a = fixes(slot, raw_dir, a)
    keep = SR.get(slot, [])
    if box:
        a = a[box[1]:box[3], box[0]:box[2]]
        keep = [(x0 - box[0], y0 - box[1], x1 - box[0], y1 - box[1]) for (x0, y0, x1, y1) in keep]
    a = upscale(a, LONG.get(slot, 2560), sr if slot in SR else None, keep)
    a = white_balance(a, kelvin, sat)
    a = tone(np.clip(a, 0, 1))
    a = clarity(a)
    a = vignette(a)
    a = grain(a, seed=7 if slot in DAY else sum(map(ord, slot)))
    out = img(a)
    out.save(os.path.join(SRC, slot + '.jpg'), quality=88, subsampling=0, optimize=True)
    return out.size


# Phones and portrait tablets: the five day frames as 4:5 portraits, one rectangle for all (they stay pixel-aligned while
# they cross-fade): the sofa arm's edge, the table under the window, the bench and the slippers. Cut from the graded
# 2560 px frames (no new grading), in 2560-frame pixels; live_masks.py cuts the masks with the same box.
DAY_M = (605, 0, 605 + 1366, 1707)


def day_mobile():
    for slot in DAY:
        im = Image.open(os.path.join(SRC, slot + '.jpg'))
        im.crop(DAY_M).save(os.path.join(SRC, slot + 'm.jpg'), quality=88, subsampling=0, optimize=True)
        print(slot + 'm', DAY_M)


def main():
    if '--day-mobile' in sys.argv:
        return day_mobile()
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True, help='folder with the raw renders')
    ap.add_argument('--sr', help='Real-ESRGAN x4 .onnx for the heroes (see esrgan_onnx.py)')
    ap.add_argument('slots', nargs='*')
    o = ap.parse_args()
    for slot in o.slots or SLOTS:
        if slot not in SLOTS:
            sys.exit('unknown slot ' + slot)
        print(slot, '<-', SLOTS[slot][0], grade(slot, o.raw, o.sr))


if __name__ == '__main__':
    main()
