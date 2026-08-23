import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import { MAIN_CUBE_ID, type GridSceneRuntime } from '../scenes/gridSceneRuntime'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.07
const PARTNER_CUBE_ID = 'polarity-partner'
const AXIS_ROW = 0
const PARTNER_COLUMN = 4
const CONTACT_COLUMN = 3
const APPROACH_COLUMN = 1
const DISTANT_COLUMN = -2
/** Half a face turn: the only rotation a featureless cube visibly holds. */
const TURNED_ANGLE = Math.PI / 4
const SPIN_RESPONSE_S = 0.16

interface SpinState {
    current: number
    target: number
}

interface PolarityController {
    readonly spin: SpinState
    readonly dispose: () => void
}

const createPolarityAnimation = (
    runtime: GridSceneRuntime,
    spin: SpinState
): PolarityController => {
    let cancelled = false
    const delay = createCancellableDelay()

    const moveTo = (column: number, duration: number): Promise<void> =>
        runtime.moveCubeTo(
            MAIN_CUBE_ID,
            { column, row: AXIS_ROW },
            { duration, easing: 'easeInOutCubic' }
        )

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            // Aligned: the pair drifts together and the last gap closes in a snap.
            spin.target = 0
            await moveTo(APPROACH_COLUMN, 0.95)
            if (cancelled) return
            await delay.wait(0.28)
            await moveTo(CONTACT_COLUMN, 0.16)
            if (cancelled) return
            await delay.wait(0.85)
            if (cancelled) return

            // Turned: the same pair at the same distance now pushes itself apart.
            spin.target = TURNED_ANGLE
            await delay.wait(0.55)
            if (cancelled) return
            await moveTo(CONTACT_COLUMN - 1, 0.14)
            if (cancelled) return
            await moveTo(DISTANT_COLUMN, 1.05)
            if (cancelled) return
            await delay.wait(0.8)
        }
    }

    void startSceneAnimation('Polarity', play)
    return {
        spin,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** The same pair attracts or repels depending only on how one cube is turned. */
export const PolarityScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<PolarityController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, {
                column: DISTANT_COLUMN,
                row: AXIS_ROW,
            })
            runtime.addCube({
                id: PARTNER_CUBE_ID,
                position: { column: PARTNER_COLUMN, row: AXIS_ROW },
                faceLabels,
            })
            const controller = createPolarityAnimation(runtime, {
                current: 0,
                target: 0,
            })
            controllerRef.current = controller
            return () => {
                controller.dispose()
                if (controllerRef.current === controller) controllerRef.current = null
            }
        },
        [faceLabels]
    )

    const onFrame = useCallback(({ mesh, delta }: SimpleCubeFrameContext): void => {
        const spin = controllerRef.current?.spin
        if (spin === undefined) return
        const progress = 1 - Math.exp(-delta / SPIN_RESPONSE_S)
        spin.current += (spin.target - spin.current) * progress
        mesh.rotation.y = spin.current
    }, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 8,
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
