import { describe, expect, it, vi } from 'vitest'

import { createDisposerStack } from '@runtime/core/createDisposerStack'

describe('createDisposerStack', () => {
    it('releases in reverse order of registration', () => {
        const released: string[] = []
        const stack = createDisposerStack()
        stack.add(() => released.push('first'))
        stack.add(() => released.push('second'))
        stack.add(() => released.push('third'))

        stack.dispose()

        expect(released).toEqual(['third', 'second', 'first'])
    })

    it('releases each resource once, however often dispose is called', () => {
        const release = vi.fn()
        const stack = createDisposerStack()
        stack.add(release)

        stack.dispose()
        stack.dispose()
        stack.dispose()

        expect(release).toHaveBeenCalledTimes(1)
        expect(stack.isDisposed()).toBe(true)
    })

    // Asynchronous setup can finish acquiring a resource after teardown already ran.
    it('releases a resource registered after disposal immediately', () => {
        const release = vi.fn()
        const stack = createDisposerStack()
        stack.dispose()

        stack.add(release)

        expect(release).toHaveBeenCalledTimes(1)
    })

    it('reports its state before disposal', () => {
        const stack = createDisposerStack()
        expect(stack.isDisposed()).toBe(false)
    })
})
