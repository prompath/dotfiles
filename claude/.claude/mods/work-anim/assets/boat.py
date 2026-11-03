"""Draws boat.gif, and its frames for the mod in boat/: Claude rowing a boat on a dark sea, fishing as it goes.

Same canvas, loop and writer as broom.py. Run: python3 boat.py
"""

import math

from broom import BODY, FRAMES, H, PAINT, W, hash2, main

SKY = (30, 30, 30)
WATERLINE = 44
HULL, HULL_DARK, GUNWALE = (150, 104, 52), (110, 74, 36), (196, 150, 84)
OAR, BLADE = (120, 82, 40), (176, 128, 64)
OAR_IN, OAR_OUT = 26, 44  # oar length either side of the oarlock
ROD, LINE = (90, 70, 50), (150, 150, 150)
BOBBER_TOP, BOBBER_BOTTOM = (220, 60, 50), (230, 230, 230)
# the first half of the loop rows (two strokes of 24 frames), the second fishes
STROKE = 24
ROW = FRAMES // 2
CAST, REEL = 6, 6  # frames the line takes to fly out and to come back


def frame(f):
    px = [[SKY] * W for _ in range(H)]

    def put(x, y, c):
        x, y = round(x), round(y)
        if 0 <= x < W and 0 <= y < H:
            px[y][x] = c

    def line(x0, y0, x1, y1, c, thick=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(int(n) + 1):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            for d in range(thick):
                put(x, y + d, c)

    # a few stars, still
    for x in range(0, W, 2):
        for y in range(0, WATERLINE - 6):
            h = hash2(x, y)
            if h % 900 == 0:
                put(x, y, (200, 200, 200) if h % 3 else (110, 110, 110))

    # how far the boat has come: 1.5 px a frame while rowing, then a 0.5 px glide while fishing,
    # 96 px over the loop so the 96 px water pattern meets itself
    rowing = f < ROW
    travel = 1.5 * f if rowing else 1.5 * ROW + 0.5 * (f - ROW)

    # water: dotted ripples drifting left, nearer rows faster (1, 2 and 4 times the travel)
    for y in range(WATERLINE, H):
        depth = (y - WATERLINE) / (H - WATERLINE)
        speed = 1 if depth < 0.3 else 2 if depth < 0.65 else 4
        density = (7 if y % 3 == 0 else 40) + (y - WATERLINE) // 3
        for x in range(0, W, 2):
            wx = (x + round(speed * travel)) % 96
            h = hash2(wx, y + 7)
            if h % density == 0:
                lit = (f + h) % 12 < 9
                put(x, y, (225, 225, 225) if lit and h % 2 else (120, 120, 120))

    phase = 2 * math.pi * (f % STROKE) / STROKE
    bob = round(1.5 * math.sin(2 * math.pi * f / 48))
    bx, by = 480, WATERLINE - 4 + bob

    # Claude, sitting low in the boat (3x3 blocks), leaning into each stroke, still while fishing
    lean = round(1.5 * math.cos(phase)) if rowing else 0
    for r, row in enumerate(BODY):
        for c, ch in enumerate(row):
            if ch in PAINT:
                for dx in range(3):
                    for dy in range(3):
                        put(bx - 24 + lean + 3 * c + dx, by - 19 + 3 * r + dy, PAINT[ch])

    # fishing rod: propped upright at the stern while rowing, held out over the water while fishing
    if rowing:
        line(bx - 30, by - 2, bx - 44, by - 34, ROD, 2)
    else:
        k = f - ROW
        tx, ty = bx - 70, by - 26 + 1.5 * math.sin(2 * math.pi * k / 16)
        line(bx - 22, by - 4, tx, ty, ROD, 2)
        # cast out, wait, a bite pulls the float under, reel in before the oar comes back
        out = min(1, (k + 1) / CAST, (ROW - k) / REEL)
        bite = 26 <= k < 34
        fx = tx + (bx - 130 - tx) * out
        fy = WATERLINE + 1 + (4 if bite and k % 4 < 2 else 1.2 * math.sin(2 * math.pi * k / 16 + 1))
        fy = ty + (fy - ty) * out - 10 * out * (1 - out) * 4  # arcs through the air while flying
        sag = 2 if bite else 8  # the line goes taut on a bite
        for i in range(41):
            t = i / 40
            put(tx + (fx - tx) * t, ty + (fy - ty) * t + sag * out * t * (1 - t), LINE)
        if out == 1 and not (bite and k % 4 < 2):
            for dx in range(-1, 2):
                put(fx + dx, fy - 2, BOBBER_TOP)
                put(fx + dx, fy - 1, BOBBER_TOP)
                put(fx + dx, fy, BOBBER_BOTTOM)
        if out == 1:
            ring = 3 + (k % 16) // 4 + (3 if bite else 0)
            for dx in (-ring - 1, -ring, ring, ring + 1):
                put(fx + dx, WATERLINE + 2, (200, 200, 200))  # rings round the float
        elif out > 0:
            put(fx, fy, BOBBER_TOP)  # the float in flight

    # hull: planked, tapering to the keel, drawn over Claude's lower half
    for r in range(12):
        half = 46 - r * r // 5
        for x in range(round(bx - half), round(bx + half) + 1):
            put(x, by + r, GUNWALE if r < 2 else HULL if (r // 3) % 2 else HULL_DARK)
    for x in (bx - 46, bx + 46):
        for r in range(-3, 2):
            put(x + (1 if x < bx else -1) * (r + 3) // 2, by + r, GUNWALE)  # raised bow and stern

    # oar: one rigid length turning in an oarlock on the gunwale, handle in the hands, blade outboard
    px_, py_ = bx + 40, by - 1
    if rowing:
        # below horizontal is positive: the blade dips in on the drive and lifts out on the recovery
        a = math.radians(2.5 + 10.5 * math.sin(phase))
    else:
        a = 0.0  # shipped: lying level along the gunwale
    cx, cy = math.cos(a), math.sin(a)
    hx, hy = px_ - OAR_IN * cx, py_ - OAR_IN * cy
    ox, oy = px_ + OAR_OUT * cx, py_ + OAR_OUT * cy
    line(hx, hy, ox, oy, OAR, 2)
    line(px_ + (OAR_OUT - 10) * cx, py_ + (OAR_OUT - 10) * cy - 1, ox, oy - 1, BLADE, 4)
    for d in range(-1, 2):
        put(px_ + d, py_ - 1, GUNWALE)  # the oarlock
    if rowing and math.sin(phase) > 0.6:  # blade in the water: splash
        for i in range(6):
            h = hash2(f, i)
            put(ox - 6 + h % 13, WATERLINE - 1 - (h >> 4) % 4, (230, 230, 230))

    return px


if __name__ == '__main__':
    main('boat', frame)
