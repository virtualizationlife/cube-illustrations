export interface DisposerStack {
    /**
     * Registers a resource release. Registering after `dispose()` releases immediately,
     * which is what asynchronous setup needs: a resource may be acquired after teardown
     * has already run.
     */
    readonly add: (dispose: () => void) => void
    /** Releases in reverse order of registration. Safe to call more than once. */
    readonly dispose: () => void
    readonly isDisposed: () => boolean
}

export const createDisposerStack = (): DisposerStack => {
    const disposers: (() => void)[] = []
    let disposed = false

    return {
        add: (dispose) => {
            if (disposed) {
                dispose()
                return
            }
            disposers.push(dispose)
        },
        dispose: () => {
            if (disposed) return
            disposed = true
            while (disposers.length > 0) disposers.pop()?.()
        },
        isDisposed: () => disposed,
    }
}
