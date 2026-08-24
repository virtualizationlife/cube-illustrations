import { describe, expect, it, vi } from 'vitest'

import { runSceneScript, SceneCancelledError } from '@runtime/core/runSceneScript'

import { createFakeSceneRuntime } from '../support/fakeSceneRuntime'

const LINEAR = { duration: 0.5, easing: 'linear' } as const
const CELL = { column: 1, row: 0 }

/** Lets the script body run up to its first suspension point. */
const flush = (): Promise<void> => Promise.resolve()

describe('runSceneScript', () => {
    it('stops the script at a delay when disposed', async () => {
        const fake = createFakeSceneRuntime()
        const onError = vi.fn()
        let resumed = false

        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ delay, runtime }) => {
                await delay(10)
                resumed = true
                runtime.setCubeOpacity('main', 1)
            },
            onError
        )

        handle.dispose()
        await handle.completion

        expect(resumed).toBe(false)
        expect(fake.methodNames()).not.toContain('setCubeOpacity')
        expect(onError).not.toHaveBeenCalled()
    })

    it('stops the script inside an asynchronous runtime command when disposed', async () => {
        const fake = createFakeSceneRuntime()
        const onError = vi.fn()
        let resumed = false

        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ runtime }) => {
                await runtime.moveCubeTo('main', CELL, LINEAR)
                resumed = true
                runtime.setCubeOpacity('main', 0)
            },
            onError
        )

        await flush()
        expect(fake.pendingCount()).toBe(1)

        handle.dispose()
        // Teardown resolves outstanding transitions; the script must not resume anyway.
        fake.settlePending()
        await handle.completion

        expect(resumed).toBe(false)
        expect(fake.methodNames()).not.toContain('setCubeOpacity')
        expect(onError).not.toHaveBeenCalled()
    })

    it('reports a genuine script error', async () => {
        const fake = createFakeSceneRuntime()
        const onError = vi.fn()
        const failure = new Error('scene exploded')

        const handle = runSceneScript(
            'test',
            fake.runtime,
            async () => {
                await Promise.resolve()
                throw failure
            },
            onError
        )

        await handle.completion

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError).toHaveBeenCalledWith(failure, 'test')
    })

    it('settles completion after cancellation instead of hanging', async () => {
        const fake = createFakeSceneRuntime()
        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ delay }) => {
                for (;;) await delay(10)
            },
            vi.fn()
        )

        handle.dispose()

        const outcome = await Promise.race([
            handle.completion.then(() => 'settled'),
            new Promise((resolve) =>
                globalThis.setTimeout(() => {
                    resolve('hung')
                }, 500)
            ),
        ])
        expect(outcome).toBe('settled')
        expect(handle.signal.aborted).toBe(true)
    })

    // This is the documented boundary of the guarantee: cancellation interrupts
    // SDK-controlled awaits, and every runtime call is guarded on entry — but a
    // foreign promise is not interrupted, so the script does resume there.
    it('does not interrupt a foreign await, yet blocks the next runtime call', async () => {
        const fake = createFakeSceneRuntime()
        const onError = vi.fn()
        let resumed = false
        let commandRan = false
        let releaseForeign = (): void => undefined
        const foreign = new Promise<void>((resolve) => {
            releaseForeign = resolve
        })

        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ runtime }) => {
                await foreign
                resumed = true
                runtime.setCubeOpacity('main', 0.5)
                commandRan = true
            },
            onError
        )

        await flush()
        handle.dispose()
        releaseForeign()
        await handle.completion

        expect(resumed).toBe(true)
        expect(commandRan).toBe(false)
        expect(fake.methodNames()).not.toContain('setCubeOpacity')
        expect(onError).not.toHaveBeenCalled()
    })

    it('guards synchronous runtime methods too, not only the asynchronous ones', async () => {
        const fake = createFakeSceneRuntime()
        let thrown: unknown = null

        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ runtime, delay }) => {
                try {
                    await delay(10)
                } catch {
                    // Swallowing the cancellation the way a careless script would.
                }
                try {
                    runtime.setCubePosition('main', CELL)
                } catch (error) {
                    thrown = error
                    throw error
                }
            },
            vi.fn()
        )

        handle.dispose()
        await handle.completion

        expect(thrown).toBeInstanceOf(SceneCancelledError)
        expect(fake.methodNames()).not.toContain('setCubePosition')
    })

    it('runs the script normally when it is never cancelled', async () => {
        const fake = createFakeSceneRuntime()
        const onError = vi.fn()

        const handle = runSceneScript(
            'test',
            fake.runtime,
            async ({ runtime, delay }) => {
                runtime.setCubePosition('main', CELL)
                const movement = runtime.moveCubeTo('main', CELL, LINEAR)
                fake.settlePending()
                await movement
                await delay(0)
                runtime.setCubeOpacity('main', 1)
            },
            onError
        )

        await handle.completion

        expect(onError).not.toHaveBeenCalled()
        expect(fake.methodNames()).toEqual(['setCubePosition', 'moveCubeTo', 'setCubeOpacity'])
    })
})
