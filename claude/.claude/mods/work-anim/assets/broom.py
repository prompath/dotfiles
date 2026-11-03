"""Draws broom.gif, and its frames for the mod in broom/: Claude on a broom, floating past scrolling mountains.

Pure stdlib; pipes raw RGB frames to ffmpeg. Run: python3 broom.py
"""

import math
import subprocess
from pathlib import Path

# 40:3, so the picture spans the terminal at 3/80 of its width in rows
W, H, SCALE = 960, 72, 2
# every layer's period divides the loop, so the gif repeats without a seam
FRAMES, FPS = 96, 12

SKY = (30, 30, 30)
PAINT = {
    'O': (217, 119, 87),  # body
    'S': (181, 88, 60),  # body shade
    'K': (10, 10, 10),  # eyes
    'H': (90, 90, 96),  # hat
    'h': (60, 60, 66),  # hat shade
    'B': (40, 40, 44),  # hat band
}
HAT = [
    '.........HH.....',
    '........HHh.....',
    '.......HHHh.....',
    '......HHHHh.....',
    '......HHHHHh....',
    '.....HHHHHHh....',
    '.....BBBBBBB....',
    'HHHHHHHHHHHHHHh.',
]
BODY = [
    '..OOOOOOOOOOOO..',
    '..OOKOOOOOOKOO..',
    '..OOKOOOOOOKOO..',
    'OOOOOOOOOOOOOOOO',
    'SOOOOOOOOOOOOOOS',
    '..OOOOOOOOOOOO..',
    '..SSSSSSSSSSSS..',
]
LEGS = ['..O.O......O.O..', '..O.O......O.O..']
STICK, STICK_LIT = (110, 66, 30), (150, 96, 48)
STRAW, STRAW_DARK, TIE = (222, 186, 84), (176, 140, 52), (120, 80, 40)


def tri(x, period):
    """0..1..0 over one period."""
    p = (x % period) / period
    return 1 - abs(2 * p - 1)


def hash2(a, b):
    x = (a * 374761393 + b * 668265263) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return x ^ (x >> 16)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def frame(f):
    # sky: a vertical gradient, darker overhead
    px = [[lerp((14, 14, 22), (40, 38, 48), y / H)] * W for y in range(H)]

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            px[y][x] = c

    # moon, fixed, with a soft rim
    mx, my, mr = 820, 15, 7
    for y in range(my - mr - 2, my + mr + 3):
        for x in range(mx - mr - 2, mx + mr + 3):
            d = math.hypot(x - mx, y - my)
            if d <= mr:
                shade = (232, 228, 210) if math.hypot(x - mx - 3, y - my + 2) > 4 or d > mr - 1 else (210, 206, 190)
                put(x, y, shade)
            elif d <= mr + 2:
                put(x, y, lerp(px[y][x], (120, 118, 110), 0.35))

    # stars: 2 px a frame over a 192 px pattern, twinkling on a 24-frame cycle
    for x in range(W):
        sx = (x + 2 * f) % 192
        for y in range(34):
            h = hash2(sx, y)
            if h % 260 == 0:
                lit = (f + h) % 24 < 18
                put(x, y, (220, 220, 230) if lit and h % 3 else (110, 110, 120))

    # far range: 4 px a frame, 192 px period, shaded by height, snow on the peaks
    for x in range(W):
        fx = x + 4 * f
        top = int(H - 10 - 44 * tri(fx, 192) ** 1.5 - 10 * tri(fx + 34, 64))
        for y in range(top, H):
            depth = (y - top) / max(1, H - top)
            c = lerp((104, 104, 112), (44, 44, 50), depth)
            if y < top + 3 and top < H - 38:
                c = (200, 202, 210) if (fx + y) % 3 else (160, 162, 170)
            put(x, y, c)
        put(x, top, (170, 170, 178))

    # near hills: 8 px a frame, 192 px period, lit ridge and sparse rocks
    for x in range(W):
        nx = x + 8 * f
        top = int(H - 6 - 18 * tri(nx, 192) - 8 * tri(nx + 22, 96))
        for y in range(top, H):
            h = hash2(nx % 192, y + 50)
            put(x, y, (100, 100, 104) if h % 90 == 0 else lerp((30, 30, 34), (14, 14, 16), (y - top) / max(1, H - top)))
        put(x, top, (64, 64, 70))

    # ground rubble: 12 px a frame, 96 px period
    for x in range(W):
        gx = (x + 12 * f) % 96
        for y in range(H - 6, H):
            h = hash2(gx, y + 90)
            if h % 6 == 0:
                put(x, y, (160, 160, 160) if h % 2 else (90, 90, 90))

    # rider: drawn in 3x3 blocks, bobbing on a 48-frame sine
    D = 3

    def dot(x, y, c):
        for dx in range(D):
            for dy in range(D):
                put(D * x + dx + RX, D * y + dy + ry, c)

    RX = 280
    ry = 12 + round(3 * math.sin(2 * math.pi * f / 48))
    # the brim sits over the body's top row
    rows = HAT[:-1] + [merge(HAT[-1], BODY[0])] + BODY[1:] + LEGS
    stick = len(rows) - 2

    # broom stick under the legs, bristles trailing left
    for x in range(-7, 15):
        dot(x, stick, STICK if (x + 7) % 6 else STICK_LIT)
    dot(15, stick, STICK)
    for i in range(1, 9):
        spread = 1 + i // 3
        for dy in range(-spread, spread + 1):
            if i == 8 and (dy + f // 3) % 2 == 0:
                continue  # flickering tips
            dot(-7 - i, stick + dy, STRAW if (dy + i) % 3 else STRAW_DARK)
    for dy in (-1, 0, 1):
        dot(-7, stick + dy, TIE)

    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch in PAINT:
                dot(c, r, PAINT[ch])

    return px


def merge(top, under):
    return ''.join(t if t != '.' else u for t, u in zip(top, under))


def main(name='broom', draw=frame):
    """Writes <name>.gif and its frames in <name>/."""
    out = Path(__file__).with_name(f'{name}.gif')
    ffmpeg = subprocess.Popen(
        [
            'ffmpeg', '-y', '-loglevel', 'error',
            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
            '-vf', f'scale={W * SCALE}:{H * SCALE}:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none',
            '-loop', '0', str(out),
        ],
        stdin=subprocess.PIPE,
    )
    for f in range(FRAMES):
        ffmpeg.stdin.write(bytes(v for row in draw(f) for p in row for v in p))
    ffmpeg.stdin.close()
    assert ffmpeg.wait() == 0, 'ffmpeg failed'
    frames = Path(__file__).with_name(name)
    frames.mkdir(exist_ok=True)
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out), '-start_number', '0', str(frames / '%02d.png')],
        check=True,
    )
    print(out, frames)


if __name__ == '__main__':
    main()
