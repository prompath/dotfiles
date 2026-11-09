"""Draws sleigh.gif, and its frames for the mod in sleigh/: Claude in a sleigh pulled by reindeer, over snowy pines.

Same canvas, loop and writer as broom.py. Run: python3 sleigh.py
"""

import math

from broom import BODY, FRAMES, H, PAINT, W, hash2, lerp, main, merge

PAINT = {
    **PAINT,
    'R': (196, 40, 44),  # sleigh and hat red
    'r': (140, 26, 30),  # red shade
    'W': (240, 240, 240),  # hat fur
    'Y': (226, 180, 70),  # gold trim
    'y': (170, 128, 44),  # gold shade
    'B': (128, 84, 48),  # reindeer
    'b': (190, 150, 106),  # reindeer belly and tail
    'L': (96, 62, 34),  # legs
    'k': (36, 26, 20),  # hooves, eye, nose
    'A': (214, 196, 160),  # antlers
    'C': (170, 30, 34),  # collar
}
# a Santa hat, its tip trailing back; the brim sits over the body's top row
HAT = [
    'WW..............',
    'WWRRR...........',
    '..RrRRRR........',
    '...RrRRRRRR.....',
    '....rRRRRRRR....',
    '..WWWWWWWWWWWW..',
]
SLEIGH = [
    'YY........................',
    'RRY.......................',
    'RRRY..................YYY.',
    'RRRRY................Y...Y',
    'RRRRRRRRRRRRRRRRRRRRRY..Y.',
    'YYYYYYYYYYYYYYYYYYYYYY....',
    'RRRRRRRRRRRRRRRRRRRRRR....',
    'rRRRRRRRRRRRRRRRRRRRRY....',
    '.rrrrrrrrrrrrrrrrrrrY.....',
    '...y........y.......y.....',
    'yYYYYYYYYYYYYYYYYYYYYYY..y',
    '.yyyyyyyyyyyyyyyyyyyyyyyy.',
]
REINDEER = [
    '...........A..A..',
    '..........A.AA.A.',
    '...........AAA...',
    '............BBB..',
    '............BkBBk',
    '...........CBBBB.',
    'b..........CB....',
    'bBBBBBBBBBBBB....',
    '.BBBBBBBBBBBB....',
    '.BBBBBBBBBBB.....',
    '..bbbbbbbbb......',
]
# a gallop: legs reach, gather under, push off; 2 frames a pose, 8 a stride
GALLOP = [
    ['.L........L......', 'L..........L.....', 'k...........k....'],
    ['..L.......L......', '..L.......L......', '..k.......k......'],
    ['...L.....L.......', '....L...L........', '....k...k........'],
    ['..L.......L......', '.L.........L.....', '.k..........k....'],
]
DEER = 3
REIN = (110, 74, 40)
SNOW = (236, 240, 248)


def pine(put, cx, base, height, dark, lit):
    """Three stacked tiers on a trunk, snow along each tier's upper slope."""
    trunk = height // 6
    for y in range(base - trunk, base):
        for x in (cx - 1, cx, cx + 1):
            put(x, y, (60, 44, 32))
    tier = (height - trunk) / 3
    for t in range(3):
        top = base - trunk - height + trunk + round(t * tier * 0.7)
        bottom = top + round(tier * 1.5)
        for y in range(top, bottom):
            half = round((y - top) * (0.45 + 0.1 * t) + 1)
            for x in range(cx - half, cx + half + 1):
                put(x, y, lit if x < cx else dark)
            # snow on the upper slope edges
            put(cx - half, y, SNOW)
            if (y - top) % 3 == 0:
                put(cx + half, y, SNOW)
        for x in range(cx - (bottom - top) // 2, cx + (bottom - top) // 2 + 1, 2):
            put(x, bottom, SNOW)


def frame(f):
    # sky: deep blue, lighter toward the horizon
    px = [[lerp((10, 14, 34), (34, 44, 74), y / H)] * W for y in range(H)]

    def put(x, y, c):
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            px[y][x] = c

    # a few stars, still, twinkling
    for x in range(0, W, 2):
        for y in range(0, 40):
            h = hash2(x, y)
            if h % 700 == 0:
                put(x, y, (220, 220, 235) if (f + h) % 24 < 18 else (100, 100, 120))

    def flakes(seed, count, period, drift, fall, size, c):
        # drift and fall carry each flake a whole number of periods over the loop, so it meets itself
        for i in range(count):
            h = hash2(i, seed)
            x0 = (h % period - drift * f) % period
            y = (h >> 12) % H + fall * f
            y %= H
            for x in range(round(x0), W, period):
                for d in range(size):
                    put(x + d, y, c)
                    if size > 1:
                        put(x + d, y + 1, c)

    # far snow: 2 px a frame over 192, falling 0.75 px a frame
    flakes(1, 40, 192, 2, 0.75, 1, (150, 156, 180))

    # far pines: 4 px a frame, 192 px period
    for slot in range(4):
        h = hash2(slot, 11)
        base_x = slot * 48 + h % 20
        for k in range(-1, W // 192 + 2):
            cx = base_x + 192 * k - (4 * f) % 192
            pine(put, cx, H - 4, 16 + h % 8, (24, 52, 46), (34, 68, 58))

    # near pines: 8 px a frame, 192 px period
    for slot in range(2):
        h = hash2(slot, 23)
        base_x = slot * 96 + h % 40
        for k in range(-1, W // 192 + 2):
            cx = base_x + 192 * k - (8 * f) % 192
            pine(put, cx, H - 1, 22 + h % 8, (14, 40, 30), (22, 58, 42))

    # snowy ground: 12 px a frame, 96 px period, faint blue shadows
    for x in range(W):
        gx = (x + 12 * f) % 96
        for y in range(H - 5, H):
            h = hash2(gx, y + 90)
            put(x, y, (190, 200, 222) if h % 7 == 0 else SNOW)

    D = 3
    SX = 250
    sy = 21 + round(3 * math.sin(2 * math.pi * f / 48))

    def sprite(rows, x0, y0, scale):
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch in PAINT:
                    for dx in range(scale):
                        for dy in range(scale):
                            put(x0 + scale * c + dx, y0 + scale * r + dy, PAINT[ch])

    # reindeer in single file, each a little higher and a beat ahead of the one behind
    collars = []
    for i in range(DEER):
        dx = SX + 100 + 46 * i
        dy = sy + 1 - 4 * i + round(2 * math.sin(2 * math.pi * (f + 3 * i) / 8))
        legs = GALLOP[((f + 2 * i) // 2) % len(GALLOP)]
        sprite(REINDEER + legs, dx, dy, 2)
        collars.append((dx + 22, dy + 12))

    # reins: from Claude's hands to the first collar, then collar to collar, sagging
    def rein(x0, y0, x1, y1, sag):
        for s in range(61):
            t = s / 60
            put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t), REIN)

    hands = (SX + D * 19, sy + D * 3)
    rein(*hands, *collars[0], 6)
    for a, b in zip(collars, collars[1:]):
        rein(a[0] - 26, a[1] + 4, b[0] - 22, b[1] + 2, 3)

    # Claude in a Santa hat, sitting in the sleigh, which hides its lower half
    claude = HAT[:-1] + [merge(HAT[-1], BODY[0])] + BODY[1:]
    sprite(claude, SX + D * 4, sy - D * (len(HAT) - 1) - D, D)
    sprite(SLEIGH, SX, sy, D)

    # near snow, in front of it all: 4 px a frame over 384, falling 1.5 px a frame
    flakes(2, 30, 384, 4, 1.5, 2, (245, 245, 255))

    return px


if __name__ == '__main__':
    main('sleigh', frame)
