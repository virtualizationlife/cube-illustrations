import { MAIN_CUBE_ID } from '../scenes/gridSceneRuntime'
import type { SceneRandom } from '../scenes/sceneRandom'
import type { SimpleCubeSetupContext } from '../scenes/useSimpleCubeScene'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const CUBE_SIZE = GRID_CELL_SIZE
const LEFT_CUBE_ID = 'growing-cube'
const RIGHT_CUBE_ID = 'shrinking-cube'

const GROWN_SCALE = 1.16
const SHRUNK_SCALE = 0.84
const SCALE_DURATION_S = 0.45
const LIFT_DURATION_S = 0.75
const ROTATION_DURATION_S = 0.65
const ROTATION_HOLD_S = 0.18
const TOP_HOLD_S = 0.3
const LOWER_DURATION_S = 0.75
const QUARTER_TURN = Math.PI / 2

type RotationAxis = 'x' | 'y' | 'z'

interface ThreeCubeStatesController {
    readonly update: (delta: number) => void
    readonly setHoveredCube: (cubeId: string | null) => void
}

const easeInOutCubic = (progress: number): number =>
    progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2

const moveToward = (current: number, target: number, amount: number): number =>
    current < target ? Math.min(target, current + amount) : Math.max(target, current - amount)

const shuffleAxes = (random: SceneRandom): RotationAxis[] => {
    const axes: RotationAxis[] = ['x', 'y', 'z']
    for (let index = axes.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random.next() * (index + 1))
        const current = axes[index]
        const replacement = axes[swapIndex]
        if (current === undefined || replacement === undefined) continue
        axes[index] = replacement
        axes[swapIndex] = current
    }
    return axes
}

const createThreeCubeStatesController = (
    { runtime, THREE }: SimpleCubeSetupContext,
    random: SceneRandom
): ThreeCubeStatesController => {
    const leftCube = runtime.getCube(LEFT_CUBE_ID)
    const middleCube = runtime.getCube(MAIN_CUBE_ID)
    const rightCube = runtime.getCube(RIGHT_CUBE_ID)
    if (leftCube === undefined || middleCube === undefined || rightCube === undefined) {
        throw new Error('Three States scene requires all three cubes')
    }

    const rotationStart = new THREE.Quaternion()
    const rotationTarget = new THREE.Quaternion()
    const rotationStep = new THREE.Quaternion()
    const axisVector = new THREE.Vector3()
    let hoveredCubeId: string | null = null
    let leftHoverProgress = 0
    let rightHoverProgress = 0
    let middlePhase: 'idle' | 'lifting' | 'rotating' | 'rotation-hold' | 'top-hold' | 'lowering' =
        'idle'
    let middlePhaseElapsed = 0
    let middleLiftProgress = 0
    let rotationAxes: RotationAxis[] = []
    let rotationIndex = 0
    let rotationElapsed = 0

    const beginRotation = (): void => {
        const axis = rotationAxes[rotationIndex] ?? 'x'
        axisVector.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
        const direction = random.next() < 0.5 ? -1 : 1
        rotationStart.copy(middleCube.quaternion)
        rotationStep.setFromAxisAngle(axisVector, direction * QUARTER_TURN)
        rotationTarget.copy(rotationStart).multiply(rotationStep).normalize()
        rotationElapsed = 0
        middlePhase = 'rotating'
    }

    const beginMiddleInteraction = (): void => {
        if (middlePhase !== 'idle') return
        middlePhase = 'lifting'
        middlePhaseElapsed = 0
        middleLiftProgress = 0
    }

    return {
        setHoveredCube: (cubeId: string | null): void => {
            hoveredCubeId = cubeId
            if (cubeId === MAIN_CUBE_ID) beginMiddleInteraction()
        },
        update: (rawDelta: number): void => {
            const delta = Math.min(rawDelta, 0.05)
            const scaleStep = delta / SCALE_DURATION_S
            leftHoverProgress = moveToward(
                leftHoverProgress,
                hoveredCubeId === LEFT_CUBE_ID ? 1 : 0,
                scaleStep
            )
            rightHoverProgress = moveToward(
                rightHoverProgress,
                hoveredCubeId === RIGHT_CUBE_ID ? 1 : 0,
                scaleStep
            )
            leftCube.scale.setScalar(
                1 + (GROWN_SCALE - 1) * easeInOutCubic(leftHoverProgress)
            )
            rightCube.scale.setScalar(
                1 + (SHRUNK_SCALE - 1) * easeInOutCubic(rightHoverProgress)
            )

            switch (middlePhase) {
                case 'idle':
                    middleLiftProgress = 0
                    break
                case 'lifting': {
                    middlePhaseElapsed = Math.min(
                        LIFT_DURATION_S,
                        middlePhaseElapsed + delta
                    )
                    middleLiftProgress = easeInOutCubic(
                        middlePhaseElapsed / LIFT_DURATION_S
                    )
                    if (middlePhaseElapsed >= LIFT_DURATION_S) {
                        middleLiftProgress = 1
                        rotationAxes = shuffleAxes(random)
                        rotationIndex = 0
                        beginRotation()
                    }
                    break
                }
                case 'rotating': {
                    middleLiftProgress = 1
                    rotationElapsed = Math.min(
                        ROTATION_DURATION_S,
                        rotationElapsed + delta
                    )
                    const rotationProgress = easeInOutCubic(
                        rotationElapsed / ROTATION_DURATION_S
                    )
                    middleCube.quaternion.slerpQuaternions(
                        rotationStart,
                        rotationTarget,
                        rotationProgress
                    )
                    if (rotationElapsed >= ROTATION_DURATION_S) {
                        middleCube.quaternion.copy(rotationTarget)
                        rotationIndex += 1
                        middlePhaseElapsed = 0
                        middlePhase =
                            rotationIndex < rotationAxes.length
                                ? 'rotation-hold'
                                : 'top-hold'
                    }
                    break
                }
                case 'rotation-hold':
                    middleLiftProgress = 1
                    middlePhaseElapsed += delta
                    if (middlePhaseElapsed >= ROTATION_HOLD_S) beginRotation()
                    break
                case 'top-hold':
                    middleLiftProgress = 1
                    middlePhaseElapsed += delta
                    if (middlePhaseElapsed >= TOP_HOLD_S) {
                        middlePhase = 'lowering'
                        middlePhaseElapsed = 0
                    }
                    break
                case 'lowering':
                    middlePhaseElapsed = Math.min(
                        LOWER_DURATION_S,
                        middlePhaseElapsed + delta
                    )
                    middleLiftProgress =
                        1 - easeInOutCubic(middlePhaseElapsed / LOWER_DURATION_S)
                    if (middlePhaseElapsed >= LOWER_DURATION_S) {
                        middleLiftProgress = 0
                        middlePhase = 'idle'
                        if (hoveredCubeId === MAIN_CUBE_ID) beginMiddleInteraction()
                    }
                    break
            }

            // The runtime restores the grid position before every frame, so the lift is
            // reapplied as a temporary visual offset without changing the logical cell.
            middleCube.position.y += GRID_CELL_SIZE * middleLiftProgress
        },
    }
}

/** Three cubes contrast growth, reduction, and elevated random face changes. */
export const ThreeCubeStatesScene = defineScene<
    CubeSceneProps,
    ThreeCubeStatesController
>({
    metadata: {
        id: 'three-states',
        title: 'Three States',
        tags: ['form', 'contrast', 'transformation'],
        description: 'Growth, reduction and elevation shown side by side.',
    },
    view: {
        cubeSize: CUBE_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 9,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: (context) => {
        const { runtime, props, random } = context
        runtime.addCube({
            id: LEFT_CUBE_ID,
            position: { column: -2, row: 0 },
            faceLabels: props.faceLabels,
        })
        runtime.addCube({
            id: RIGHT_CUBE_ID,
            position: { column: 2, row: 0 },
            faceLabels: props.faceLabels,
        })
        return createThreeCubeStatesController(context, random)
    },
    onFrame: ({ delta, state }) => {
        state.update(delta)
    },
    onCubeHoverChange: ({ cube, state }) => {
        state.setHoveredCube(cube?.id ?? null)
    },
})
