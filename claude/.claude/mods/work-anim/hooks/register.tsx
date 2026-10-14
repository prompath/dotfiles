import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Kind } from '../types'
import { ANIMATIONS, KINDS } from './frames'

const FRAME_MS = 160
const PREVIEW_MS = 10_000

const noTick: number | null = null
const firstKind: Kind = 'fish'
const tick = atom({ plugin: 'work-anim', key: 'tick' } as const, noTick)
const kind = atom({ plugin: 'work-anim', key: 'kind' } as const, firstKind)

let timer: Timer | undefined
let preview: Timer | undefined
let inTurn = false
let isGallery = false

async function start($: EngineInterface) {
  timer?.cancel()
  await update($, tick, () => 0)
  timer = $.clock.every(FRAME_MS, () => {
    void update($, tick, t => (t ?? 0) + 1)
  })
}

async function stop($: EngineInterface) {
  timer?.cancel()
  timer = undefined
  await update($, tick, () => null)
}

// what `/anim` last chose, kept across sessions: one animation, or a new one each turn
async function choice($: EngineInterface): Promise<Kind | 'random'> {
  const stored = await $.store.get('choice')

  return KINDS.find(k => k === stored) ?? 'random'
}

// sets the animation to play: the chosen one, or a random one other than the last
async function cast($: EngineInterface) {
  const chosen = await choice($)

  await update($, kind, last => {
    if (chosen !== 'random') {
      return chosen
    }
    const rest = KINDS.filter(k => k !== last)

    return rest[Math.floor(Math.random() * rest.length)] ?? last
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'anim',
      description: 'Pick the animation shown while Claude works, or a random one each turn',
      argumentHint: `[random|${KINDS.join('|')}|gallery]`,
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'anim' }, async ($, e) => {
    const arg = e.args.trim()
    const pick = arg === 'random' ? arg : KINDS.find(k => k === arg)
    const options = `random, ${KINDS.join(', ')}, gallery`

    if (arg === '') {
      return { text: `Animation: ${await choice($)}. Options: ${options}` }
    }
    if (pick === undefined && arg !== 'gallery') {
      return { text: `No animation "${arg}". Try one of: ${options}` }
    }

    // the gallery shows every animation and leaves the choice as it is
    if (pick !== undefined) {
      await $.store.set('choice', pick)
      await cast($)
    }
    isGallery = pick === undefined

    // play it for a while so it can be seen outside a turn
    preview?.cancel()
    if (!inTurn) {
      await start($)
    }
    preview = $.clock.after(isGallery ? 2 * PREVIEW_MS : PREVIEW_MS, () => {
      preview = undefined
      isGallery = false
      if (!inTurn) {
        void stop($)
      }
    })

    return { text: pick === undefined ? 'Animation gallery' : `Animation: ${pick}` }
  })

  on('turn.start', async ($, e, next) => {
    inTurn = true
    preview?.cancel()
    preview = undefined
    isGallery = false
    await cast($)
    await start($)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // a subagent's turn ending leaves the main turn, and the animation, running
    if (e.agentId === undefined) {
      inTurn = false
      await stop($)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await read($, tick)
    // isWorking also hides an animation left over from a turn whose end was missed
    const isPlaying = e.props.isWorking || preview !== undefined

    if (t === null || e.props.hasSurvey || !isPlaying) {
      return next(e)
    }

    const width = e.props.bodyColumns
    const rows = isGallery
      ? KINDS.flatMap(k => [[{ text: k, color: 'gray' }], ...ANIMATIONS[k](t, width)])
      : ANIMATIONS[await read($, kind)](t, width)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {rows.map(row => (
          <Box>
            {row.map(seg => (
              <Text color={seg.color} wrap="truncate-end">
                {seg.text}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
