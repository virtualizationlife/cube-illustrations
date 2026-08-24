import { MAIN_CUBE_ID, type GridCoordinate } from '../scenes/gridSceneRuntime'
import {
    SIGN_SYMBOLS,
    rotateSignSymbol,
    type SignDirection,
} from '../scenes/signSymbols'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

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

const BASE_PRESENTATION = {
    zoom: 1.12,
    gridOpacity: 0.42,
    gridFadeInnerRadiusCells: 4,
    gridFadeOuterRadiusCells: 12,
} as const

interface BecomingSignState {
    previousDirectionIndex: number
    previousSymbolIndex: number
}

/** A random-looking group becomes one of many symbols that guides the main cube. */
export const BecomingSignScene = defineScene<CubeSceneProps, BecomingSignState>({
    metadata: {
        id: 'becoming-a-sign',
        title: 'Becoming a Sign',
        tags: ['meaning', 'symbol'],
        description: 'A scattered group resolves into a sign and is followed.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 23,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, { column: -7, row: 0 })
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        SIGN_CUBE_IDS.forEach((id, index) => {
            const position = SCATTER_POSITIONS[index]
            if (position !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        })
        return { previousDirectionIndex: -1, previousSymbolIndex: -1 }
    },
    script: async ({ runtime, timeline, random, state, presentation }) => {
        const moveSignCubes = async (
            positions: readonly GridCoordinate[]
        ): Promise<void> => {
            for (let index = 0; index < SIGN_CUBE_IDS.length; index += 1) {
                const id = SIGN_CUBE_IDS[index]
                const position = positions[index]
                if (id === undefined || position === undefined) continue
                await runtime.moveCubeTo(id, position, {
                    duration: 0.3,
                    easing: 'easeInOutCubic',
                })
                await timeline.wait(0.035)
            }
        }

        const enterMainCube = async (
            definition: SignDirectionDefinition
        ): Promise<void> => {
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

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            const directionIndex = random.differentIndex(
                DIRECTIONS.length,
                state.previousDirectionIndex
            )
            state.previousDirectionIndex = directionIndex
            const definition = DIRECTIONS[directionIndex]
            if (definition === undefined) return

            const symbolIndex = random.differentIndex(
                SIGN_SYMBOLS.length,
                state.previousSymbolIndex
            )
            state.previousSymbolIndex = symbolIndex
            const symbol = SIGN_SYMBOLS[symbolIndex]
            if (symbol === undefined) return

            await enterMainCube(definition)
            await timeline.wait(0.7)

            presentation?.setTarget({
                zoom: 0.76,
                gridOpacity: 0.66,
                gridFadeInnerRadiusCells: 5.5,
                gridFadeOuterRadiusCells: 12,
            })
            await moveSignCubes(rotateSignSymbol(symbol.positions, definition.direction))
            await timeline.wait(1)

            presentation?.setTarget({
                zoom: 1,
                gridOpacity: 0.5,
                gridFadeInnerRadiusCells: 4.5,
                gridFadeOuterRadiusCells: 12,
            })
            await followSign(definition)
            await timeline.wait(0.55)

            presentation?.setTarget(BASE_PRESENTATION)
            await moveSignCubes(SCATTER_POSITIONS)
            await timeline.wait(0.7)
        })
    },
})
