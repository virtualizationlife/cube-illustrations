import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps, GridCubeFaceLabelInput } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    createScenePresentation,
    type ScenePresentationController,
} from '../scenes/scenePresentation'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.065
const CENTER: GridCoordinate = { column: 0, row: 0 }
const ATTRACTIVE_CUBE_IDS = [
    'valence-attractive-0',
    'valence-attractive-1',
    'valence-attractive-2',
    'valence-attractive-3',
] as const
const AVERSIVE_CUBE_IDS = [
    'valence-aversive-0',
    'valence-aversive-1',
    'valence-aversive-2',
    'valence-aversive-3',
] as const

const getFramePositions = (anchorColumn: number): readonly GridCoordinate[] => [
    { column: anchorColumn - 1, row: -1 },
    { column: anchorColumn - 1, row: 1 },
    { column: anchorColumn + 1, row: -1 },
    { column: anchorColumn + 1, row: 1 },
]

const getLinePositions = (anchorColumn: number): readonly GridCoordinate[] =>
    Array.from({ length: 4 }, (_, index) => ({
        column: anchorColumn - 1 + index,
        row: 1,
    }))

interface ValenceFieldController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createValenceFieldAnimation = (
    runtime: GridSceneRuntime,
    faceLabels: GridCubeFaceLabelInput | undefined
): ValenceFieldController => {
    let cancelled = false
    let attractionOnLeft = true
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 0.98,
        gridOpacity: 0.5,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
    })

    const addGroup = (
        ids: readonly string[],
        positions: readonly GridCoordinate[],
        opacity = 1
    ): void => {
        ids.forEach((id, index) => {
            const position = positions[index]
            if (position !== undefined) runtime.addCube({ id, position, opacity, faceLabels })
        })
    }

    const removeGroup = (ids: readonly string[]): void => {
        ids.forEach((id) => runtime.removeCube(id))
    }

    const swapGroups = async (): Promise<void> => {
        const allIds = [...ATTRACTIVE_CUBE_IDS, ...AVERSIVE_CUBE_IDS]
        await Promise.all(
            allIds.map((id) =>
                runtime.fadeCubeTo(id, 0, { duration: 0.4, easing: 'easeOutCubic' })
            )
        )
        removeGroup(allIds)
        attractionOnLeft = !attractionOnLeft
        const attractiveColumn = attractionOnLeft ? -3 : 3
        const aversiveColumn = attractionOnLeft ? 3 : -3
        addGroup(ATTRACTIVE_CUBE_IDS, getFramePositions(attractiveColumn), 0)
        addGroup(AVERSIVE_CUBE_IDS, getLinePositions(aversiveColumn), 0)
        await Promise.all(
            allIds.map((id) =>
                runtime.fadeCubeTo(id, 1, { duration: 0.42, easing: 'easeOutCubic' })
            )
        )
    }

    const visitAttraction = async (): Promise<void> => {
        const anchor = attractionOnLeft ? -3 : 3
        const direction = Math.sign(anchor)
        presentation.setTarget({
            zoom: 1.16,
            gridOpacity: 0.62,
            gridFadeInnerRadiusCells: 1.5,
            gridFadeOuterRadiusCells: 9,
        })
        const orbit: readonly GridCoordinate[] = [
            { column: anchor - direction * 2, row: 0 },
            { column: anchor, row: -2 },
            { column: anchor + direction * 2, row: 0 },
            { column: anchor, row: 2 },
            { column: anchor - direction * 2, row: 0 },
        ]
        for (const position of orbit) {
            await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
                duration: 0.48,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
        }
        await delay.wait(0.65)
        await runtime.moveCubeTo(MAIN_CUBE_ID, CENTER, {
            duration: 0.62,
            easing: 'easeInOutCubic',
        })
    }

    const approachAndAvoid = async (): Promise<void> => {
        const anchor = attractionOnLeft ? 3 : -3
        const direction = Math.sign(anchor)
        presentation.setTarget({
            zoom: 0.84,
            gridOpacity: 0.36,
            gridFadeInnerRadiusCells: 3,
            gridFadeOuterRadiusCells: 9,
        })
        await runtime.moveCubeTo(
            MAIN_CUBE_ID,
            { column: anchor - direction * 2, row: 0 },
            { duration: 0.55, easing: 'easeInOutCubic' }
        )
        await delay.wait(0.65)
        await runtime.moveCubeTo(
            MAIN_CUBE_ID,
            { column: -direction, row: -2 },
            { duration: 0.48, easing: 'easeOutCubic' }
        )
        await runtime.moveCubeTo(MAIN_CUBE_ID, CENTER, {
            duration: 0.4,
            easing: 'easeInOutCubic',
        })
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            await visitAttraction()
            if (cancelled) return
            await approachAndAvoid()
            if (cancelled) return
            await delay.wait(0.55)
            await swapGroups()
            if (!cancelled) await delay.wait(0.75)
        }
    }

    void startSceneAnimation('Valence Field', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A cube remains near one form and retreats from another even after they swap sides. */
export const ValenceFieldScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<ValenceFieldController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, CENTER)
            const attractivePositions = getFramePositions(-3)
            const aversivePositions = getLinePositions(3)
            ATTRACTIVE_CUBE_IDS.forEach((id, index) => {
                const position = attractivePositions[index]
                if (position !== undefined) runtime.addCube({ id, position, faceLabels })
            })
            AVERSIVE_CUBE_IDS.forEach((id, index) => {
                const position = aversivePositions[index]
                if (position !== undefined) runtime.addCube({ id, position, faceLabels })
            })
            const controller = createValenceFieldAnimation(runtime, faceLabels)
            controllerRef.current = controller
            return () => {
                controller.dispose()
                if (controllerRef.current === controller) controllerRef.current = null
            }
        },
        [faceLabels]
    )
    const onFrame = useCallback(
        ({ delta, camera, runtime }: SimpleCubeFrameContext): void => {
            controllerRef.current?.presentation.update(delta, camera, runtime)
        },
        []
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridOpacity: 0.5,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
