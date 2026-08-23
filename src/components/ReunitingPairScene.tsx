import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.05
const PARTNER_CUBE_ID = 'relationship-partner'
const START_PAIR: readonly [GridCoordinate, GridCoordinate] = [
    { column: -4, row: -1 },
    { column: -4, row: 1 },
]
const LEFT_APPROACH: readonly [GridCoordinate, GridCoordinate] = [
    { column: -2, row: -1 },
    { column: -2, row: 1 },
]
const RIGHT_MEETING: readonly [GridCoordinate, GridCoordinate] = [
    { column: 3, row: -1 },
    { column: 3, row: 1 },
]
const RIGHT_SYNC_STEP: readonly [GridCoordinate, GridCoordinate] = [
    { column: 4, row: -1 },
    { column: 4, row: 1 },
]
const MAIN_FORWARD_SHORT_ROUTE: readonly GridCoordinate[] = [
    { column: -1, row: -2 },
    { column: 1, row: -2 },
    RIGHT_MEETING[0],
]
const PARTNER_FORWARD_LONG_ROUTE: readonly GridCoordinate[] = [
    { column: -2, row: 3 },
    { column: 0, row: 4 },
    { column: 2, row: 3 },
    RIGHT_MEETING[1],
]
const MAIN_RETURN_LONG_ROUTE: readonly GridCoordinate[] = [
    { column: 2, row: -3 },
    { column: 0, row: -4 },
    { column: -2, row: -3 },
    { column: -3, row: -1 },
]
const PARTNER_RETURN_SHORT_ROUTE: readonly GridCoordinate[] = [
    { column: 1, row: 2 },
    { column: -1, row: 2 },
    { column: -3, row: 1 },
]
const BARRIER_POSITIONS: readonly GridCoordinate[] = [
    { column: 0, row: -1 },
    { column: 0, row: 0 },
    { column: 0, row: 1 },
]

interface PairAnimationController {
    readonly dispose: () => void
}

const movePair = (
    runtime: GridSceneRuntime,
    destinations: readonly [GridCoordinate, GridCoordinate]
): Promise<void[]> =>
    Promise.all([
        runtime.moveCubeTo(MAIN_CUBE_ID, destinations[0], {
            duration: 0.62,
            easing: 'easeInOutCubic',
        }),
        runtime.moveCubeTo(PARTNER_CUBE_ID, destinations[1], {
            duration: 0.62,
            easing: 'easeInOutCubic',
        }),
    ])

const createPairAnimation = (runtime: GridSceneRuntime): PairAnimationController => {
    let cancelled = false
    const delay = createCancellableDelay()

    const moveCubeRoute = async (
        cubeId: string,
        route: readonly GridCoordinate[],
        duration: number
    ): Promise<void> => {
        for (const destination of route) {
            await runtime.moveCubeTo(cubeId, destination, {
                duration,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
            await delay.wait(0.06)
        }
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            await movePair(runtime, LEFT_APPROACH)
            if (cancelled) return
            await Promise.all([
                moveCubeRoute(MAIN_CUBE_ID, MAIN_FORWARD_SHORT_ROUTE, 0.42),
                moveCubeRoute(PARTNER_CUBE_ID, PARTNER_FORWARD_LONG_ROUTE, 0.56),
            ])
            if (cancelled) return
            await delay.wait(0.65)
            await movePair(runtime, RIGHT_SYNC_STEP)
            if (cancelled) return
            await delay.wait(0.9)

            await movePair(runtime, RIGHT_MEETING)
            if (cancelled) return
            await Promise.all([
                moveCubeRoute(MAIN_CUBE_ID, MAIN_RETURN_LONG_ROUTE, 0.56),
                moveCubeRoute(PARTNER_CUBE_ID, PARTNER_RETURN_SHORT_ROUTE, 0.42),
            ])
            if (cancelled) return
            await delay.wait(0.65)
            await movePair(runtime, START_PAIR)
            if (!cancelled) await delay.wait(0.9)
        }
    }

    void startSceneAnimation('Reuniting Pair', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** Two cubes take unequal routes, wait for each other, and restore their paired movement. */
export const ReunitingPairScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, START_PAIR[0])
            runtime.addCube({ id: PARTNER_CUBE_ID, position: START_PAIR[1], faceLabels })
            BARRIER_POSITIONS.forEach((position, index) => {
                runtime.addCube({ id: `relationship-barrier-${index}`, position, faceLabels })
            })
            const animation = createPairAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        cameraAzimuthDeg: 20,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
