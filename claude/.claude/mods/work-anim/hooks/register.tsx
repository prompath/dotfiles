import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Kind } from '../types'
import { ANIMATIONS, KINDS } from './frames'

const FRAME_MS = 160
const PREVIEW_MS = 10_000
// assets/broom.py, boat.py and sleigh.py draw these, and writer/ holds Wan 2.2 clips: 96 frames each at 12 a second
const PICTURES: readonly Kind[] = ['broom', 'boat', 'sleigh', 'writer']
const PICTURE_MS = 1000 / 12
const PICTURE_FRAMES = 96
// writer's clips: writing mid-strip, sipping tea on the left, the bookshelf on the right; the last two are 48-frame loops
const WRITER_FRAMES = { writing: 96, sipping: 48, bookshelf: 48 } as const
// a Notion MCP tool, or the ntn CLI run by Bash
const NOTION_TOOL = /notion/i
const NTN = /(^|[;&|(]\s*)ntn(\s|$)/

// what `/anim` offers and random draws from: writer is the imp secretary session's own
const CHOICES = KINDS.filter(k => k !== 'writer')

const noTick: number | null = null
const firstKind: Kind = 'fish'
const tick = atom({ plugin: 'work-anim', key: 'tick' } as const, noTick)
const kind = atom({ plugin: 'work-anim', key: 'kind' } as const, firstKind)

let timer: Timer | undefined
let preview: Timer | undefined
let inTurn = false
let isGallery = false
let picture: Timer | undefined
let pictureKind: Kind = 'broom'
let pictureFrame = 0
// the assets folder the frames come from: the kind's own, or one of writer's clips
let pictureFolder = ''
// Notion calls running now; more than one when they run in parallel
let notionCalls = 0
// the site the picture was last drawn under; a redraw may move it
let pictureSite = ''
// false once the terminal turns the picture down; walk plays in its place
let canShowImages = true
// set once this session runs the imp secretary: writer, all the time; in memory, as $.store is every session's
let isSecretary = false

// what the secretary does: the bookshelf while Notion runs, writing through the rest of a turn, sipping tea between turns
const writerClip = () => (notionCalls > 0 ? 'bookshelf' : inTurn ? 'writing' : 'sipping')

// moves to the folder now due, from its first frame; false when it stays
function follow() {
  const folder = pictureKind === 'writer' ? `writer/${writerClip()}` : pictureKind
  if (folder === pictureFolder) {
    return false
  }
  pictureFolder = folder
  pictureFrame = 0
  return true
}

const pictureSource = ($: EngineInterface) =>
  ({ file: `${$.plugin.root}/assets/${pictureFolder}/${String(pictureFrame).padStart(2, '0')}.png`, format: 'png' }) as const

function stopPicture() {
  picture?.cancel()
  picture = undefined
}

async function start($: EngineInterface) {
  timer?.cancel()
  await update($, tick, () => 0)
  timer = $.clock.every(FRAME_MS, () => {
    void update($, tick, t => (t ?? 0) + 1)
  })
}

async function stop($: EngineInterface) {
  if (isSecretary) {
    return
  }
  stopPicture()
  timer?.cancel()
  timer = undefined
  await update($, tick, () => null)
}

// what `/anim` last chose, kept across sessions: one animation, or a new one each turn
async function choice($: EngineInterface): Promise<Kind | 'random'> {
  const stored = await $.store.get('choice')

  return CHOICES.find(k => k === stored) ?? 'random'
}

// sets the animation to play: the chosen one, or a random one other than the last
async function cast($: EngineInterface) {
  const chosen = isSecretary ? 'writer' : await choice($)

  await update($, kind, last => {
    if (chosen !== 'random') {
      return chosen
    }
    const rest = CHOICES.filter(k => k !== last)

    return rest[Math.floor(Math.random() * rest.length)] ?? last
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'anim',
      description: 'Pick the animation shown while Claude works, or a random one each turn',
      argumentHint: `[random|${CHOICES.join('|')}|gallery]`,
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'anim' }, async ($, e) => {
    const arg = e.args.trim()
    const pick = arg === 'random' ? arg : CHOICES.find(k => k === arg)
    const options = `random, ${CHOICES.join(', ')}, gallery`

    if (arg === '') {
      return { text: `Animation: ${await choice($)}. Options: ${options}` }
    }
    if (arg === 'writer') {
      return { text: 'writer plays only in the secretary session' }
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

    // the secretary session stores the pick for the others and keeps writer
    const note = isSecretary && pick !== undefined ? ' (this session keeps writer)' : ''

    return { text: pick === undefined ? 'Animation gallery' : `Animation: ${pick}${note}` }
  })

  // fires in the session that expands the skill, by `/imp:secretary` or the Skill tool
  on('skill.prompt', async ($, e, next) => {
    if (e.skill === 'imp:secretary' || (e.pluginName === 'imp' && e.skill === 'secretary')) {
      isSecretary = true
      await cast($)
      await start($)
    }

    return next(e)
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

  on('tool.call', async ($, e, next) => {
    if (!NOTION_TOOL.test(e.tool) && !(e.tool === 'Bash' && NTN.test(e.command))) {
      return next(e)
    }
    notionCalls++
    try {
      return await next(e)
    } finally {
      notionCalls--
    }
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
    const isPlaying = e.props.isWorking || preview !== undefined || isSecretary

    if (t === null || e.props.hasSurvey || !isPlaying) {
      // the Image is gone, so a blit now would be refused
      stopPicture()
      return next(e)
    }

    const width = e.props.bodyColumns
    const current = await read($, kind)

    if (PICTURES.includes(current) && canShowImages && !isGallery) {
      pictureKind = current
      pictureSite = e.requestId
      // the timer swaps frames in place; a redraw sends only the one on screen
      follow()
      picture ??= $.clock.every(PICTURE_MS, () => {
        if (!follow()) {
          pictureFrame = (pictureFrame + 1) % (pictureKind === 'writer' ? WRITER_FRAMES[writerClip()] : PICTURE_FRAMES)
        }
        void $.ui.blit({ requestId: pictureSite, key: pictureKind, source: pictureSource($) }).then(result => {
          if (result.deny === undefined) {
            return
          }
          stopPicture()
          // shortcut: matches the deny's words, as only tmux has a `fix` code; key on a code if one comes
          // not mounted is a passing gap between redraws: the next render starts the timer again
          if (!result.deny.includes('mounted')) {
            $.ui.log(`${pictureKind} picture refused (${result.deny}), playing its text stand-in instead`)
            canShowImages = false
          }
        })
      })
      const { Image } = $.ui.resolve(e)
      return <Image key={current} source={pictureSource($)} columns={width} rows={Math.min(Math.round((width * 3) / 80), e.props.maxRows)} alt=" " />
    }
    stopPicture()

    const rows = isGallery
      ? KINDS.flatMap(k => [[{ text: k, color: 'gray' }], ...ANIMATIONS[k](t, width)])
      : ANIMATIONS[current](t, width)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {rows.map(row => (
          <Box>
            {row.map(seg => (
              <Text color={seg.color} backgroundColor={seg.bg} wrap="truncate-end">
                {seg.text}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
