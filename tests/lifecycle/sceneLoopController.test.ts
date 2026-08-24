// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSceneLoopController } from '@runtime/core/createSceneLoopController'

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void

let latestObserverCallback: IntersectionCallback | null = null

class ControllableIntersectionObserver {
    constructor(callback: IntersectionCallback) {
        latestObserverCallback = callback
    }

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

/** Stands in for `THREE.Timer`, handing out a fixed step per frame. */
class StubTimer {
    connect(): void {}
    update(): void {}
    getDelta(): number {
        return 0.016
    }
    disconnect(): void {}
}

const createFakeRenderer = () => {
    let frame: ((timestamp?: number) => void) | null = null
    return {
        renderer: {
            setAnimationLoop: (callback: ((timestamp?: number) => void) | null) => {
                frame = callback
            },
            render: () => undefined,
        },
        isLooping: () => frame !== null,
        runFrame: () => frame?.(),
    }
}

const setVisibility = (hidden: boolean): void => {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
}

const createController = (update: (delta: number) => void) => {
    const fake = createFakeRenderer()
    const controller = createSceneLoopController({
        THREE: { Timer: StubTimer } as never,
        element: document.createElement('div'),
        scene: {} as never,
        camera: {} as never,
        update,
        renderer: fake.renderer as never,
        registerWithHost: undefined,
        wakeHost: undefined,
        onStatusChange: () => undefined,
    })
    return { controller, fake }
}

beforeEach(() => {
    latestObserverCallback = null
    setVisibility(false)
    vi.stubGlobal('IntersectionObserver', ControllableIntersectionObserver)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('scene loop controller', () => {
    it('stays idle until the scene scrolls into view', () => {
        const update = vi.fn()
        const { controller, fake } = createController(update)

        expect(fake.isLooping()).toBe(false)

        latestObserverCallback?.([{ isIntersecting: true }])

        expect(fake.isLooping()).toBe(true)
        fake.runFrame()
        expect(update).toHaveBeenCalledWith(0.016)
        controller.dispose()
    })

    it('stops advancing once the scene leaves the viewport', () => {
        const update = vi.fn()
        const { controller, fake } = createController(update)
        latestObserverCallback?.([{ isIntersecting: true }])

        latestObserverCallback?.([{ isIntersecting: false }])

        expect(fake.isLooping()).toBe(false)
        controller.dispose()
    })

    it('stops while the tab is hidden and resumes with it', () => {
        const update = vi.fn()
        const { controller, fake } = createController(update)
        latestObserverCallback?.([{ isIntersecting: true }])

        setVisibility(true)
        document.dispatchEvent(new Event('visibilitychange'))
        expect(fake.isLooping()).toBe(false)

        setVisibility(false)
        document.dispatchEvent(new Event('visibilitychange'))
        expect(fake.isLooping()).toBe(true)
        controller.dispose()
    })

    it('stops the loop and ignores later visibility changes after disposal', () => {
        const update = vi.fn()
        const { controller, fake } = createController(update)
        latestObserverCallback?.([{ isIntersecting: true }])

        controller.dispose()

        expect(fake.isLooping()).toBe(false)
        setVisibility(false)
        document.dispatchEvent(new Event('visibilitychange'))
        expect(fake.isLooping()).toBe(false)
    })
})
