import { afterEach, describe, expect, it, vi } from 'vitest'

import { runSceneScript } from '@runtime/core/runSceneScript'
import { getSceneTimeScale, scaleSceneDuration, setSceneTimeScale } from '@runtime/core/timeScale'

import { createFakeSceneRuntime } from '../support/fakeSceneRuntime'

afterEach(() => {
    setSceneTimeScale(1)
})

describe('scene time scale', () => {
    it('plays at authored speed by default', () => {
        expect(getSceneTimeScale()).toBe(1)
        expect(scaleSceneDuration(0.5)).toBe(0.5)
    })

    it('shortens durations when the gallery is sped up', () => {
        setSceneTimeScale(1.15)
        expect(scaleSceneDuration(1.15)).toBeCloseTo(1)
    })

    it('lengthens durations when the gallery is slowed down', () => {
        setSceneTimeScale(0.5)
        expect(scaleSceneDuration(1)).toBe(2)
    })

    it('never divides by zero or by a negative scale', () => {
        setSceneTimeScale(0)
        expect(Number.isFinite(scaleSceneDuration(1))).toBe(true)
        setSceneTimeScale(-4)
        expect(Number.isFinite(scaleSceneDuration(1))).toBe(true)
    })

    it('ignores a scale that is not a finite number', () => {
        setSceneTimeScale(2)
        setSceneTimeScale(Number.NaN)
        expect(getSceneTimeScale()).toBe(2)
        setSceneTimeScale(Number.POSITIVE_INFINITY)
        expect(getSceneTimeScale()).toBe(2)
    })

    // The frame clock is what carries the scale into transitions and per-frame animation;
    // authored durations themselves are left untouched.
    it('leaves authored transition durations alone', async () => {
        setSceneTimeScale(4)
        const fake = createFakeSceneRuntime()
        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ runtime }) => {
                await runtime.moveCubeTo(
                    'main',
                    { column: 1, row: 0 },
                    {
                        duration: 0.8,
                        easing: 'linear',
                    }
                )
            },
            vi.fn()
        )
        await Promise.resolve()

        const move = fake.calls.find((call) => call.method === 'moveCubeTo')
        expect((move?.args[2] as { duration: number }).duration).toBe(0.8)
        handle.dispose()
    })

    it('treats a negative duration as no wait at all', () => {
        expect(scaleSceneDuration(-3)).toBe(0)
    })

    it('applies to timeline waits, not only to transitions', async () => {
        vi.useFakeTimers()
        try {
            setSceneTimeScale(2)
            const fake = createFakeSceneRuntime()
            let resumed = false
            const handle = runSceneScript(
                'test',
                fake.runtime,
                async ({ delay }) => {
                    await delay(1)
                    resumed = true
                },
                vi.fn()
            )

            // Half of the authored second is enough at double speed.
            await vi.advanceTimersByTimeAsync(500)
            expect(resumed).toBe(true)
            handle.dispose()
        } finally {
            vi.useRealTimers()
        }
    })
})
