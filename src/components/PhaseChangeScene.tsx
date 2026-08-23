import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import { getDifferentRandomIndex, shuffle } from '../scenes/sceneRandom'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.035
const PHASE_CUBE_IDS = [
    MAIN_CUBE_ID,
    ...Array.from({ length: 11 }, (_, index) => `phase-change-${index}`),
] as const
const SCATTER_POSITIONS: readonly GridCoordinate[] = [
    { column: -7, row: -5 }, { column: -4, row: -7 }, { column: 0, row: -6 },
    { column: 4, row: -7 }, { column: 7, row: -4 }, { column: 6, row: 1 },
    { column: 7, row: 5 }, { column: 3, row: 7 }, { column: -1, row: 6 },
    { column: -5, row: 7 }, { column: -7, row: 3 }, { column: -6, row: -1 },
]
const CRYSTAL_POSITIONS: readonly GridCoordinate[] = [-1, 0, 1].flatMap((row) =>
    [-2, -1, 0, 1].map((column) => ({ column, row }))
)

interface PhaseChangeController {
    readonly dispose: () => void
}

const createPhaseChangeAnimation = (
    runtime: GridSceneRuntime
): PhaseChangeController => {
    let cancelled = false
    let previousSeedIndex = -1
    const delay = createCancellableDelay()

    const crystallize = async (): Promise<void> => {
        const seedIndex = getDifferentRandomIndex(
            CRYSTAL_POSITIONS.length,
            previousSeedIndex
        )
        previousSeedIndex = seedIndex
        const seed = CRYSTAL_POSITIONS[seedIndex]
        if (seed === undefined) return
        const orderedTargets = [...CRYSTAL_POSITIONS].sort((left, right) => {
            const leftDistance = Math.abs(left.column - seed.column) + Math.abs(left.row - seed.row)
            const rightDistance = Math.abs(right.column - seed.column) + Math.abs(right.row - seed.row)
            return leftDistance - rightDistance
        })
        const movingIds = shuffle(PHASE_CUBE_IDS)

        for (let index = 0; index < movingIds.length; index += 1) {
            const cubeId = movingIds[index]
            const target = orderedTargets[index]
            if (cubeId === undefined || target === undefined) continue
            await runtime.moveCubeTo(cubeId, target, {
                duration: 0.34,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
            if (index === 0) {
                await runtime.fadeCubeTo(cubeId, 0.3, {
                    duration: 0.14,
                    easing: 'easeOutCubic',
                })
                await runtime.fadeCubeTo(cubeId, 1, {
                    duration: 0.18,
                    easing: 'easeOutCubic',
                })
            }
            await delay.wait(0.035)
        }
    }

    const melt = async (): Promise<void> => {
        for (const cubeId of shuffle(PHASE_CUBE_IDS)) {
            const scatterIndex = PHASE_CUBE_IDS.indexOf(cubeId)
            const target = SCATTER_POSITIONS[scatterIndex]
            if (target === undefined) continue
            await runtime.moveCubeTo(cubeId, target, {
                duration: 0.3,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
            await delay.wait(0.025)
        }
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            await crystallize()
            if (cancelled) return
            await delay.wait(1.15)
            await melt()
            if (!cancelled) await delay.wait(1)
        }
    }

    void startSceneAnimation('Phase Change', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** Scattered cubes crystallize around a random seed and then disperse again. */
export const PhaseChangeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            PHASE_CUBE_IDS.forEach((cubeId, index) => {
                const position = SCATTER_POSITIONS[index]
                if (position === undefined) return
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels })
            })
            const animation = createPhaseChangeAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 23,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 12,
        cameraAzimuthDeg: 35,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
