import { describe, expect, it, vi } from 'vitest'

import { getWideGridFadeRadii } from '../src/scenes/gridFade'
import {
    getDifferentRandomIndex,
    getRandomIndex,
    getRandomItem,
    shuffle,
} from '../src/scenes/sceneRandom'
import {
    SIGN_DIRECTIONS,
    SIGN_SYMBOLS,
    getSignSymbolValidationErrors,
    rotateSignSymbol,
} from '../src/scenes/signSymbols'
import { startSceneAnimation } from '../src/scenes/startSceneAnimation'

describe('scene random utilities', () => {
    it('shuffles a copy without modifying the source', () => {
        const source = [1, 2, 3, 4]

        expect(shuffle(source, () => 0)).toEqual([2, 3, 4, 1])
        expect(source).toEqual([1, 2, 3, 4])
    })

    it('handles empty collections and can exclude the previous index', () => {
        expect(getRandomIndex(0)).toBe(-1)
        expect(getRandomItem([], () => 0.5)).toBeUndefined()
        expect(getDifferentRandomIndex(4, 1, () => 0)).toBe(0)
        expect(getDifferentRandomIndex(4, 1, () => 0.99)).toBe(3)
        expect(getDifferentRandomIndex(1, 0)).toBe(0)
    })
})

describe('grid fade utilities', () => {
    it('uses the full grid radius and a clamped opaque center ratio', () => {
        expect(getWideGridFadeRadii(19)).toEqual({
            innerRadiusCells: 4,
            outerRadiusCells: 10,
        })
        expect(getWideGridFadeRadii(10, 2)).toEqual({
            innerRadiusCells: 5,
            outerRadiusCells: 5,
        })
        expect(getWideGridFadeRadii(10, -1)).toEqual({
            innerRadiusCells: 0,
            outerRadiusCells: 5,
        })
    })
})

describe('sign symbol catalog', () => {
    it('contains valid nine-cell symbols with unique names and positions', () => {
        expect(SIGN_SYMBOLS).toHaveLength(12)
        expect(getSignSymbolValidationErrors()).toEqual([])
    })

    it('preserves every symbol while rotating it in all directions', () => {
        for (const symbol of SIGN_SYMBOLS) {
            for (const direction of SIGN_DIRECTIONS) {
                const rotated = rotateSignSymbol(symbol.positions, direction)
                const uniqueCells = new Set(
                    rotated.map(({ column, row }) => `${column},${row}`)
                )
                expect(rotated).toHaveLength(symbol.positions.length)
                expect(uniqueCells.size).toBe(symbol.positions.length)
            }
        }
    })
})

describe('background scene animations', () => {
    it('reports rejected animation tasks with their scene name', async () => {
        const error = new Error('animation failed')
        const onError = vi.fn()

        await startSceneAnimation(
            'Test Scene',
            async () => Promise.reject(error),
            onError
        )

        expect(onError).toHaveBeenCalledOnce()
        expect(onError).toHaveBeenCalledWith(error, 'Test Scene')
    })
})
