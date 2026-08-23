import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.05
const START_POSITIONS: readonly GridCoordinate[] = [
    { column: 0, row: -4 },
    { column: 0, row: 0 },
    { column: 0, row: 4 },
]
const PREFERRED_CUBE_IDS = [
    'preference-frame-0',
    'preference-frame-1',
    'preference-frame-2',
    'preference-frame-3',
] as const
const ALTERNATIVE_CUBE_IDS = [
    'preference-line-0',
    'preference-line-1',
    'preference-line-2',
    'preference-line-3',
] as const
const SWAP_STAGING_POSITIONS: readonly GridCoordinate[] = [
    { column: -4, row: 5 },
    { column: -1, row: 5 },
    { column: 1, row: 5 },
    { column: 4, row: 5 },
]

const getFramePositions = (anchorColumn: number): readonly GridCoordinate[] => [
    { column: anchorColumn - 1, row: -1 },
    { column: anchorColumn - 1, row: 1 },
    { column: anchorColumn + 1, row: -1 },
    { column: anchorColumn + 1, row: 1 },
]

const getLinePositions = (anchorColumn: number): readonly GridCoordinate[] =>
    Array.from({ length: 4 }, (_, index) => ({
        column: anchorColumn - 2 + index,
        row: 1,
    }))

interface PreferenceAnimationController {
    readonly dispose: () => void
}

const createPreferenceAnimation = (runtime: GridSceneRuntime): PreferenceAnimationController => {
    let cancelled = false
    let previousStartIndex = 0
    let preferredOnLeft = true
    const delay = createCancellableDelay()

    const moveGroup = async (
        cubeIds: readonly string[],
        positions: readonly GridCoordinate[]
    ): Promise<void> => {
        for (let index = 0; index < cubeIds.length; index += 1) {
            const cubeId = cubeIds[index]
            const position = positions[index]
            if (cubeId === undefined || position === undefined) continue
            await runtime.moveCubeTo(cubeId, position, {
                duration: 0.34,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
            await delay.wait(0.04)
        }
    }

    const swapDestinations = async (): Promise<void> => {
        const preferredTargetColumn = preferredOnLeft ? 3 : -3
        const alternativeTargetColumn = preferredOnLeft ? -3 : 3
        await moveGroup(ALTERNATIVE_CUBE_IDS, SWAP_STAGING_POSITIONS)
        if (cancelled) return
        await moveGroup(PREFERRED_CUBE_IDS, getFramePositions(preferredTargetColumn))
        if (cancelled) return
        await moveGroup(ALTERNATIVE_CUBE_IDS, getLinePositions(alternativeTargetColumn))
        preferredOnLeft = !preferredOnLeft
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.9)
        while (!cancelled) {
            const preferredPosition = {
                column: preferredOnLeft ? -3 : 3,
                row: 0,
            }
            await runtime.moveCubeTo(MAIN_CUBE_ID, preferredPosition, {
                duration: 0.85,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
            await delay.wait(1.15)

            let nextStartIndex = previousStartIndex
            while (nextStartIndex === previousStartIndex) {
                nextStartIndex = Math.floor(Math.random() * START_POSITIONS.length)
            }
            const nextStart = START_POSITIONS[nextStartIndex]
            if (nextStart === undefined) return
            await runtime.moveCubeTo(MAIN_CUBE_ID, nextStart, {
                duration: 0.9,
                easing: 'easeInOutCubic',
            })
            previousStartIndex = nextStartIndex
            if (cancelled) return
            await delay.wait(0.55)
            await swapDestinations()
            if (!cancelled) await delay.wait(0.9)
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

/** A cube follows its preferred shape even when the two destination shapes swap sides. */
export const PreferenceChoiceScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const start = START_POSITIONS[0]
            if (start !== undefined) runtime.setCubePosition(MAIN_CUBE_ID, start)
            const preferredPositions = getFramePositions(-3)
            const alternativePositions = getLinePositions(3)
            PREFERRED_CUBE_IDS.forEach((id, index) => {
                const position = preferredPositions[index]
                if (position !== undefined) runtime.addCube({ id, position, faceLabels })
            })
            ALTERNATIVE_CUBE_IDS.forEach((id, index) => {
                const position = alternativePositions[index]
                if (position !== undefined) runtime.addCube({ id, position, faceLabels })
            })
            const animation = createPreferenceAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 13,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
