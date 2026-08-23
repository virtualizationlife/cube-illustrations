export interface CancellableDelay {
    readonly wait: (durationSeconds: number) => Promise<void>
    readonly cancel: () => void
}

/** Creates a reusable delay whose active wait is resolved immediately when cancelled. */
export const createCancellableDelay = (): CancellableDelay => {
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null
    let resolveWait: (() => void) | null = null

    const finish = (): void => {
        if (timer !== null) globalThis.clearTimeout(timer)
        timer = null

        const resolve = resolveWait
        resolveWait = null
        resolve?.()
    }

    return {
        wait: (durationSeconds) =>
            new Promise((resolve) => {
                finish()
                resolveWait = resolve
                timer = globalThis.setTimeout(finish, Math.max(0, durationSeconds) * 1000)
            }),
        cancel: finish,
    }
}
