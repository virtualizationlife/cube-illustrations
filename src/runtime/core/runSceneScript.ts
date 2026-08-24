import {
    startSceneAnimation,
    type SceneAnimationErrorHandler,
} from '@runtime/animation/startSceneAnimation'
import { scaleSceneDuration } from '@runtime/core/timeScale'
import type { GridSceneRuntime } from '@runtime/grid/gridSceneRuntime'

const ASYNC_RUNTIME_METHODS = new Set<PropertyKey>([
    'moveCubeTo',
    'fadeCubeTo',
    'moveGridFocusTo',
    'travelWithCube',
])

export class SceneCancelledError extends Error {
    public constructor() {
        super('Scene script cancelled')
        this.name = 'SceneCancelledError'
    }
}

export type SceneScriptContext = {
    /** A cancellation-aware view of the scene runtime. */
    readonly runtime: GridSceneRuntime
    /** Waits for scene time in seconds and rejects immediately when disposed. */
    readonly delay: (durationSeconds: number) => Promise<void>
    /** Escape hatch for custom asynchronous work. */
    readonly signal: AbortSignal
}

export type SceneScriptHandle = {
    readonly signal: AbortSignal
    /** Settles after the script exits, is cancelled, or reports an error. */
    readonly completion: Promise<void>
    readonly dispose: () => void
}

const throwIfCancelled = (signal: AbortSignal): void => {
    if (signal.aborted) throw new SceneCancelledError()
}

const raceWithCancellation = <Value>(
    promise: PromiseLike<Value>,
    signal: AbortSignal
): Promise<Value> => {
    throwIfCancelled(signal)

    return new Promise<Value>((resolve, reject) => {
        const handleAbort = (): void => {
            reject(new SceneCancelledError())
        }
        signal.addEventListener('abort', handleAbort, { once: true })

        void Promise.resolve(promise).then(
            (value) => {
                signal.removeEventListener('abort', handleAbort)
                resolve(value)
            },
            (error: unknown) => {
                signal.removeEventListener('abort', handleAbort)
                reject(error instanceof Error ? error : new Error(String(error)))
            }
        )
    })
}

const createAbortableDelay =
    (signal: AbortSignal): ((durationSeconds: number) => Promise<void>) =>
    (durationSeconds) => {
        throwIfCancelled(signal)

        return new Promise<void>((resolve, reject) => {
            const finish = (): void => {
                signal.removeEventListener('abort', handleAbort)
                resolve()
            }
            const handleAbort = (): void => {
                globalThis.clearTimeout(timer)
                reject(new SceneCancelledError())
            }
            const timer = globalThis.setTimeout(finish, scaleSceneDuration(durationSeconds) * 1000)
            signal.addEventListener('abort', handleAbort, { once: true })
        })
    }

const createCancellationAwareRuntime = (
    runtime: GridSceneRuntime,
    signal: AbortSignal
): GridSceneRuntime => {
    const wrappedMethods = new Map<PropertyKey, (...args: never[]) => unknown>()

    return new Proxy(runtime, {
        get(target, property, receiver): unknown {
            const value: unknown = Reflect.get(target, property, receiver)
            if (typeof value !== 'function') return value

            const existing = wrappedMethods.get(property)
            if (existing !== undefined) return existing

            const wrapped = (...args: never[]): unknown => {
                throwIfCancelled(signal)
                const callable = value as (...args: never[]) => unknown
                const apply = Reflect.apply as unknown as (
                    target: (...args: never[]) => unknown,
                    thisArg: unknown,
                    args: never[]
                ) => unknown
                const result = apply(callable, target, args)
                return ASYNC_RUNTIME_METHODS.has(property)
                    ? raceWithCancellation(Promise.resolve(result), signal)
                    : result
            }
            wrappedMethods.set(property, wrapped)
            return wrapped
        },
    })
}

/**
 * Runs scene choreography with automatic cancellation at every SDK delay and asynchronous
 * runtime command. Cancellation is expected teardown and is never reported as an error.
 */
export const runSceneScript = (
    animationName: string,
    runtime: GridSceneRuntime,
    script: (context: SceneScriptContext) => Promise<void>,
    onError?: SceneAnimationErrorHandler
): SceneScriptHandle => {
    const controller = new AbortController()
    const { signal } = controller
    const context: SceneScriptContext = {
        runtime: createCancellationAwareRuntime(runtime, signal),
        delay: createAbortableDelay(signal),
        signal,
    }

    const play = async (): Promise<void> => {
        try {
            await script(context)
        } catch (error) {
            if (error instanceof SceneCancelledError && signal.aborted) return
            throw error
        }
    }

    const completion =
        onError === undefined
            ? startSceneAnimation(animationName, play)
            : startSceneAnimation(animationName, play, onError)

    return {
        signal,
        completion,
        dispose: () => {
            controller.abort()
        },
    }
}
