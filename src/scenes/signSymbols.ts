import type { GridCoordinate } from './gridSceneRuntime'

export const SIGN_DIRECTIONS = ['right', 'left', 'up', 'down'] as const

export type SignDirection = (typeof SIGN_DIRECTIONS)[number]

export interface SignSymbolTemplate {
    readonly name: string
    readonly positions: readonly GridCoordinate[]
}

export const SIGN_SYMBOLS: readonly SignSymbolTemplate[] = [
    { name: 'arrow', positions: [
        { column: -2, row: 0 }, { column: -1, row: 0 }, { column: 0, row: 0 },
        { column: 1, row: 0 }, { column: 2, row: 0 }, { column: 1, row: -2 },
        { column: 2, row: -1 }, { column: 2, row: 1 }, { column: 1, row: 2 },
    ] },
    { name: 'chevron', positions: [
        { column: -2, row: -3 }, { column: -1, row: -2 }, { column: 0, row: -1 },
        { column: 1, row: 0 }, { column: 0, row: 1 }, { column: -1, row: 2 },
        { column: -2, row: 3 }, { column: -1, row: -1 }, { column: -1, row: 1 },
    ] },
    { name: 'plus', positions: [
        { column: -2, row: 0 }, { column: -1, row: 0 }, { column: 0, row: 0 },
        { column: 1, row: 0 }, { column: 2, row: 0 }, { column: 0, row: -2 },
        { column: 0, row: -1 }, { column: 0, row: 1 }, { column: 0, row: 2 },
    ] },
    { name: 'cross', positions: [
        { column: -2, row: -2 }, { column: -1, row: -1 }, { column: 0, row: 0 },
        { column: 1, row: 1 }, { column: 2, row: 2 }, { column: -2, row: 2 },
        { column: -1, row: 1 }, { column: 1, row: -1 }, { column: 2, row: -2 },
    ] },
    { name: 'diamond', positions: [
        { column: 0, row: -2 }, { column: 1, row: -1 }, { column: 2, row: 0 },
        { column: 1, row: 1 }, { column: 0, row: 2 }, { column: -1, row: 1 },
        { column: -2, row: 0 }, { column: -1, row: -1 }, { column: 0, row: 0 },
    ] },
    { name: 'frame', positions: [
        { column: -1, row: -1 }, { column: 0, row: -1 }, { column: 1, row: -1 },
        { column: -1, row: 0 }, { column: 1, row: 0 }, { column: -1, row: 1 },
        { column: 0, row: 1 }, { column: 1, row: 1 }, { column: 0, row: 0 },
    ] },
    { name: 'exclamation', positions: [
        { column: -1, row: -2 }, { column: 0, row: -2 }, { column: 1, row: -2 },
        { column: -1, row: -1 }, { column: 0, row: -1 }, { column: 1, row: -1 },
        { column: 0, row: 0 }, { column: 0, row: 1 }, { column: 0, row: 3 },
    ] },
    { name: 'lightning', positions: [
        { column: -1, row: -3 }, { column: 0, row: -2 }, { column: 1, row: -1 },
        { column: 0, row: 0 }, { column: -1, row: 1 }, { column: 0, row: 2 },
        { column: 1, row: 3 }, { column: -1, row: -1 }, { column: 1, row: 1 },
    ] },
    { name: 'fork', positions: [
        { column: -2, row: -2 }, { column: -1, row: -1 }, { column: 0, row: 0 },
        { column: 1, row: -1 }, { column: 2, row: -2 }, { column: 0, row: 1 },
        { column: 0, row: 2 }, { column: 0, row: 3 }, { column: 1, row: 1 },
    ] },
    { name: 'spiral', positions: [
        { column: -2, row: -2 }, { column: -1, row: -2 }, { column: 0, row: -2 },
        { column: 1, row: -2 }, { column: 2, row: -2 }, { column: 2, row: -1 },
        { column: 2, row: 0 }, { column: 1, row: 0 }, { column: 0, row: 0 },
    ] },
    { name: 'gate', positions: [
        { column: -2, row: -2 }, { column: -1, row: -2 }, { column: 0, row: -2 },
        { column: 1, row: -2 }, { column: 2, row: -2 }, { column: -2, row: -1 },
        { column: -2, row: 0 }, { column: 2, row: -1 }, { column: 2, row: 0 },
    ] },
    { name: 'pause', positions: [
        { column: -1, row: -2 }, { column: -1, row: -1 }, { column: -1, row: 0 },
        { column: -1, row: 1 }, { column: 1, row: -1 }, { column: 1, row: 0 },
        { column: 1, row: 1 }, { column: 1, row: 2 }, { column: 0, row: 0 },
    ] },
]

export const rotateSignSymbol = (
    positions: readonly GridCoordinate[],
    direction: SignDirection
): readonly GridCoordinate[] => positions.map(({ column, row }) => {
    switch (direction) {
        case 'right': return { column, row }
        case 'left': return { column: -column, row: -row }
        case 'up': return { column: -row, row: column }
        case 'down': return { column: row, row: -column }
    }
})

export const getSignSymbolValidationErrors = (
    symbols: readonly SignSymbolTemplate[] = SIGN_SYMBOLS
): readonly string[] => {
    const errors: string[] = []
    const names = new Set<string>()

    for (const symbol of symbols) {
        if (names.has(symbol.name)) errors.push(`duplicate symbol name: ${symbol.name}`)
        names.add(symbol.name)
        if (symbol.positions.length !== 9) {
            errors.push(`${symbol.name}: expected 9 cells, received ${symbol.positions.length}`)
        }

        const cells = new Set<string>()
        for (const { column, row } of symbol.positions) {
            if (!Number.isInteger(column) || !Number.isInteger(row)) {
                errors.push(`${symbol.name}: coordinates must be integers`)
            }
            cells.add(`${column},${row}`)
        }
        if (cells.size !== symbol.positions.length) {
            errors.push(`${symbol.name}: positions must be unique`)
        }
    }

    return errors
}

const validationErrors = getSignSymbolValidationErrors()
if (validationErrors.length > 0) {
    throw new Error(`Invalid sign symbol catalog: ${validationErrors.join('; ')}`)
}
