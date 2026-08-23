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
const ENTRY: GridCoordinate = { column: -6, row: 0 }
const VISIBLE_START: GridCoordinate = { column: -4, row: 0 }
const TARGET: GridCoordinate = { column: 4, row: 0 }
const EXIT: GridCoordinate = { column: 6, row: 0 }
const DIRECT_APPROACH: GridCoordinate = { column: -1, row: 0 }
const TOP_BLOCKED_APPROACH: GridCoordinate = { column: -1, row: 2 }
const BOTTOM_BLOCKED_APPROACH: GridCoordinate = { column: -1, row: -2 }
const TOP_ROUTE: readonly GridCoordinate[] = [
    { column: -2, row: 2 },
    { column: 2, row: 2 },
    TARGET,
]
const BOTTOM_ROUTE: readonly GridCoordinate[] = [
    { column: -2, row: -2 },
    { column: 2, row: -2 },
    TARGET,
]
const LOWER_BARRIER: readonly GridCoordinate[] = [
    { column: 0, row: -2 },
    { column: 0, row: -1 },
    { column: 0, row: 0 },
]
const UPPER_BARRIER: readonly GridCoordinate[] = [
    { column: 0, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: 2 },
]
const BARRIER_CUBE_IDS = ['detour-barrier-0', 'detour-barrier-1', 'detour-barrier-2']

interface DetourAnimationController {
    readonly dispose: () => void
}

const moveRoute = async (
    runtime: GridSceneRuntime,
    route: readonly GridCoordinate[],
    isCancelled: () => boolean
): Promise<void> => {
    for (const position of route) {
        if (isCancelled()) return
        await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
            duration: 0.62,
            easing: 'easeInOutCubic',
        })
    }
}

const createDetourAnimation = (runtime: GridSceneRuntime): DetourAnimationController => {
    let cancelled = false
    const delay = createCancellableDelay()

    const approachBlockedRoute = async (position: GridCoordinate): Promise<void> => {
        await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
            duration: 0.72,
            easing: 'easeInOutCubic',
        })
        if (cancelled) return
        await delay.wait(0.95)
    }

    const enterScene = async (): Promise<void> => {
        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, VISIBLE_START, {
                duration: 0.52,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                duration: 0.52,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const leaveScene = async (): Promise<void> => {
        await delay.wait(0.45)
        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, EXIT, {
                duration: 0.52,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
                duration: 0.52,
                easing: 'easeOutCubic',
            }),
        ])
        if (cancelled) return
        runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
        await delay.wait(0.42)
    }

    const runJourney = async (
        route: readonly GridCoordinate[],
        blockedApproach?: GridCoordinate
    ): Promise<void> => {
        await enterScene()
        if (cancelled) return
        if (blockedApproach !== undefined) {
            await approachBlockedRoute(blockedApproach)
            if (cancelled) return
        }
        await moveRoute(runtime, route, () => cancelled)
        if (cancelled) return
        await leaveScene()
    }

    const shiftBarrier = async (moveUp: boolean): Promise<void> => {
        const sourcePositions = moveUp ? LOWER_BARRIER : UPPER_BARRIER
        const targetPositions = moveUp ? UPPER_BARRIER : LOWER_BARRIER
        const indices = moveUp ? [2, 1, 0] : [0, 1, 2]
        for (const index of indices) {
            const source = sourcePositions[index]
            const target = targetPositions[index]
            if (source === undefined || target === undefined) continue
            const cubeId = BARRIER_CUBE_IDS.find((id) => {
                const position = runtime.getCubePosition(id)
                return position?.column === source.column && position.row === source.row
            })
            if (cubeId === undefined) continue
            await runtime.moveCubeTo(cubeId, target, {
                duration: 0.36,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
        }
        if (!cancelled) await delay.wait(0.55)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)

        await runJourney(TOP_ROUTE, DIRECT_APPROACH)
        if (cancelled) return
        await runJourney(TOP_ROUTE)

        while (!cancelled) {
            await shiftBarrier(true)
            if (cancelled) return
            await runJourney(BOTTOM_ROUTE, TOP_BLOCKED_APPROACH)
            if (cancelled) return
            await runJourney(BOTTOM_ROUTE)
            if (cancelled) return

            await shiftBarrier(false)
            if (cancelled) return
            await runJourney(TOP_ROUTE, BOTTOM_BLOCKED_APPROACH)
            if (cancelled) return
            await runJourney(TOP_ROUTE)
        }
    }

    void startSceneAnimation('Learned Detour', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A cube learns a detour, then adapts again when the barrier blocks that route. */
export const LearnedDetourScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
            runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
            LOWER_BARRIER.forEach((position, index) => {
                const id = BARRIER_CUBE_IDS[index]
                if (id !== undefined) runtime.addCube({ id, position, faceLabels })
            })
            const animation = createDetourAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 25,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
