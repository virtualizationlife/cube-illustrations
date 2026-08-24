import { describe, expect, it, vi } from 'vitest'

import { createSceneChoreography } from '../src/sdk/choreography'
import { SceneCancelledError } from '../src/scenes/runSceneScript'
import { createFakeSceneRuntime } from './support/fakeSceneRuntime'

const MOVE = { duration: 0.4, easing: 'easeInOutCubic' } as const
const CELL = { column: 2, row: -1 }

/** A delay that records what was asked for and resolves at once. */
const createRecordingDelay = (): {
    delay: (durationSeconds: number) => Promise<void>
    waits: number[]
} => {
    const waits: number[] = []
    return {
        waits,
        delay: (durationSeconds) => {
            waits.push(durationSeconds)
            return Promise.resolve()
        },
    }
}

const setup = (): ReturnType<typeof createSceneChoreography> & {
    fake: ReturnType<typeof createFakeSceneRuntime>
    waits: number[]
} => {
    const fake = createFakeSceneRuntime()
    const { delay, waits } = createRecordingDelay()
    const choreography = createSceneChoreography(fake.runtime, delay)
    return { ...choreography, fake, waits }
}

describe('createSceneChoreography', () => {
    it('memoises one actor per cube id', () => {
        const { cubes } = setup()
        expect(cubes.get('walker')).toBe(cubes.get('walker'))
        expect(cubes.get('walker')).not.toBe(cubes.get('other'))
        expect(cubes.main.id).toBe('main')
        expect(cubes.get('main')).toBe(cubes.main)
    })

    it('drives position and opacity together in moveAndFade', async () => {
        const { cubes, fake } = setup()
        const task = cubes.get('walker').moveAndFade(CELL, 0, MOVE)
        // Both transitions must be in flight before either is awaited.
        expect(fake.pendingCount()).toBe(2)
        fake.settlePending()
        await task
        expect(fake.methodNames()).toEqual(['moveCubeTo', 'fadeCubeTo'])
    })

    it('pulses down and back up with its documented defaults', async () => {
        const { cubes, fake } = setup()
        const task = cubes.main.pulse()
        fake.settlePending()
        await Promise.resolve()
        fake.settlePending()
        await task

        const fades = fake.calls.filter((call) => call.method === 'fadeCubeTo')
        expect(fades).toHaveLength(2)
        expect(fades[0]?.args[1]).toBe(0.28)
        expect(fades[1]?.args[1]).toBe(1)
    })

    it('runs a sequence in order, one item at a time', async () => {
        const { timeline } = setup()
        const seen: number[] = []
        let concurrent = 0
        let peak = 0

        await timeline.sequence([10, 20, 30], async (item, index) => {
            concurrent += 1
            peak = Math.max(peak, concurrent)
            seen.push(item + index)
            await Promise.resolve()
            concurrent -= 1
        })

        expect(seen).toEqual([10, 21, 32])
        expect(peak).toBe(1)
    })

    it('staggers each task by its index and waits for all of them', async () => {
        const { timeline, waits } = setup()
        const finished: number[] = []

        await timeline.stagger(['a', 'b', 'c'], 0.2, async (_item, index) => {
            finished.push(index)
        })

        // The first task starts immediately; the rest wait index * gap.
        expect(waits).toEqual([0.2, 0.4])
        expect(finished).toHaveLength(3)
    })

    it('treats a negative stagger gap as no gap', async () => {
        const { timeline, waits } = setup()
        await timeline.stagger(['a', 'b'], -1, async () => undefined)
        expect(waits).toEqual([0])
    })

    it('repeats a loop until its body throws', async () => {
        const { timeline } = setup()
        let iterations = 0

        await expect(
            timeline.loop(async (iteration) => {
                iterations = iteration + 1
                if (iteration === 2) throw new SceneCancelledError()
                await Promise.resolve()
            })
        ).rejects.toBeInstanceOf(SceneCancelledError)

        expect(iterations).toBe(3)
    })

    it('propagates cancellation raised by a runtime call inside a loop', async () => {
        const fake = createFakeSceneRuntime()
        const cancelling = vi.fn(() => {
            throw new SceneCancelledError()
        })
        const { timeline } = createSceneChoreography(
            { ...fake.runtime, setCubeOpacity: cancelling },
            () => Promise.resolve()
        )

        await expect(
            timeline.loop(async () => {
                cancelling()
            })
        ).rejects.toBeInstanceOf(SceneCancelledError)
        expect(cancelling).toHaveBeenCalledTimes(1)
    })

    it('waits for every task handed to all()', async () => {
        const { timeline } = setup()
        let done = 0
        await timeline.all([
            Promise.resolve().then(() => { done += 1 }),
            Promise.resolve().then(() => { done += 1 }),
        ])
        expect(done).toBe(2)
    })
})
