import type { Kind } from '../types'

// one run of same-coloured text; a row is a list of them
export type Seg = { text: string; color?: string }
type Animation = (t: number, width: number) => Seg[][]

export const KINDS: readonly Kind[] = ['fish', 'pong', 'rain', 'snow']

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

export const ANIMATIONS: Record<Kind, Animation> = { fish, pong, rain, snow }
