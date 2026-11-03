import type { Kind } from '../types'

// one run of same-coloured text; a row is a list of them
export type Seg = { text: string; color?: string; bg?: string }
type Animation = (t: number, width: number) => Seg[][]

export const KINDS: readonly Kind[] = ['fish', 'pong', 'rain', 'snow', 'walk', 'broom', 'boat']

// every frame is a pure function of the tick, so "random" is a hash
const hash = (a: number, b = 0) => {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)

  return (x ^ (x >>> 16)) >>> 0
}

const blank = (width: number): string[] => Array(width).fill(' ')

// stamps `s` into `row` at `x`, clipped at both edges
const put = (row: string[], x: number, s: string) => {
  ;[...s].forEach((ch, i) => {
    const at = x + i
    if (at >= 0 && at < row.length) {
      row[at] = ch
    }
  })
}

const SWIMMING_RIGHT = ['><(((º>', '><>', '>=>'] as const
const SWIMMING_LEFT = ['<º)))><', '<><', '<º)><'] as const
const LANES = ['yellow', 'cyan', 'green'] as const

const fish: Animation = (t, width) => {
  const top = blank(width)
  const lanes = LANES.map(() => blank(width))

  for (let x = 0; x < width; x++) {
    if ((x + Math.floor(t / 3)) % 7 === 0) {
      put(top, x, '~')
    }
  }

  // a wider sea holds more fish
  for (let i = 0; i < Math.max(4, Math.round(width / 20)); i++) {
    const h = hash(i, 3)
    const isRight = (h & 1) === 1
    const body = (isRight ? SWIMMING_RIGHT : SWIMMING_LEFT)[(h >>> 1) % 3] ?? '><>'
    const at = (Math.floor(t / (1 + ((h >>> 4) % 3))) + (h >>> 8)) % (width + body.length)
    const lane = lanes[i % lanes.length]
    if (lane !== undefined) {
      put(lane, isRight ? at - body.length : width - at, body)
    }
  }

  return [
    [{ text: top.join(''), color: 'blue' }],
    ...lanes.map((lane, i) => [{ text: lane.join(''), color: LANES[i] }]),
  ]
}

const CRAB = [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '] as const
const CRAB_WIDTH = 9
const ORANGE = '#D97757'
// keeps the right crab clear of the pane's collapse button
const PONG_MARGIN = 4

// 0, 1, .. max, .. 1, 0, 1, ..
const bounce = (n: number, max: number) => {
  const p = n % (2 * max)

  return p <= max ? p : 2 * max - p
}

const pong: Animation = (t, width) => {
  const court = Math.max(4, width - 2 * CRAB_WIDTH - 2 - PONG_MARGIN)
  // a wider table gets a faster ball, so a rally takes about as long
  const x = bounce(t * Math.max(1, Math.round(court / 40)), court - 1)
  const y = bounce(Math.floor(t / 3), 2)
  // each crab tracks the ball while it is on its half, and rests in the middle
  const left = x < court / 2 ? y : 1
  const right = x < court / 2 ? 1 : y

  return CRAB.map((crab, row) => {
    const table = blank(court)
    if (row === y) {
      put(table, x, '●')
    }
    const text = (row === left ? '▌' : ' ') + table.join('') + (row === right ? '▐' : ' ')

    return [{ text: crab, color: ORANGE }, { text }, { text: crab + ' '.repeat(PONG_MARGIN), color: ORANGE }]
  })
}

const ROWS = 5
const GLYPHS = [...'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789']

const rain: Animation = (t, width) => {
  const rows = Array.from({ length: ROWS }, () => blank(width))

  for (let x = 0; x < width; x++) {
    const h = hash(x, 1)
    if (h % 3 === 0) {
      continue
    }
    const trail = 2 + ((h >>> 4) % 3)
    const period = ROWS + trail + 2 + ((h >>> 8) % 6)
    const head = (Math.floor(t / (1 + ((h >>> 12) % 2))) + (h >>> 16)) % period

    rows.forEach((row, y) => {
      if (head - y >= 0 && head - y <= trail) {
        put(row, x, GLYPHS[hash(x * 31 + y, Math.floor(t / 4)) % GLYPHS.length] ?? '0')
      }
    })
  }

  return rows.map(row => [{ text: row.join(''), color: 'green' }])
}

const FLAKES = ['*', '·', '.', '+'] as const

const snow: Animation = (t, width) => {
  const rows = Array.from({ length: ROWS }, () => blank(width))

  for (let i = 0; i < Math.floor(width / 3); i++) {
    const h = hash(i, 2)
    const slow = 2 + ((h >>> 8) % 3)
    const y = (Math.floor(t / slow) + (h >>> 16)) % (ROWS + ((h >>> 12) % 4))
    const sway = (Math.floor(t / (slow * 2)) + (h >>> 20)) % 2
    const row = rows[y]
    if (row !== undefined) {
      put(row, ((h % width) + sway) % width, FLAKES[h >>> 30] ?? '*')
    }
  }

  return rows.map(row => [{ text: row.join(''), color: 'white' }])
}

const PAINT: Record<string, string> = { O: ORANGE, S: '#B5583C', K: '#000000', B: '#8B5A2B', D: '#5A3A1C' }
// the crab in headphones, one letter per pixel; two pixel rows make one text row
const BODY = [
  '....BBBBBBBB....',
  '...BB......BB...',
  '..BB........BB..',
  '..BOOOOOOOOOOB..',
  '.DDOOOOOOOOOODD.',
  '.DDOOKOOOOKOODD.',
  '.DDOOKOOOOKOODD.',
  '..OOOOOOOOOOOO..',
  'OOOOOOOOOOOOOOOO',
  'SSOOOOOOOOOOOOSS',
  '..OOOOOOOOOOOO..',
  '..SSSSSSSSSSSS..',
] as const
const STRIDES = [
  ['..O.O......O.O..', '..O.O......O.O..'],
  ['..O.O......O.O..', '.O...O....O...O.'],
] as const
const NONE = '.'.repeat(16)
const SPRITE_ROWS = 8
const SCENE_ROWS = 10
const GREYS = { sky: '#6E6E6E', far: '#7A7A7A', near: '#A0A0A0', land: '#C8C8C8' } as const

type Cell = { ch: string; color?: string; bg?: string }

// 0..1, eased between a random value every 12 columns, for the ridge line
const smooth = (x: number) => {
  const i = Math.floor(x / 12)
  const f = (x % 12) / 12
  const a = (hash(i, 5) % 100) / 100
  const b = (hash(i + 1, 5) % 100) / 100

  return a + (b - a) * f * f * (3 - 2 * f)
}

// each layer scrolls at its own pace, so nearer ones pass faster
const scenery = (t: number, x: number, y: number): Cell => {
  if (y === SCENE_ROWS - 1) {
    const h = hash(x + t, 9)
    return { ch: h % 10 < 9 ? ([...'█▓▒#X'][(h >>> 8) % 5] ?? '█') : ' ', color: GREYS.land }
  }
  if (y >= SCENE_ROWS - 3) {
    const h = hash(x + Math.floor(t / 2), y)
    if (h % 10 < (y === SCENE_ROWS - 3 ? 4 : 7)) {
      return { ch: [...'#X=■<>/\\o'][(h >>> 8) % 9] ?? '#', color: GREYS.near }
    }
  }
  const far = x + Math.floor(t / 3)
  if (y >= 2 + Math.round(smooth(far) * 4) && hash(far, y + 40) % 9 !== 0) {
    // alternating slashes read as the hill's hatched face
    return { ch: (far + y) % 2 === 0 ? '/' : '\\', color: GREYS.far }
  }
  const sky = x + Math.floor(t / 6)
  const h = hash(sky, y + 20)
  if (hash(Math.floor(sky / 10), y + 30) % 6 === 0 && h % 3 !== 0) {
    return { ch: h % 2 === 0 ? '_' : '-', color: GREYS.sky }
  }

  return { ch: h % 41 === 0 ? '·' : h % 113 === 0 ? '▲' : ' ', color: GREYS.sky }
}

// two pixels, top and bottom, as one half-block cell; undefined lets the scenery show
const pixel = (top: string, bottom: string): Cell | undefined => {
  const up = PAINT[top]
  const down = PAINT[bottom]
  if (up === undefined) {
    return down === undefined ? undefined : { ch: '▄', color: down }
  }
  if (down === undefined || down === up) {
    return { ch: down === up ? '█' : '▀', color: up }
  }

  return { ch: '▀', color: up, bg: down }
}

// joins neighbouring cells of the same colours into one segment
const runs = (cells: Cell[]): Seg[] =>
  cells.reduce<Seg[]>((segs, { ch, color, bg }) => {
    const last = segs[segs.length - 1]
    if (last !== undefined && last.color === color && last.bg === bg) {
      last.text += ch
    } else {
      segs.push({ text: ch, color, bg })
    }

    return segs
  }, [])

const walk: Animation = (t, width) => {
  const at = Math.floor(width / 3)
  const isLifted = Math.floor(t / 2) % 2 === 1
  const legs = STRIDES[isLifted ? 1 : 0]
  // the body rises a pixel on every other step
  const pixels = [...BODY, ...legs, ...(isLifted ? [NONE] : [])]
  const grid = [...Array<string>(2 * SPRITE_ROWS - pixels.length).fill(NONE), ...pixels]
  const top = SCENE_ROWS - 1 - SPRITE_ROWS

  return Array.from({ length: SCENE_ROWS }, (_, y) =>
    runs(
      Array.from({ length: width }, (_, x) => {
        const row = y - top
        const px = x - at
        const sprite =
          row >= 0 && row < SPRITE_ROWS && px >= 0 && px < NONE.length
            ? pixel(grid[2 * row]?.[px] ?? '.', grid[2 * row + 1]?.[px] ?? '.')
            : undefined

        return sprite ?? scenery(t, x, y)
      }),
    ),
  )
}

// broom and boat are pictures (see register.tsx); walk and fish stand in where the terminal shows none
export const ANIMATIONS: Record<Kind, Animation> = { fish, pong, rain, snow, walk, broom: walk, boat: fish }
