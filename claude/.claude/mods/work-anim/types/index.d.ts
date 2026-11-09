export type Kind = 'fish' | 'pong' | 'rain' | 'snow' | 'walk' | 'broom' | 'boat' | 'sleigh' | 'writer'

declare module 'claude-code' {
  interface PluginState {
    'work-anim': { tick: number | null; kind: Kind }
  }
}
