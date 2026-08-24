import type { JSX } from 'react'

import type { SimpleCubeSetupContext } from '@runtime/core/useSimpleCubeScene'
import type { CubeFaceLabelsProps } from '@runtime/grid/cubeFaceLabels'
import { MAIN_CUBE_ID, type GridSceneCubeDefinition } from '@runtime/grid/gridSceneRuntime'
import { GridPathCubeScene } from '@runtime/presentation/GridPathCubeScene'
import { attachSceneMetadata, defineScene } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const CUBE_SIZE = GRID_CELL_SIZE
const LEFT_CUBE_ID = 'left-cube'
const RIGHT_CUBE_ID = 'right-cube'

const CURSOR_INFLUENCE_RADIUS = GRID_CELL_SIZE * 2.8
const CURSOR_ACCELERATION = 3.4
const ANCHOR_SPRING = 28
const VELOCITY_DAMPING = 9
const MAX_ANCHOR_OFFSET = GRID_CELL_SIZE * 1.7
const MIN_CUBE_SEPARATION = CUBE_SIZE * 1.08
const COLLISION_PASSES = 3

const CUBE_DEFINITIONS = [
    { id: LEFT_CUBE_ID, column: -2, row: 0, fallbackX: -1, fallbackZ: 0 },
    { id: MAIN_CUBE_ID, column: 0, row: 0, fallbackX: 0, fallbackZ: 1 },
    { id: RIGHT_CUBE_ID, column: 2, row: 0, fallbackX: 1, fallbackZ: 0 },
] as const

type RepelledCubeState = {
    readonly object: SimpleCubeSetupContext['mesh']
    readonly anchorX: number
    readonly anchorZ: number
    readonly fallbackX: number
    readonly fallbackZ: number
    offsetX: number
    offsetZ: number
    velocityX: number
    velocityZ: number
}

type PointerRepulsionController = {
    readonly update: (delta: number) => void
    readonly dispose: () => void
}

const clampCubeOffset = (cube: RepelledCubeState): void => {
    const distance = Math.hypot(cube.offsetX, cube.offsetZ)
    if (distance <= MAX_ANCHOR_OFFSET || distance === 0) return

    const scale = MAX_ANCHOR_OFFSET / distance
    cube.offsetX *= scale
    cube.offsetZ *= scale

    // Remove only the velocity that would push the cube farther outside its leash.
    const normalX = cube.offsetX / MAX_ANCHOR_OFFSET
    const normalZ = cube.offsetZ / MAX_ANCHOR_OFFSET
    const outwardVelocity = cube.velocityX * normalX + cube.velocityZ * normalZ
    if (outwardVelocity > 0) {
        cube.velocityX -= outwardVelocity * normalX
        cube.velocityZ -= outwardVelocity * normalZ
    }
}

const separateCubes = (cubes: readonly RepelledCubeState[]): void => {
    for (let pass = 0; pass < COLLISION_PASSES; pass += 1) {
        for (let firstIndex = 0; firstIndex < cubes.length; firstIndex += 1) {
            const first = cubes[firstIndex]
            if (first === undefined) continue

            for (let secondIndex = firstIndex + 1; secondIndex < cubes.length; secondIndex += 1) {
                const second = cubes[secondIndex]
                if (second === undefined) continue

                const deltaX = second.anchorX + second.offsetX - (first.anchorX + first.offsetX)
                const deltaZ = second.anchorZ + second.offsetZ - (first.anchorZ + first.offsetZ)
                const distance = Math.hypot(deltaX, deltaZ)
                if (distance >= MIN_CUBE_SEPARATION) continue

                const normalX = distance > 0.00001 ? deltaX / distance : 1
                const normalZ = distance > 0.00001 ? deltaZ / distance : 0
                const correction = (MIN_CUBE_SEPARATION - distance) / 2
                first.offsetX -= normalX * correction
                first.offsetZ -= normalZ * correction
                second.offsetX += normalX * correction
                second.offsetZ += normalZ * correction

                const relativeVelocity =
                    (second.velocityX - first.velocityX) * normalX +
                    (second.velocityZ - first.velocityZ) * normalZ
                if (relativeVelocity < 0) {
                    const impulse = relativeVelocity / 2
                    first.velocityX += impulse * normalX
                    first.velocityZ += impulse * normalZ
                    second.velocityX -= impulse * normalX
                    second.velocityZ -= impulse * normalZ
                }
            }
        }
    }

    for (const cube of cubes) clampCubeOffset(cube)
}

const createPointerRepulsionController = ({
    runtime,
    camera,
    canvas,
    THREE,
}: SimpleCubeSetupContext): PointerRepulsionController => {
    const cubes: RepelledCubeState[] = CUBE_DEFINITIONS.map((definition) => {
        const object = runtime.getCube(definition.id)
        if (object === undefined) throw new Error(`Missing cube "${definition.id}"`)

        return {
            object,
            anchorX: definition.column * GRID_CELL_SIZE,
            anchorZ: definition.row * GRID_CELL_SIZE,
            fallbackX: definition.fallbackX,
            fallbackZ: definition.fallbackZ,
            offsetX: 0,
            offsetZ: 0,
            velocityX: 0,
            velocityZ: 0,
        }
    })

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    const pointerWorld = new THREE.Vector3()
    const cubeCenterY = CUBE_SIZE / 2 + GRID_CELL_SIZE * 0.02
    const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -cubeCenterY)
    let pointerActive = false

    const onPointerMove = (event: PointerEvent): void => {
        const bounds = canvas.getBoundingClientRect()
        if (bounds.width === 0 || bounds.height === 0) return

        pointerNdc.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1
        )
        raycaster.setFromCamera(pointerNdc, camera)
        pointerActive = raycaster.ray.intersectPlane(interactionPlane, pointerWorld) !== null
    }

    const onPointerLeave = (): void => {
        pointerActive = false
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)

    return {
        update: (rawDelta: number): void => {
            const delta = Math.min(rawDelta, 1 / 30)
            const damping = Math.exp(-VELOCITY_DAMPING * delta)

            for (const cube of cubes) {
                let accelerationX = -cube.offsetX * ANCHOR_SPRING
                let accelerationZ = -cube.offsetZ * ANCHOR_SPRING

                if (pointerActive) {
                    const deltaX = cube.anchorX + cube.offsetX - pointerWorld.x
                    const deltaZ = cube.anchorZ + cube.offsetZ - pointerWorld.z
                    const distance = Math.hypot(deltaX, deltaZ)

                    if (distance < CURSOR_INFLUENCE_RADIUS) {
                        const pressure = 1 - distance / CURSOR_INFLUENCE_RADIUS
                        const acceleration = CURSOR_ACCELERATION * pressure * pressure
                        const normalX = distance > 0.00001 ? deltaX / distance : cube.fallbackX
                        const normalZ = distance > 0.00001 ? deltaZ / distance : cube.fallbackZ
                        accelerationX += normalX * acceleration
                        accelerationZ += normalZ * acceleration
                    }
                }

                cube.velocityX = (cube.velocityX + accelerationX * delta) * damping
                cube.velocityZ = (cube.velocityZ + accelerationZ * delta) * damping
                cube.offsetX += cube.velocityX * delta
                cube.offsetZ += cube.velocityZ * delta
                clampCubeOffset(cube)
            }

            separateCubes(cubes)

            // The runtime restores every cube to its logical grid cell before this callback.
            // Applying the temporary offsets here keeps pathfinding state untouched.
            for (const cube of cubes) {
                cube.object.position.x += cube.offsetX
                cube.object.position.z += cube.offsetZ
            }
        },
        dispose: () => {
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerleave', onPointerLeave)
        },
    }
}

/** Three anchored cubes that physically move away whenever the pointer approaches them. */
export const CursorRepulsionScene = defineScene<CubeFaceLabelsProps, PointerRepulsionController>({
    metadata: {
        primaryCategory: 'structure',
        id: 'cursor-repulsion',
        title: 'Cursor Repulsion',
        tags: ['interaction', 'avoidance'],
        description: 'Three cubes physically retreat from the pointer.',
    },
    view: {
        cubeSize: CUBE_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 9,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
        // This scene handles the pointer itself; the shared hover highlight would fight it.
        enableCubeHover: false,
    },
    setup: (context) => {
        const { runtime, props } = context
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
        return createPointerRepulsionController(context)
    },
    onFrame: ({ delta, state }) => {
        state.update(delta)
    },
    teardown: (_context, state) => {
        state.dispose()
    },
})

/** Three static cubes in a row with one empty grid cell between adjacent cubes. */
const ThreeCubesSceneComponent = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const additionalCubes: readonly GridSceneCubeDefinition[] = [
        { id: LEFT_CUBE_ID, position: { column: -2, row: 0 }, faceLabels },
        { id: RIGHT_CUBE_ID, position: { column: 2, row: 0 }, faceLabels },
    ]

    return (
        <GridPathCubeScene
            cubeSize={CUBE_SIZE}
            cubeCornerRadius={cubeCornerRadius}
            gridCellSize={GRID_CELL_SIZE}
            gridCellCount={9}
            cameraAzimuthDeg={0}
            viewOffsetY={0}
            hoverCells={0}
            movementMode='move-cube'
            mainCubeFaceLabels={faceLabels}
            additionalCubes={additionalCubes}
        />
    )
}

export const ThreeCubesScene = attachSceneMetadata(ThreeCubesSceneComponent, {
    primaryCategory: 'structure',
    id: 'three-cubes',
    title: 'Three Cubes',
    tags: ['relation', 'structure'],
    description: 'Three cubes hold a row with one empty cell between them.',
})
