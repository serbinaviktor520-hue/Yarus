#!/usr/bin/env python3
"""Hand-authored masks for the living photos (assets/live.js).

    python3 tysha/_tools/live_masks.py

Writes tysha/img/<slot>-live.png next to the encoded photos: a small RGB image with the photo's aspect
ratio. Each channel switches on one effect, white = full strength:

  R  water: slow horizontal ripple and a faint shimmer on bright reflections (also mist lying on water)
  G  drift: a slow sideways sway (mist, chimney smoke) or the waver of light caustics
  B  glow:  a lamp that breathes very slightly

Shapes are drawn on the raw 1536x1024 (or 1024x1536) frame. grade.py only scales these slots (no crop,
no rotation), so the masks line up with the graded photos exactly. Edges are feathered so nothing that
should stand still (mullions, people, reeds, the house) is pulled along.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'img'))
LONG = 512                                   # mask long side; the effects are soft, more is waste


def canvas(w, h):
    return [Image.new('L', (w, h), 0) for _ in range(3)]


def feather(im, r):
    return im.filter(ImageFilter.GaussianBlur(r))


def cut(im, boxes, r=4):
    """Zero the given rectangles (feathered) in a channel."""
    m = Image.new('L', im.size, 255)
    d = ImageDraw.Draw(m)
    for b in boxes:
        d.rectangle(b, fill=0)
    m = feather(m, r)
    return Image.fromarray((np.asarray(im, np.float32) * np.asarray(m, np.float32) / 255).astype(np.uint8))


def radial(im, cx, cy, rx, ry, k=1.0):
    w, h = im.size
    y, x = np.ogrid[0:h, 0:w]
    d = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
    v = np.clip(1 - d, 0, 1) ** 1.6 * 255 * k
    return Image.fromarray(np.maximum(np.asarray(im, np.float32), v).astype(np.uint8))


def h08():
    """Hero, wide (stage 3 frontal photo): the lake below the bottom step (y ~598), the reflections included;
    nothing above that line moves (house, steps, the couple, the reeds)."""
    R, G, B = canvas(1536, 1024)
    ImageDraw.Draw(R).rectangle((0, 606, 1536, 1024), fill=255)
    R = feather(R, 4)
    return R, G, B


def h08m():
    """Hero, phones: the mirror lake below the steps (y ~902), not the grass blades along the bottom."""
    R, G, B = canvas(1024, 1536)
    d = ImageDraw.Draw(R)
    d.polygon([(0, 912), (250, 904), (262, 902), (815, 902), (845, 906), (1024, 912), (1024, 1536), (0, 1536)], fill=255)
    R = feather(R, 4)
    m = Image.new('L', R.size, 255)
    dm = ImageDraw.Draw(m)
    dm.polygon([(0, 1250), (120, 1300), (420, 1390), (1024, 1360), (1024, 1536), (0, 1536)], fill=0)   # blades
    dm.polygon([(860, 1290), (1024, 1250), (1024, 1360)], fill=0)
    m = feather(m, 18)
    R = Image.fromarray((np.asarray(R, np.float32) * np.asarray(m, np.float32) / 255).astype(np.uint8))
    return R, G, B


MULLIONS = [(618, 0, 645, 1024), (1228, 0, 1256, 1024)]
# for drift, which moves pixels much further than a ripple: keep well clear of the frames
WIDE_MULLIONS = [(596, 0, 667, 1024), (1206, 0, 1278, 1024)]


def g15():
    """06:10: the mist band over the lake, inside the window, not the pine or the mullions."""
    R, G, B = canvas(1536, 1024)
    ImageDraw.Draw(G).rectangle((560, 440, 1536, 522), fill=255)   # stops above the terrace edge (y ~535)
    G = feather(G, 12)
    G = cut(G, WIDE_MULLIONS + [(0, 0, 575, 1024)], 6)
    return R, G, B


def h03():
    """09:00: the rippled sunlight on the ceiling."""
    R, G, B = canvas(1536, 1024)
    ImageDraw.Draw(G).rectangle((130, 0, 1536, 78), fill=255)
    G = feather(G, 10)
    return R, G, B


LAKE = (640, 468, 1536, 528)   # the lake band inside the long window, above the terrace edge


def h06():
    """19:00: the evening lake in the window (the lamp was taken out of this frame in stage 3)."""
    R, G, B = canvas(1536, 1024)
    ImageDraw.Draw(R).rectangle(LAKE, fill=255)
    R = feather(R, 6)
    R = cut(R, MULLIONS, 2)
    return R, G, B


def h09():
    """23:40: the moon's path on the water."""
    R, G, B = canvas(1536, 1024)
    ImageDraw.Draw(R).ellipse((975, 490, 1125, 600), fill=255)
    R = feather(R, 12)
    R = cut(R, MULLIONS, 2)
    return R, G, B


def g09():
    """Contact, blue hour (stage 3 photo, house left): the open water right of the rocks and the house's reflection,
    the mist lying along the far shore, the chimney smoke; never the house, the steps, the rocks or the trees."""
    R, G, B = canvas(1536, 1024)
    ImageDraw.Draw(R).polygon([(372, 640), (560, 632), (740, 626), (800, 606), (1536, 604), (1536, 1024), (640, 1024),
                               (560, 950), (450, 885), (330, 810), (262, 740), (232, 700), (290, 668)], fill=255)
    R = feather(R, 5)
    R = cut(R, [(220, 600, 380, 676)], 8)                                   # the rock by the steps
    g = ImageDraw.Draw(G)
    g.polygon([(468, 392), (512, 392), (518, 340), (504, 296), (470, 296), (458, 340)], fill=255)   # smoke
    g.rectangle((820, 584, 1536, 604), fill=255)                                                     # mist on the far shore
    G = feather(G, 8)
    return R, G, B


MASKS = {'h08': h08, 'h08m': h08m, 'g15': g15, 'h03': h03, 'h06': h06, 'h09': h09, 'g09': g09}


# the 4:5 phone crops of the day frames (grade.py DAY_M, 2560-frame pixels) get the same cut of their masks
DAY_M = (605, 0, 605 + 1366, 1707)


def main():
    for slot, fn in list(MASKS.items()) + [(d + 'm', None) for d in ('g15', 'h03', 'h06', 'h09')]:
        if fn is None:
            R, G, B = MASKS[slot[:-1]]()
            k = 1536 / 2560
            box = tuple(round(v * k) for v in DAY_M)
            R, G, B = (c.crop(box) for c in (R, G, B))
        else:
            R, G, B = fn()
        im = Image.merge('RGB', (R, G, B))
        s = LONG / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        im.save(os.path.join(OUT, slot + '-live.png'), optimize=True)
        print(slot, im.size, os.path.getsize(os.path.join(OUT, slot + '-live.png')), 'bytes')


if __name__ == '__main__':
    main()
