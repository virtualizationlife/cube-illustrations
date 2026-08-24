import { MOTION } from '../scenes/motion'
import type {
    GridCoordinate,
    GridSceneRuntime,
    GridSceneTransitionOptions,
} from '../scenes/gridSceneRuntime'

export interface ScenePulseOptions {
    readonly opacity?: number
    readonly downDuration?: number
    readonly upDuration?: number
    readonly easing?: GridSceneTransitionOptions['easing']
}

export interface SceneCubeActor {
    readonly id: string
    readonly setPosition: (position: GridCoordinate) => void
    readonly moveTo: (
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly setOpacity: (opacity: number) => void
    readonly fadeTo: (
        opacity: number,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly moveAndFade: (
        position: GridCoordinate,
        opacity: number,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly pulse: (options?: ScenePulseOptions) => Promise<void>
}

export interface SceneCubeActors {
    readonly get: (id: string) => SceneCubeActor
    readonly main: SceneCubeActor
}

export interface SceneTimeline {
    readonly wait: (durationSeconds: number) => Promise<void>
    readonly all: (tasks: Iterable<PromiseLike<unknown>>) => Promise<void>
    readonly sequence: <Item>(
        items: Iterable<Item>,
        task: (item: Item, index: number) => Promise<unknown>
    ) => Promise<void>
    /** Starts each task after an increasing delay, then waits for all of them. */
    readonly stagger: <Item>(
        items: Iterable<Item>,
        gapSeconds: number,
        task: (item: Item, index: number) => Promise<unknown>
    ) => Promise<void>
    /** Repeats until the scene script is cancelled or the callback throws. */
    readonly loop: (task: (iteration: number) => Promise<void>) => Promise<never>
}

export interface SceneChoreography {
    readonly cubes: SceneCubeActors
    readonly timeline: SceneTimeline
}

export const createSceneChoreography = (
    runtime: GridSceneRuntime,
    delay: (durationSeconds: number) => Promise<void>
): SceneChoreography => {
    const actors = new Map<string, SceneCubeActor>()

    const getActor = (id: string): SceneCubeActor => {
        const existing = actors.get(id)
        if (existing !== undefined) return existing

        const actor: SceneCubeActor = {
            id,
            setPosition: (position) => runtime.setCubePosition(id, position),
            moveTo: (position, options) => runtime.moveCubeTo(id, position, options),
            setOpacity: (opacity) => runtime.setCubeOpacity(id, opacity),
            fadeTo: (opacity, options) => runtime.fadeCubeTo(id, opacity, options),
            moveAndFade: async (position, opacity, options) => {
                await Promise.all([
                    runtime.moveCubeTo(id, position, options),
                    runtime.fadeCubeTo(id, opacity, options),
                ])
            },
            pulse: async ({
                opacity = 0.28,
                downDuration = MOTION.pulseDown.duration,
                upDuration = MOTION.pulseUp.duration,
                easing = MOTION.pulseDown.easing,
            } = {}) => {
                await runtime.fadeCubeTo(id, opacity, {
                    duration: downDuration,
                    easing,
                })
                await runtime.fadeCubeTo(id, 1, {
                    duration: upDuration,
                    easing,
                })
            },
        }
        actors.set(id, actor)
        return actor
    }

    const timeline: SceneTimeline = {
        wait: delay,
        all: async (tasks) => {
            await Promise.all(tasks)
        },
        sequence: async (items, task) => {
            let index = 0
            for (const item of items) {
                await task(item, index)
                index += 1
            }
        },
        stagger: async (items, gapSeconds, task) => {
            await Promise.all(
                [...items].map(async (item, index) => {
                    if (index > 0) await delay(index * Math.max(0, gapSeconds))
                    await task(item, index)
                })
            )
        },
        loop: async (task): Promise<never> => {
            let iteration = 0
            for (;;) {
                await task(iteration)
                iteration += 1
            }
        },
    }

    return {
        cubes: {
            get: getActor,
            main: getActor('main'),
        },
        timeline,
    }
}
