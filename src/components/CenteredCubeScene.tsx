import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps, GridCubeFaceLabelInput } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import type { GridCoordinate, GridSceneRuntime } from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.1
const GRID_EDGE = 5
const PASSING_LANES = [-2, -1, 1, 2] as const
const MOVE_DURATION_PER_CELL_S = 0.4
const TURN_CHANCE_PER_MOVE = 0.22

interface CardinalDirection {
    readonly column: -1 | 0 | 1
    readonly row: -1 | 0 | 1
}

interface EntryPlan {
    readonly start: GridCoordinate
    readonly direction: CardinalDirection
}

interface PassingCubeAnimation {
    readonly dispose: () => void
}

const shuffle = <Item,>(items: readonly Item[]): Item[] => {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        const current = shuffled[index]
        shuffled[index] = shuffled[randomIndex]
        shuffled[randomIndex] = current
    }
    return shuffled
}

const createEntryPlans = (): EntryPlan[] =>
    shuffle(
        PASSING_LANES.flatMap((lane): readonly EntryPlan[] => [
            {
                start: { column: -GRID_EDGE, row: lane },
                direction: { column: 1, row: 0 },
            },
            {
                start: { column: GRID_EDGE, row: lane },
                direction: { column: -1, row: 0 },
            },
            {
                start: { column: lane, row: -GRID_EDGE },
                direction: { column: 0, row: 1 },
            },
            {
                start: { column: lane, row: GRID_EDGE },
                direction: { column: 0, row: -1 },
            },
        ])
    )

const getDistanceToExit = (
    position: GridCoordinate,
    direction: CardinalDirection
): number => {
    if (direction.column > 0) return GRID_EDGE - position.column
    if (direction.column < 0) return position.column + GRID_EDGE
    if (direction.row > 0) return GRID_EDGE - position.row
    return position.row + GRID_EDGE
}

const turnPerpendicularly = (
    direction: CardinalDirection
): CardinalDirection => {
    const turn: -1 | 1 = Math.random() >= 0.5 ? 1 : -1
    return direction.column === 0
        ? { column: turn, row: 0 }
        : { column: 0, row: turn }
}

const createPassingCubeAnimation = (
    runtime: GridSceneRuntime,
    faceLabels: GridCubeFaceLabelInput | undefined
): PassingCubeAnimation => {
    let cancelled = false
    let waveCounter = 0
    const delay = createCancellableDelay()

    const movePasser = async (
        id: string,
        entryPlan: EntryPlan,
        opacity: number
    ): Promise<void> => {
        let position = entryPlan.start
        let direction = entryPlan.direction
        let moveCount = 0
        let hasTurned = false
        let hasEntered = false

        while (!cancelled && moveCount < 30) {
            const isInsideTurnZone =
                Math.abs(position.column) <= 3 && Math.abs(position.row) <= 3
            if (
                !hasTurned &&
                moveCount >= 2 &&
                isInsideTurnZone &&
                Math.random() < TURN_CHANCE_PER_MOVE
            ) {
                direction = turnPerpendicularly(direction)
                hasTurned = true
            }

            const distanceToExit = getDistanceToExit(position, direction)
            if (distanceToExit <= 0) break
            const stepLength = Math.min(
                1 + Math.floor(Math.random() * 3),
                distanceToExit
            )
            const destination = {
                column: position.column + direction.column * stepLength,
                row: position.row + direction.row * stepLength,
            }
            const movement = runtime.moveCubeTo(id, destination, {
                duration: MOVE_DURATION_PER_CELL_S * stepLength,
                easing: 'easeInOutCubic',
            })
            if (!hasEntered) {
                await Promise.all([
                    movement,
                    runtime.fadeCubeTo(id, opacity, {
                        duration: 0.36,
                        easing: 'easeOutCubic',
                    }),
                ])
                hasEntered = true
            } else {
                await movement
            }
            position = runtime.getCubePosition(id) ?? position
            moveCount += 1
        }

        if (!cancelled) {
            await runtime.fadeCubeTo(id, 0, {
                duration: 0.5,
                easing: 'easeOutCubic',
            })
        }
    }

    const play = async (): Promise<void> => {
        await delay.wait(1.1)
        while (!cancelled) {
            const waveSize = 1 + Math.floor(Math.random() * 3)
            const entryPlans = createEntryPlans().slice(0, waveSize)
            const passers = entryPlans.map((entryPlan, index) => {
                const id = `center-passer-${waveCounter}-${index}`
                runtime.addCube({
                    id,
                    position: entryPlan.start,
                    opacity: 0,
                    faceLabels,
                })
                return { id, entryPlan }
            })

            await Promise.all(
                passers.map(({ id, entryPlan }) =>
                    movePasser(
                        id,
                        entryPlan,
                        0.22 + Math.random() * 0.26
                    )
                )
            )
            passers.forEach(({ id }) => runtime.removeCube(id))
            waveCounter += 1
            if (!cancelled) await delay.wait(1.2 + Math.random() * 1.4)
        }
    }

    void play()
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A fixed main cube remains centered while translucent groups occasionally pass nearby. */
export const CenteredCubeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const animation = createPassingCubeAnimation(runtime, faceLabels)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 9,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 5,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
