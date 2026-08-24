import type { GridSceneTransitionOptions } from '@runtime/grid/gridSceneRuntime'

/**
 * Named transitions for movements that mean the same thing across scenes.
 *
 * This is a vocabulary, not a rule: a scene whose timing is part of what it is saying keeps
 * its own numbers. Reach for a token when the movement is ordinary — a cube walking a cell,
 * entering the frame, leaving it — and leave a deliberate 0.83 alone.
 *
 * For changing how fast everything plays, use `setSceneTimeScale` instead: it scales every
 * duration, tokenised or not.
 */
export const MOTION = {
    /** One cube stepping to a neighbouring cell. */
    step: { duration: 0.34, easing: 'easeInOutCubic' },
    /** A cube crossing several cells at once. */
    travel: { duration: 0.72, easing: 'easeInOutCubic' },
    /** Coming into the frame. */
    enter: { duration: 0.52, easing: 'easeOutCubic' },
    /** Leaving the frame. */
    exit: { duration: 0.5, easing: 'easeOutCubic' },
    /** The dip of an attention pulse. */
    pulseDown: { duration: 0.12, easing: 'easeOutCubic' },
    /** The recovery of an attention pulse. */
    pulseUp: { duration: 0.16, easing: 'easeOutCubic' },
} as const satisfies Record<string, GridSceneTransitionOptions>

/**
 * Grid compositions shared by more than one scene. Only combinations that mean the same
 * framing are listed; a size that merely happens to match another scene's is not a preset.
 */
export const GRID_PRESETS = {
    /** A corridor-length view: wide enough for entries and exits off both sides. */
    corridor: { gridCellSize: 0.05, gridCellCount: 17 },
} as const satisfies Record<
    string,
    { readonly gridCellSize: number; readonly gridCellCount: number }
>
