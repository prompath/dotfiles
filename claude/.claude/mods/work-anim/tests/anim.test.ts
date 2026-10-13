import { expect, mock, test } from 'claude-code/testing'

import { ANIMATIONS, KINDS } from '../hooks/frames'

const band = (isWorking: boolean) =>
  ({
    plugin: 'work-anim',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking,
      maxRows: 10,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  }) as const

const run = (args: string) => ({
  command: 'anim',
  args,
  origin: { kind: 'composer' } as const,
  presentation: { isFullscreen: false, columns: 80 },
})

const text = (rows: { text: string }[][]) => rows.map(row => row.map(seg => seg.text).join(''))

test('every animation keeps its width and moves', () => {
  for (const kind of KINDS) {
    for (const width of [40, 80, 200]) {
      const first = text(ANIMATIONS[kind](0, width))
      const widths = new Set<number>()
      let hasMoved = false

      for (let t = 0; t < 300; t++) {
        const frame = text(ANIMATIONS[kind](t, width))
        frame.forEach(line => widths.add([...line].length))
        hasMoved ||= frame.join('\n') !== first.join('\n')
      }

      expect([...widths], `${kind} at ${width}`).toEqual([width])
      expect(hasMoved, `${kind} at ${width}`).toBe(true)
    }
  }
})

test('plays a pinned animation, a random one each turn otherwise, and previews when idle', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on, { choice: 'fish' })
  on('ui.render', () => ({ type: 'Box' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  const lines = async (isWorking: boolean) => {
    const ui = await $.ui.mount(band(isWorking))
    const found = await ui.findAll({ type: 'Text' })
    await ui.unmount()

    return found.map(one => one.text ?? '').join('\n')
  }
  const turn = async (turnId: string) => {
    await $.turn.start({ text: 'hi', turnId })
    const kind = await lines(true)
    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId, reason: 'answer' })

    return kind
  }
  const first = (kind: (typeof KINDS)[number]) => text(ANIMATIONS[kind](0, 80)).join('\n')

  expect(await lines(true)).toBe('')

  // the stored choice plays, turn after turn
  expect(await turn('t1')).toBe(first('fish'))
  expect(await turn('t2')).toBe(first('fish'))
  expect(await lines(true)).toBe('')

  // idle: the command stores its pick, previews it, then clears
  expect((await $.command.run(run('rain'))).text).toBe('Animation: rain')
  expect(await lines(false)).toBe(first('rain'))
  await clock.advance(10_000)
  expect(await lines(false)).toBe('')
  expect(await turn('t3')).toBe(first('rain'))

  expect((await $.command.run(run('dog'))).text).toContain('No animation')

  // the gallery plays all four, then clears, and leaves the choice as it was
  expect((await $.command.run(run('gallery'))).text).toBe('Animation gallery')
  const all = await lines(false)
  for (const kind of KINDS) {
    expect(all).toContain(`${kind}\n`)
  }
  await clock.advance(20_000)
  expect(await lines(false)).toBe('')
  expect((await $.command.run(run(''))).text).toContain('Animation: rain')

  // random: never the same animation two turns running
  await $.command.run(run('random'))
  let last = await turn('t4')
  for (let i = 0; i < 20; i++) {
    const next = await turn(`r${i}`)
    expect(next).not.toBe(last)
    last = next
  }
})
