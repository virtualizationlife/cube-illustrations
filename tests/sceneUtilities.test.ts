import { describe, expect, it, vi } from 'vitest'

import { getWideGridFadeRadii } from '../src/scenes/gridFade'
import {
    createSceneRandom,
    createSeededRandom,
    getDifferentRandomIndex,
    getRandomIndex,
    getRandomItem,
    shuffle,
} from '../src/scenes/sceneRandom'
import {
    SIGN_DIRECTIONS,
    SIGN_SYMBOLS,
    getSignSymbolValidationErrors,
    rotateSignSymbol,
} from '../src/scenes/signSymbols'
import { getSceneRenderRect } from '../src/scenes/SceneRenderHost'
import {
    runSceneScript,
    SceneCancelledError,
} from '../src/scenes/runSceneScript'
import { startSceneAnimation } from '../src/scenes/startSceneAnimation'
import type { GridSceneRuntime } from '../src/scenes/gridSceneRuntime'
import { defineScene } from '../src/sdk/defineScene'
import { createSceneChoreography } from '../src/sdk/choreography'

describe('scene random utilities', () => {
    it('shuffles a copy without modifying the source', () => {
        const source = [1, 2, 3, 4]

        expect(shuffle(source, () => 0)).toEqual([2, 3, 4, 1])
        expect(source).toEqual([1, 2, 3, 4])
    })

    it('handles empty collections and can exclude the previous index', () => {
        expect(getRandomIndex(0)).toBe(-1)
        expect(getRandomItem([], () => 0.5)).toBeUndefined()
        expect(getDifferentRandomIndex(4, 1, () => 0)).toBe(0)
        expect(getDifferentRandomIndex(4, 1, () => 0.99)).toBe(3)
        expect(getDifferentRandomIndex(1, 0)).toBe(0)
    })

    it('replays the same choices from the same seed', () => {
        const first = createSeededRandom('scene-42')
        const second = createSeededRandom('scene-42')

        expect(Array.from({ length: 8 }, first)).toEqual(Array.from({ length: 8 }, second))
        expect(createSceneRandom(42).shuffle([1, 2, 3, 4])).toEqual(
            createSceneRandom(42).shuffle([1, 2, 3, 4])
        )
    })
})

describe('grid fade utilities', () => {
    it('uses the full grid radius and a clamped opaque center ratio', () => {
        expect(getWideGridFadeRadii(19)).toEqual({
            innerRadiusCells: 4,
            outerRadiusCells: 10,
        })
        expect(getWideGridFadeRadii(10, 2)).toEqual({
            innerRadiusCells: 5,
            outerRadiusCells: 5,
        })
        expect(getWideGridFadeRadii(10, -1)).toEqual({
            innerRadiusCells: 0,
            outerRadiusCells: 5,
        })
    })
})

describe('scene render rectangles', () => {
    it('keeps viewport and scissor coordinates in logical top-left pixels', () => {
        expect(
            getSceneRenderRect(
                { left: 120, top: 80, width: 260, height: 240 },
                { left: 100, top: 50 },
                1000,
                800
            )
        ).toEqual({
            viewport: { x: 20, y: 30, width: 260, height: 240 },
            scissor: { x: 20, y: 30, width: 260, height: 240 },
        })
    })

    it('clips only the scissor while preserving a partially visible viewport', () => {
        expect(
            getSceneRenderRect(
                { left: -20, top: -30, width: 260, height: 240 },
                { left: 0, top: 0 },
                200,
                150
            )
        ).toEqual({
            viewport: { x: -20, y: -30, width: 260, height: 240 },
            scissor: { x: 0, y: 0, width: 200, height: 150 },
        })
    })

    it('returns an empty scissor for a slot outside the canvas', () => {
        expect(
            getSceneRenderRect(
                { left: 500, top: 500, width: 100, height: 100 },
                { left: 0, top: 0 },
                200,
                150
            ).scissor
        ).toEqual({ x: 200, y: 150, width: 0, height: 0 })
    })
})

describe('sign symbol catalog', () => {
    it('contains valid nine-cell symbols with unique names and positions', () => {
        expect(SIGN_SYMBOLS).toHaveLength(12)
        expect(getSignSymbolValidationErrors()).toEqual([])
    })

    it('preserves every symbol while rotating it in all directions', () => {
        for (const symbol of SIGN_SYMBOLS) {
            for (const direction of SIGN_DIRECTIONS) {
                const rotated = rotateSignSymbol(symbol.positions, direction)
                const uniqueCells = new Set(
                    rotated.map(({ column, row }) => `${column},${row}`)
                )
                expect(rotated).toHaveLength(symbol.positions.length)
                expect(uniqueCells.size).toBe(symbol.positions.length)
            }
        }
    })
})

describe('background scene animations', () => {
    it('reports rejected animation tasks with their scene name', async () => {
        const error = new Error('animation failed')
        const onError = vi.fn()

        await startSceneAnimation(
            'Test Scene',
            async () => Promise.reject(error),
            onError
        )

        expect(onError).toHaveBeenCalledOnce()
        expect(onError).toHaveBeenCalledWith(error, 'Test Scene')
    })

    it('cancels active SDK delays without reporting an error', async () => {
        const onError = vi.fn()
        const runtime = {} as GridSceneRuntime
        let reachedAfterDelay = false
        const handle = runSceneScript(
            'Cancelled Scene',
            runtime,
            async ({ delay }) => {
                await delay(60)
                reachedAfterDelay = true
            },
            onError
        )

        handle.dispose()
        await handle.completion

        expect(handle.signal.aborted).toBe(true)
        expect(reachedAfterDelay).toBe(false)
        expect(onError).not.toHaveBeenCalled()
    })

    it('cancels an in-flight runtime command and blocks later sync commands', async () => {
        let resolveMove = (): void => undefined
        const move = new Promise<void>((resolve) => {
            resolveMove = resolve
        })
        const setCubeOpacity = vi.fn()
        const runtime = {
            moveCubeTo: vi.fn(() => move),
            setCubeOpacity,
        } as unknown as GridSceneRuntime
        const handle = runSceneScript('Moving Scene', runtime, async ({ runtime: scene }) => {
            await scene.moveCubeTo('main', { column: 1, row: 0 }, { duration: 1 })
            scene.setCubeOpacity('main', 0)
        })

        handle.dispose()
        await handle.completion
        resolveMove()

        expect(setCubeOpacity).not.toHaveBeenCalled()
    })

    it('reports non-cancellation errors from SDK scripts', async () => {
        const error = new Error('script failed')
        const onError = vi.fn()
        const handle = runSceneScript(
            'Broken Scene',
            {} as GridSceneRuntime,
            async () => Promise.reject(error),
            onError
        )

        await handle.completion

        expect(onError).toHaveBeenCalledWith(error, 'Broken Scene')
    })

    it('does not treat an arbitrary cancellation-shaped error as teardown', async () => {
        const onError = vi.fn()
        const error = new SceneCancelledError()
        const handle = runSceneScript(
            'Unexpected Cancellation',
            {} as GridSceneRuntime,
            async () => Promise.reject(error),
            onError
        )

        await handle.completion

        expect(onError).toHaveBeenCalledWith(error, 'Unexpected Cancellation')
    })
})

describe('scene definitions', () => {
    it('attaches serializable metadata to generated scene components', () => {
        const Scene = defineScene({
            metadata: {
                id: 'test-scene',
                title: 'Test Scene',
                tags: ['test', 'sdk'],
            },
            view: {
                cubeSize: 0.1,
                gridCellSize: 0.1,
                gridCellCount: 5,
                cameraAzimuthDeg: 45,
                viewOffsetY: 0,
                hoverCells: 0,
            },
        })

        expect(Scene.scene).toEqual({
            id: 'test-scene',
            title: 'Test Scene',
            tags: ['test', 'sdk'],
        })
    })

    it('composes cube actors and timeline sequences over the runtime', async () => {
        const calls: string[] = []
        const runtime = {
            fadeCubeTo: vi.fn(async (_id: string, opacity: number) => {
                calls.push(`fade:${opacity}`)
            }),
            moveCubeTo: vi.fn(async (_id: string) => {
                calls.push('move')
            }),
        } as unknown as GridSceneRuntime
        const { cubes, timeline } = createSceneChoreography(runtime, async (seconds) => {
            calls.push(`wait:${seconds}`)
        })

        await timeline.sequence(['first', 'second'], async (id) => {
            await cubes.get(id).pulse()
        })
        await cubes.main.moveAndFade(
            { column: 1, row: 0 },
            0,
            { duration: 0.4 }
        )

        expect(calls).toEqual([
            'fade:0.28',
            'fade:1',
            'fade:0.28',
            'fade:1',
            'move',
            'fade:0',
        ])
    })
})
