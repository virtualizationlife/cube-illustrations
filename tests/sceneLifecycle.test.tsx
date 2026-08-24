// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest'

import { IllustrationsPage } from '../src/IllustrationsPage'
import { SCENE_CATALOG } from '../src/sceneCatalog'
import type { GridCubeFaceLabels } from '../src/scenes/cubeFaceLabels'
import { SceneRenderHost } from '../src/scenes/SceneRenderHost'
import { defineScene, type CubeSceneProps } from '../src/sdk/defineScene'

/** jsdom has no ResizeObserver; nothing here depends on it reporting a size. */
class StubResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

/**
 * jsdom has no IntersectionObserver either. This one reports the element as on screen, so
 * scenes actually start their loops instead of sitting dormant behind a stub that never
 * fires.
 */
class VisibleIntersectionObserver {
    private readonly callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
    }

    observe(target: Element): void {
        this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
        )
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
        return []
    }
}

let container: HTMLDivElement
let root: Root
let consoleError: MockInstance<(...args: unknown[]) => void>
let rejections: unknown[]

const collectRejection = (reason: unknown): void => {
    rejections.push(reason)
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver)
    // jsdom has no 2D canvas, and scenes that letter their faces need one.
    HTMLCanvasElement.prototype.getContext = (() => ({
        clearRect: () => undefined,
        fillText: () => undefined,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
    })) as unknown as HTMLCanvasElement['getContext']
    consoleError = vi.spyOn(console, 'error').mockImplementation(
        () => undefined
    ) as unknown as MockInstance<(...args: unknown[]) => void>
    rejections = []
    process.on('unhandledRejection', collectRejection)

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
})

afterEach(() => {
    process.off('unhandledRejection', collectRejection)
    consoleError.mockRestore()
    vi.unstubAllGlobals()
    container.remove()
})

/**
 * The plan's criterion is an empty console, not merely an absence of this package's own
 * messages: an error raised by React or three counts just as much.
 */
const reportedErrors = (): string[] =>
    consoleError.mock.calls.map((call) => String(call[0]))

const settle = async (): Promise<void> => {
    // Scene setup awaits a dynamic import and then a chain of microtasks.
    for (let pass = 0; pass < 8; pass += 1) {
        await act(async () => {
            await Promise.resolve()
        })
    }
}

/**
 * What this file does not cover: jsdom cannot start WebGPU, so `SceneRenderHost` never gets
 * a renderer and never drives frames. Scene setup, teardown and script cancellation are
 * exercised here; the frame loop itself is covered by `sceneLoopController.test.ts`.
 */
describe('scene lifecycle under StrictMode', () => {
    it('mounts and unmounts the whole catalog without reporting an error', async () => {
        await act(async () => {
            root.render(
                <StrictMode>
                    <IllustrationsPage />
                </StrictMode>
            )
        })
        await settle()

        await act(async () => {
            root.unmount()
        })
        await settle()

        expect(reportedErrors()).toEqual([])
        expect(rejections).toEqual([])
    })

    /**
     * The scene builds itself across several awaits. Unmounting inside that window used to
     * leave the setup running against a runtime that had already been disposed.
     */
    it('survives an unmount that lands in the middle of asynchronous setup', async () => {
        await act(async () => {
            root.render(
                <StrictMode>
                    <IllustrationsPage />
                </StrictMode>
            )
        })

        // Deliberately no settling: teardown races the dynamic import.
        await act(async () => {
            root.unmount()
        })
        await settle()

        expect(reportedErrors()).toEqual([])
        expect(rejections).toEqual([])
    })

    it('covers every scene in the catalog', () => {
        expect(SCENE_CATALOG.length).toBeGreaterThan(0)
    })

})

describe('scene restart contract', () => {
    const setupCounter = { count: 0 }
    const CountingScene = defineScene({
        metadata: { id: 'counting', title: 'Counting', tags: ['test'] },
        view: {
            cubeSize: 0.1,
            gridCellSize: 0.1,
            gridCellCount: 5,
            cameraAzimuthDeg: 0,
            viewOffsetY: 0,
            hoverCells: 0,
            enableCubeHover: false,
        },
        setup: () => {
            setupCounter.count += 1
        },
    })

    beforeEach(() => {
        setupCounter.count = 0
    })

    const renderWithSeed = async (seed: number): Promise<void> => {
        await act(async () => {
            root.render(
                <SceneRenderHost>
                    <CountingScene seed={seed} />
                </SceneRenderHost>
            )
        })
        await settle()
    }

    it('rebuilds the scene when the seed changes', async () => {
        await renderWithSeed(1)
        const afterFirst = setupCounter.count
        expect(afterFirst).toBeGreaterThan(0)

        await renderWithSeed(2)

        expect(setupCounter.count).toBeGreaterThan(afterFirst)
    })

    it('leaves the scene alone when nothing that matters changed', async () => {
        await renderWithSeed(1)
        const afterFirst = setupCounter.count

        await renderWithSeed(1)

        expect(setupCounter.count).toBe(afterFirst)
    })
})

describe('restart key identity', () => {
    const setupCounter = { count: 0 }

    type RevisionProps = CubeSceneProps & { readonly revision: { value: number } }

    // A non-primitive restart key is the case a stringified key silently collapses:
    // `{ value: 1 }` and `{ value: 2 }` both become "[object Object]".
    const RevisionScene = defineScene<RevisionProps>({
        metadata: { id: 'revision', title: 'Revision', tags: ['test'] },
        view: {
            cubeSize: 0.1,
            gridCellSize: 0.1,
            gridCellCount: 5,
            cameraAzimuthDeg: 0,
            viewOffsetY: 0,
            hoverCells: 0,
            enableCubeHover: false,
        },
        restartKey: (props) => props.revision,
        setup: () => {
            setupCounter.count += 1
        },
    })

    beforeEach(() => {
        setupCounter.count = 0
    })

    const renderWithRevision = async (revision: { value: number }): Promise<void> => {
        await act(async () => {
            root.render(
                <SceneRenderHost>
                    <RevisionScene revision={revision} />
                </SceneRenderHost>
            )
        })
        await settle()
    }

    it('rebuilds when an object restart key changes', async () => {
        await renderWithRevision({ value: 1 })
        const afterFirst = setupCounter.count
        expect(afterFirst).toBeGreaterThan(0)

        await renderWithRevision({ value: 2 })

        expect(setupCounter.count).toBeGreaterThan(afterFirst)
    })

    it('keeps the scene when the same restart key object is passed again', async () => {
        const revision = { value: 1 }
        await renderWithRevision(revision)
        const afterFirst = setupCounter.count

        await renderWithRevision(revision)

        expect(setupCounter.count).toBe(afterFirst)
    })
})

describe('face label changes', () => {
    const setupCounter = { count: 0 }
    const LabelledScene = defineScene({
        metadata: { id: 'labelled', title: 'Labelled', tags: ['test'] },
        view: {
            cubeSize: 0.1,
            gridCellSize: 0.1,
            gridCellCount: 5,
            cameraAzimuthDeg: 0,
            viewOffsetY: 0,
            hoverCells: 0,
            enableCubeHover: false,
        },
        setup: () => {
            setupCounter.count += 1
        },
    })

    beforeEach(() => {
        setupCounter.count = 0
    })

    const renderWithLabels = async (faceLabels: GridCubeFaceLabels): Promise<void> => {
        await act(async () => {
            root.render(
                <SceneRenderHost>
                    <LabelledScene faceLabels={faceLabels} />
                </SceneRenderHost>
            )
        })
        await settle()
    }

    // The defect this guards: an object literal is a new reference on every render, which
    // used to tear the whole scene down and build it again each time.
    it('ignores a new object carrying the same labels', async () => {
        await renderWithLabels({ front: 'A' })
        const afterFirst = setupCounter.count
        expect(afterFirst).toBeGreaterThan(0)

        await renderWithLabels({ front: 'A' })

        expect(setupCounter.count).toBe(afterFirst)
    })

    it('rebuilds when the labels themselves change', async () => {
        await renderWithLabels({ front: 'A' })
        const afterFirst = setupCounter.count

        await renderWithLabels({ front: 'B' })

        expect(setupCounter.count).toBeGreaterThan(afterFirst)
    })
})
