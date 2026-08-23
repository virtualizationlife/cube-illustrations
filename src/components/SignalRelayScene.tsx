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
const RELAY_ROW = 0
const RELAY_COLUMNS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const
const EXIT: GridCoordinate = { column: -7, row: RELAY_ROW }
const ENTRY: GridCoordinate = { column: 7, row: RELAY_ROW }
const RELAY_CUBE_IDS = [
    MAIN_CUBE_ID,
    ...Array.from({ length: RELAY_COLUMNS.length - 1 }, (_, index) =>
        `signal-relay-${index}`
    ),
] as const

interface SignalRelayController {
    readonly dispose: () => void
}

const createSignalRelayAnimation = (
    runtime: GridSceneRuntime
): SignalRelayController => {
    let cancelled = false
    const delay = createCancellableDelay()
    const relay = [...RELAY_CUBE_IDS]

    const sendPulse = async (): Promise<void> => {
        for (const cubeId of relay) {
            await runtime.fadeCubeTo(cubeId, 0.28, {
                duration: 0.12,
                easing: 'easeOutCubic',
            })
            if (cancelled) return
            await runtime.fadeCubeTo(cubeId, 1, {
                duration: 0.16,
                easing: 'easeOutCubic',
            })
            if (cancelled) return
            await delay.wait(0.025)
        }
    }

    const renewRelay = async (): Promise<void> => {
        const departingId = relay[0]
        if (departingId === undefined) return

        await Promise.all([
            runtime.moveCubeTo(departingId, EXIT, {
                duration: 0.42,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(departingId, 0, {
                duration: 0.42,
                easing: 'easeOutCubic',
            }),
        ])
        if (cancelled) return

        for (let index = 1; index < relay.length; index += 1) {
            const cubeId = relay[index]
            const destinationColumn = RELAY_COLUMNS[index - 1]
            if (cubeId === undefined || destinationColumn === undefined) continue
            await runtime.moveCubeTo(
                cubeId,
                { column: destinationColumn, row: RELAY_ROW },
                { duration: 0.16, easing: 'easeInOutCubic' }
            )
            if (cancelled) return
        }

        runtime.setCubePosition(departingId, ENTRY)
        const tailColumn = RELAY_COLUMNS[RELAY_COLUMNS.length - 1]
        if (tailColumn === undefined) return
        await Promise.all([
            runtime.moveCubeTo(
                departingId,
                { column: tailColumn, row: RELAY_ROW },
                { duration: 0.46, easing: 'easeInOutCubic' }
            ),
            runtime.fadeCubeTo(departingId, 1, {
                duration: 0.46,
                easing: 'easeOutCubic',
            }),
        ])
        relay.shift()
        relay.push(departingId)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.7)
        while (!cancelled) {
            await sendPulse()
            if (cancelled) return
            await delay.wait(0.45)
            await renewRelay()
            if (!cancelled) await delay.wait(0.7)
        }
    }

    void startSceneAnimation('Signal Relay', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A pulse travels through a line whose carriers continuously leave and rejoin. */
export const SignalRelayScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            RELAY_CUBE_IDS.forEach((cubeId, index) => {
                const column = RELAY_COLUMNS[index]
                if (column === undefined) return
                const position = { column, row: RELAY_ROW }
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels })
            })
            const animation = createSignalRelayAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 8,
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
