export interface GridCoordinate {
    readonly column: number
    readonly row: number
}

const CARDINAL_DIRECTIONS: readonly GridCoordinate[] = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
]

const DEFAULT_MAX_VISITED_CELLS = 4096

export const normalizeGridCoordinate = (position: GridCoordinate): GridCoordinate => ({
    column: Math.round(position.column),
    row: Math.round(position.row),
})

export const getGridCellKey = (position: GridCoordinate): string => {
    const normalized = normalizeGridCoordinate(position)
    return `${normalized.column}:${normalized.row}`
}

export const isSameGridCell = (left: GridCoordinate, right: GridCoordinate): boolean =>
    getGridCellKey(left) === getGridCellKey(right)

const getManhattanDistance = (from: GridCoordinate, to: GridCoordinate): number =>
    Math.abs(to.column - from.column) + Math.abs(to.row - from.row)

/** Finds a collision-free cardinal path. The returned path excludes the starting cell. */
export const findGridPath = (
    start: GridCoordinate,
    destination: GridCoordinate,
    blockedCellKeys: ReadonlySet<string>,
    maxVisitedCells = DEFAULT_MAX_VISITED_CELLS
): readonly GridCoordinate[] | null => {
    const normalizedStart = normalizeGridCoordinate(start)
    const normalizedDestination = normalizeGridCoordinate(destination)
    const startKey = getGridCellKey(normalizedStart)
    const destinationKey = getGridCellKey(normalizedDestination)

    if (startKey === destinationKey) return []
    if (blockedCellKeys.has(destinationKey)) return null

    const queue: GridCoordinate[] = [normalizedStart]
    const parents = new Map<string, string | null>([[startKey, null]])
    const cells = new Map<string, GridCoordinate>([[startKey, normalizedStart]])
    let queueIndex = 0

    while (queueIndex < queue.length && parents.size < maxVisitedCells) {
        const current = queue[queueIndex]
        queueIndex += 1

        const directions = [...CARDINAL_DIRECTIONS].sort(
            (left, right) =>
                getManhattanDistance(
                    {
                        column: current.column + left.column,
                        row: current.row + left.row,
                    },
                    normalizedDestination
                ) -
                getManhattanDistance(
                    {
                        column: current.column + right.column,
                        row: current.row + right.row,
                    },
                    normalizedDestination
                )
        )

        for (const direction of directions) {
            const next = {
                column: current.column + direction.column,
                row: current.row + direction.row,
            }
            const nextKey = getGridCellKey(next)
            if (parents.has(nextKey) || blockedCellKeys.has(nextKey)) continue

            parents.set(nextKey, getGridCellKey(current))
            cells.set(nextKey, next)

            if (nextKey === destinationKey) {
                const path: GridCoordinate[] = []
                let pathKey: string | null = destinationKey
                while (pathKey !== null && pathKey !== startKey) {
                    const cell = cells.get(pathKey)
                    if (cell === undefined) return null
                    path.unshift(cell)
                    pathKey = parents.get(pathKey) ?? null
                }
                return path
            }

            queue.push(next)
        }
    }

    return null
}
