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
import { getDifferentRandomIndex } from '../scenes/sceneRandom'
import {
    SIGN_SYMBOLS,
    rotateSignSymbol,
    type SignDirection,
} from '../scenes/signSymbols'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.047
const SIGN_CUBE_IDS = Array.from({ length: 9 }, (_, index) => `meaning-sign-${index}`)
const SCATTER_POSITIONS: readonly GridCoordinate[] = [
    { column: -5, row: -4 },
    { column: -3, row: -5 },
    { column: -1, row: -4 },
    { column: 1, row: -5 },
    { column: 3, row: -5 },
    { column: 5, row: -4 },
    { column: -5, row: 4 },
    { column: -3, row: 5 },
    { column: 3, row: 5 },
]
interface SignDirectionDefinition {
    readonly direction: SignDirection
    readonly entry: GridCoordinate
    readonly visibleEntry: GridCoordinate
    readonly visibleExit: GridCoordinate
    readonly exit: GridCoordinate
}

const DIRECTIONS: readonly SignDirectionDefinition[] = [
    {
        direction: 'right',
        entry: { column: -7, row: 0 },
        visibleEntry: { column: -5, row: 0 },
        visibleExit: { column: 5, row: 0 },
        exit: { column: 7, row: 0 },
    },
    {
        direction: 'left',
        entry: { column: 7, row: 0 },
        visibleEntry: { column: 5, row: 0 },
        visibleExit: { column: -5, row: 0 },
        exit: { column: -7, row: 0 },
    },
    {
        direction: 'up',
        entry: { column: 0, row: -7 },
        visibleEntry: { column: 0, row: -5 },
        visibleExit: { column: 0, row: 5 },
        exit: { column: 0, row: 7 },
    },
    {
        direction: 'down',
        entry: { column: 0, row: 7 },
        visibleEntry: { column: 0, row: 5 },
        visibleExit: { column: 0, row: -5 },
        exit: { column: 0, row: -7 },
    },
]

interface BecomingSignController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createBecomingSignAnimation = (
    runtime: GridSceneRuntime,
    faceLabels: GridCubeFaceLabelInput | undefined
): BecomingSignController => {
    let cancelled = false
    let previousDirectionIndex = -1
    let previousSymbolIndex = -1
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1.12,
        gridOpacity: 0.42,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 12,
    })

    const moveSignCubes = async (positions: readonly GridCoordinate[]): Promise<void> => {
        for (let index = 0; index < SIGN_CUBE_IDS.length; index += 1) {
            const id = SIGN_CUBE_IDS[index]
            const position = positions[index]
            if (id === undefined || position === undefined) continue
            await runtime.moveCubeTo(id, position, {
                duration: 0.3,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
            await delay.wait(0.035)
        }
    }

    const enterMainCube = async (definition: SignDirectionDefinition): Promise<void> => {
        runtime.setCubePosition(MAIN_CUBE_ID, definition.entry)
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, definition.visibleEntry, {
                duration: 0.52,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                duration: 0.52,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const followSign = async (definition: SignDirectionDefinition): Promise<void> => {
        await runtime.moveCubeTo(MAIN_CUBE_ID, definition.visibleExit, {
            duration: 1.15,
            easing: 'easeInOutCubic',
        })
        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, definition.exit, {
                duration: 0.5,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
                duration: 0.5,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            const directionIndex = getDifferentRandomIndex(
                DIRECTIONS.length,
                previousDirectionIndex
            )
            previousDirectionIndex = directionIndex
            const definition = DIRECTIONS[directionIndex]
            if (definition === undefined) return

            const symbolIndex = getDifferentRandomIndex(
                SIGN_SYMBOLS.length,
                previousSymbolIndex
            )
            previousSymbolIndex = symbolIndex
            const symbol = SIGN_SYMBOLS[symbolIndex]
            if (symbol === undefined) return

            await enterMainCube(definition)
            if (cancelled) return
            await delay.wait(0.7)

            presentation.setTarget({
                zoom: 0.76,
                gridOpacity: 0.66,
                gridFadeInnerRadiusCells: 5.5,
                gridFadeOuterRadiusCells: 12,
            })
            await moveSignCubes(
                rotateSignSymbol(symbol.positions, definition.direction)
            )
            if (cancelled) return
            await delay.wait(1)

            presentation.setTarget({
                zoom: 1,
                gridOpacity: 0.5,
                gridFadeInnerRadiusCells: 4.5,
                gridFadeOuterRadiusCells: 12,
            })
            await followSign(definition)
            if (cancelled) return
            await delay.wait(0.55)

            presentation.setTarget({
                zoom: 1.12,
                gridOpacity: 0.42,
                gridFadeInnerRadiusCells: 4,
                gridFadeOuterRadiusCells: 12,
            })
            await moveSignCubes(SCATTER_POSITIONS)
            if (!cancelled) await delay.wait(0.7)
        }
    }

    void startSceneAnimation('Becoming a Sign', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A random-looking group becomes one of many symbols that guides the main cube. */
export const BecomingSignScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<BecomingSignController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, { column: -7, row: 0 })
            runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
            SIGN_CUBE_IDS.forEach((id, index) => {
                const position = SCATTER_POSITIONS[index]
                if (position !== undefined) runtime.addCube({ id, position, faceLabels })
            })
            const controller = createBecomingSignAnimation(runtime, faceLabels)
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
        gridCellCount: 23,
        gridOpacity: 0.42,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 12,
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
