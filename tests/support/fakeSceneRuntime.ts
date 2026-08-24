import type { GridCoordinate, GridSceneRuntime } from '@runtime/grid/gridSceneRuntime'

export type RecordedCall = {
    readonly method: string
    readonly args: readonly unknown[]
}

export type FakeSceneRuntime = {
    readonly runtime: GridSceneRuntime
    /** Every runtime method that actually ran, in order. */
    readonly calls: RecordedCall[]
    readonly methodNames: () => readonly string[]
    /** Resolves the transitions still in flight, the way `dispose()` does in production. */
    readonly settlePending: () => void
    readonly pendingCount: () => number
}

const ORIGIN: GridCoordinate = { column: 0, row: 0 }

/**
 * A `GridSceneRuntime` without a GPU. Asynchronous transitions stay pending until
 * `settlePending()` is called, which reproduces the production teardown where
 * `dispose()` resolves rather than rejects every outstanding transition.
 */
export const createFakeSceneRuntime = (): FakeSceneRuntime => {
    const calls: RecordedCall[] = []
    const pending: (() => void)[] = []

    const record = (method: string, ...args: unknown[]): void => {
        calls.push({ method, args })
    }

    const transition = (method: string, ...args: unknown[]): Promise<void> => {
        record(method, ...args)
        return new Promise<void>((resolve) => {
            pending.push(resolve)
        })
    }

    const stub = {} as GridSceneRuntime['mainCube']

    const runtime: GridSceneRuntime = {
        grid: stub,
        mainCube: stub,
        addCube: (definition) => {
            record('addCube', definition)
            return stub
        },
        removeCube: (id) => {
            record('removeCube', id)
        },
        hasCube: (id) => {
            record('hasCube', id)
            return true
        },
        getCube: (id) => {
            record('getCube', id)
            return stub
        },
        getCubes: () => {
            record('getCubes')
            return []
        },
        getCubeRevision: () => {
            record('getCubeRevision')
            return 0
        },
        getCubePosition: (id) => {
            record('getCubePosition', id)
            return ORIGIN
        },
        getCubeOpacity: (id) => {
            record('getCubeOpacity', id)
            return 1
        },
        setCubeFaceLabels: (id, labels) => {
            record('setCubeFaceLabels', id, labels)
        },
        setCubePosition: (id, position) => {
            record('setCubePosition', id, position)
        },
        setCubeOccupiesCell: (id, occupiesCell) => {
            record('setCubeOccupiesCell', id, occupiesCell)
        },
        moveCubeTo: (id, position, options) => transition('moveCubeTo', id, position, options),
        setCubeOpacity: (id, opacity) => {
            record('setCubeOpacity', id, opacity)
        },
        fadeCubeTo: (id, opacity, options) => transition('fadeCubeTo', id, opacity, options),
        getGridFocus: () => {
            record('getGridFocus')
            return ORIGIN
        },
        setGridFocus: (position) => {
            record('setGridFocus', position)
        },
        moveGridFocusTo: (position, options) => transition('moveGridFocusTo', position, options),
        setGridOpacity: (opacity) => {
            record('setGridOpacity', opacity)
        },
        setGridVisibility: (visibility) => {
            record('setGridVisibility', visibility)
        },
        setGridFadeRadii: (inner, outer) => {
            record('setGridFadeRadii', inner, outer)
        },
        travelWithCube: (id, position, options) =>
            transition('travelWithCube', id, position, options),
        update: (delta) => {
            record('update', delta)
        },
        dispose: () => {
            record('dispose')
        },
    }

    return {
        runtime,
        calls,
        methodNames: () => calls.map((call) => call.method),
        settlePending: () => {
            const waiting = pending.splice(0, pending.length)
            for (const resolve of waiting) resolve()
        },
        pendingCount: () => pending.length,
    }
}
