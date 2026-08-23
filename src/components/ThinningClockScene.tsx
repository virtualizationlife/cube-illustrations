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

const GRID_CELL_SIZE = 0.042
const DIAL_POSITIONS: readonly GridCoordinate[] = [
    { column: 2, row: 0 },
    { column: 2, row: 1 },
    { column: 1, row: 2 },
    { column: 0, row: 2 },
    { column: -1, row: 2 },
    { column: -2, row: 1 },
    { column: -2, row: 0 },
    { column: -2, row: -1 },
    { column: -1, row: -2 },
    { column: 0, row: -2 },
    { column: 1, row: -2 },
    { column: 2, row: -1 },
]
/** Where the hand stands while it marks the hour opposite to it. */
const HAND_POSITIONS: readonly GridCoordinate[] = DIAL_POSITIONS.map(
    ({ column, row }) => ({ column: column * 2, row: row * 2 })
)
const DIAL_CUBE_IDS: readonly string[] = DIAL_POSITIONS.map(
    (_, index) => `thinning-clock-${index}`
)
const BEAT_START_S = 0.46
const BEAT_DECAY = 0.82
const MARKS_REMOVED_PER_LAP = 2
const MARKS_LEFT_BEFORE_RESET = 2

interface ThinningClockController {
    readonly dispose: () => void
}

const createThinningClockAnimation = (
    runtime: GridSceneRuntime
): ThinningClockController => {
    let cancelled = false
    let lap = 0
    const delay = createCancellableDelay()
    const lit = DIAL_POSITIONS.map(() => true)

    const refillDial = async (): Promise<void> => {
        for (let index = 0; index < DIAL_CUBE_IDS.length; index += 1) {
            const cubeId = DIAL_CUBE_IDS[index]
            if (cubeId === undefined) continue
            lit[index] = true
            void runtime.fadeCubeTo(cubeId, 1, {
                duration: 0.45,
                easing: 'easeOutCubic',
            })
            await delay.wait(0.05)
            if (cancelled) return
        }
    }

    const runLap = async (beat: number): Promise<readonly number[]> => {
        const visited: number[] = []
        for (let index = 0; index < DIAL_POSITIONS.length; index += 1) {
            if (!lit[index] || cancelled) continue
            const handPosition = HAND_POSITIONS[index]
            if (handPosition === undefined) continue
            await runtime.moveCubeTo(MAIN_CUBE_ID, handPosition, {
                duration: beat * 0.8,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return visited
            visited.push(index)
            await delay.wait(beat * 0.3)
            if (cancelled) return visited
        }
        return visited
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            const visited = await runLap(BEAT_START_S * BEAT_DECAY ** lap)
            if (cancelled) return

            // The hand takes the last marks it passed away with it.
            for (const index of visited.slice(-MARKS_REMOVED_PER_LAP)) {
                const cubeId = DIAL_CUBE_IDS[index]
                if (cubeId === undefined) continue
                lit[index] = false
                void runtime.fadeCubeTo(cubeId, 0, {
                    duration: 0.5,
                    easing: 'easeOutCubic',
                })
            }
            lap += 1

            if (lit.filter(Boolean).length > MARKS_LEFT_BEFORE_RESET) continue
            await delay.wait(0.7)
            if (cancelled) return
            await refillDial()
            if (cancelled) return
            lap = 0
            await delay.wait(0.6)
        }
    }

    void startSceneAnimation('Thinning Clock', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A hand circles a dial that keeps losing marks, so every lap is shorter than the last. */
export const ThinningClockScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const [firstHandPosition] = HAND_POSITIONS
            if (firstHandPosition !== undefined) {
                runtime.setCubePosition(MAIN_CUBE_ID, firstHandPosition)
            }
            DIAL_CUBE_IDS.forEach((cubeId, index) => {
                const position = DIAL_POSITIONS[index]
                if (position === undefined) return
                runtime.addCube({ id: cubeId, position, faceLabels })
            })
            const animation = createThinningClockAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 19,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 10,
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
