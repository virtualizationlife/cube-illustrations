import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
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

const GRID_CELL_SIZE = 0.06
const RELIEF_CUBE_ID = 'guard-relief'
const POST: GridCoordinate = { column: 0, row: 0 }
const WAITING_CELL: GridCoordinate = { column: 2, row: 0 }
const ENTRY: GridCoordinate = { column: 6, row: 0 }
const EXIT: GridCoordinate = { column: -6, row: 0 }
const EMPTY_POST_HOLD_S = 1.15

interface GuardChangeController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createGuardChangeAnimation = (
    runtime: GridSceneRuntime
): GuardChangeController => {
    let cancelled = false
    let onPostId: string = MAIN_CUBE_ID
    let reliefId: string = RELIEF_CUBE_ID
    let handoverCount = 0
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1,
        gridOpacity: 0.55,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
    })

    const leavePost = async (): Promise<void> => {
        await Promise.all([
            runtime.moveCubeTo(onPostId, EXIT, {
                duration: 1.1,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(onPostId, 0, {
                duration: 1.1,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const takePost = async (from: GridCoordinate): Promise<void> => {
        runtime.setCubePosition(reliefId, from)
        await Promise.all([
            runtime.moveCubeTo(reliefId, POST, {
                duration: 0.95,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(reliefId, 1, {
                duration: 0.7,
                easing: 'easeOutCubic',
            }),
        ])
    }

    /** The relief is already standing beside the post before the post is given up. */
    const handoverWithOverlap = async (): Promise<void> => {
        runtime.setCubePosition(reliefId, ENTRY)
        await Promise.all([
            runtime.moveCubeTo(reliefId, WAITING_CELL, {
                duration: 1,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(reliefId, 1, {
                duration: 0.8,
                easing: 'easeOutCubic',
            }),
        ])
        if (cancelled) return
        await delay.wait(0.85)
        if (cancelled) return
        await leavePost()
        if (cancelled) return
        await runtime.moveCubeTo(reliefId, POST, {
            duration: 0.5,
            easing: 'easeInOutCubic',
        })
    }

    /** Nobody holds the post for a moment, and the world visibly loosens its grip. */
    const handoverWithGap = async (): Promise<void> => {
        await leavePost()
        if (cancelled) return
        presentation.setTarget({
            zoom: 0.88,
            gridOpacity: 0.26,
            gridFadeInnerRadiusCells: 1.5,
            gridFadeOuterRadiusCells: 9,
        })
        await delay.wait(EMPTY_POST_HOLD_S)
        if (cancelled) return
        presentation.setTarget({
            zoom: 1,
            gridOpacity: 0.55,
            gridFadeInnerRadiusCells: 2.5,
            gridFadeOuterRadiusCells: 9,
        })
        await takePost(ENTRY)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.9)
        while (!cancelled) {
            const departingId = onPostId
            handoverCount += 1
            if (handoverCount % 2 === 1) await handoverWithOverlap()
            else await handoverWithGap()
            if (cancelled) return

            runtime.setCubePosition(departingId, ENTRY)
            onPostId = reliefId
            reliefId = departingId
            await delay.wait(0.9)
        }
    }

    void startSceneAnimation('Changing of the Guard', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A post outlives its holders, alternating handovers that overlap and handovers that leave a gap. */
export const GuardChangeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<GuardChangeController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, POST)
            runtime.addCube({
                id: RELIEF_CUBE_ID,
                position: ENTRY,
                opacity: 0,
                faceLabels,
            })
            const controller = createGuardChangeAnimation(runtime)
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
        gridOpacity: 0.55,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 30,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
