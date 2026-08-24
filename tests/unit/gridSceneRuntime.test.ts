import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import {
    getProximityOpacity,
    type GridProximityOpacityConfig,
} from '@runtime/animation/gridSceneAnimation'
import { normalizeCubeFaceLabel, resolveCubeFaceLabels } from '@runtime/grid/cubeFaceLabels'
import { findGridPath, getGridCellKey } from '@runtime/grid/gridPathfinding'
import {
    createGridSceneRuntime,
    DEFAULT_CUBE_CORNER_RADIUS_RATIO,
    getGridDistance,
    MAIN_CUBE_ID,
} from '@runtime/grid/gridSceneRuntime'

const createRuntime = () => {
    const scene = new THREE.Scene()
    const runtime = createGridSceneRuntime({
        scene,
        THREE,
        gridCellSize: 0.1,
        gridCellCount: 5,
        mainCubeSize: 0.1,
        mainCubeHoverCells: 0,
    })
    return { runtime, scene }
}

const PROXIMITY_OPACITY: GridProximityOpacityConfig = {
    targetCubeIds: [],
    baseOpacity: 0.3,
    fadeStartDistance: 4,
    farDistance: 3,
    farOpacity: 0.6,
    nearDistance: 1,
    nearOpacity: 1,
}

describe('grid scene runtime', () => {
    it('uses subtle rounded corners by default and supports radius overrides', () => {
        const { runtime } = createRuntime()
        const mainBody = runtime.mainCube.children[0]
        if (!(mainBody instanceof THREE.Mesh)) throw new Error('Main cube body is missing')

        const roundedGeometry = mainBody.geometry as {
            readonly type: string
            readonly parameters: { readonly radius: number }
        }
        expect(roundedGeometry.type).toBe('RoundedBoxGeometry')
        expect(roundedGeometry.parameters.radius).toBeCloseTo(
            0.1 * DEFAULT_CUBE_CORNER_RADIUS_RATIO
        )

        const sharpCube = runtime.addCube({
            id: 'sharp',
            position: { column: 1, row: 0 },
            cornerRadius: 0,
        })
        const sharpBody = sharpCube.children[0]
        if (!(sharpBody instanceof THREE.Mesh)) throw new Error('Sharp cube body is missing')
        const sharpGeometry = sharpBody.geometry as { readonly type: string }
        expect(sharpGeometry.type).toBe('BoxGeometry')

        runtime.dispose()
    })

    it('makes encounter cubes opaque as the main cube approaches', () => {
        expect(getProximityOpacity(5, PROXIMITY_OPACITY)).toBe(0.3)
        expect(getProximityOpacity(3, PROXIMITY_OPACITY)).toBe(0.6)
        expect(getProximityOpacity(1, PROXIMITY_OPACITY)).toBe(1)
    })

    it('restores a cube transform that was written to from outside', () => {
        // Scenes animate on top of the runtime's transform and rely on every update
        // restoring it from the grid coordinates. FaceFlipCubeScene's flip lift does
        // `mesh.position.y += ...` each frame; without the restore it accumulates and the
        // cube leaves the frame for good.
        const { runtime } = createRuntime()
        const baseY = runtime.mainCube.position.y

        runtime.mainCube.position.y += 0.5
        runtime.update(0.016)
        expect(runtime.mainCube.position.y).toBeCloseTo(baseY)

        runtime.mainCube.position.y += 0.5
        runtime.update(0.016)
        expect(runtime.mainCube.position.y).toBeCloseTo(baseY)

        runtime.dispose()
    })

    it('measures proximity between grid cells', () => {
        expect(getGridDistance({ column: -1, row: 1 }, { column: 2, row: 5 })).toBe(5)
    })

    it('moves any number of cubes between grid coordinates', async () => {
        const { runtime } = createRuntime()
        const secondCube = runtime.addCube({
            id: 'second',
            position: { column: -2, row: 1 },
        })
        const thirdCube = runtime.addCube({
            id: 'third',
            position: { column: 3, row: -1 },
        })

        const secondMove = runtime.moveCubeTo(
            'second',
            { column: -2, row: 3 },
            { duration: 1, easing: 'linear' }
        )
        const thirdMove = runtime.moveCubeTo(
            'third',
            { column: 3, row: 1 },
            { duration: 1, easing: 'linear' }
        )

        runtime.update(0.5)
        expect(secondCube.position.x).toBeCloseTo(-0.2)
        expect(secondCube.position.z).toBeCloseTo(0.2)
        expect(thirdCube.position.x).toBeCloseTo(0.3)
        expect(thirdCube.position.z).toBeCloseTo(0)

        runtime.update(0.5)
        await Promise.all([secondMove, thirdMove])
        expect(runtime.getCubePosition('second')).toEqual({ column: -2, row: 3 })
        expect(runtime.getCubePosition('third')).toEqual({ column: 3, row: 1 })

        runtime.dispose()
    })

    it('never places two cubes in the same grid cell', async () => {
        const { runtime } = createRuntime()
        runtime.addCube({ id: 'blocker', position: { column: 1, row: 0 } })

        expect(() => runtime.addCube({ id: 'duplicate', position: { column: 1, row: 0 } })).toThrow(
            /already occupied/
        )
        expect(() => {
            runtime.setCubePosition(MAIN_CUBE_ID, { column: 1, row: 0 })
        }).toThrow(/already occupied/)

        await runtime.moveCubeTo(MAIN_CUBE_ID, { column: 1, row: 0 }, { duration: 1 })
        expect(runtime.getCubePosition(MAIN_CUBE_ID)).toEqual({ column: 0, row: 0 })

        runtime.dispose()
    })

    it('routes moving cubes cell by cell around occupied cells', async () => {
        const { runtime } = createRuntime()
        runtime.addCube({ id: 'blocker', position: { column: 1, row: 0 } })
        const movement = runtime.moveCubeTo(
            MAIN_CUBE_ID,
            { column: 2, row: 0 },
            { duration: 1, easing: 'linear' }
        )

        for (let step = 0; step < 4; step += 1) {
            runtime.update(0.25)
            expect(runtime.getCubePosition(MAIN_CUBE_ID)).not.toEqual({ column: 1, row: 0 })
        }
        await movement
        expect(runtime.getCubePosition(MAIN_CUBE_ID)).toEqual({ column: 2, row: 0 })

        runtime.dispose()
    })

    it('reserves the starting cell until a moving cube finishes its route', async () => {
        const { runtime } = createRuntime()
        runtime.addCube({ id: 'follower', position: { column: -1, row: 0 } })

        const leadingMove = runtime.moveCubeTo(
            MAIN_CUBE_ID,
            { column: 2, row: 0 },
            { duration: 1, easing: 'linear' }
        )
        runtime.update(0.25)

        await runtime.moveCubeTo(
            'follower',
            { column: 0, row: 0 },
            { duration: 1, easing: 'linear' }
        )
        expect(runtime.getCubePosition('follower')).toEqual({ column: -1, row: 0 })

        runtime.update(0.75)
        await leadingMove
        runtime.dispose()
    })

    it('finds cardinal paths without crossing blocked cells', () => {
        const blocked = new Set([getGridCellKey({ column: 1, row: 0 })])
        const path = findGridPath({ column: 0, row: 0 }, { column: 2, row: 0 }, blocked)

        expect(path).not.toBeNull()
        expect(path).toHaveLength(4)
        expect(path?.map(getGridCellKey)).not.toContain('1:0')
    })

    it('normalizes face labels to three symbols and supports per-face text', () => {
        expect(normalizeCubeFaceLabel(' ABCD ')).toBe('ABC')
        expect(normalizeCubeFaceLabel('🧊ABZ')).toBe('🧊AB')
        expect(resolveCubeFaceLabels({ front: 'ONE', top: 'TOP!' })).toMatchObject({
            front: 'ONE',
            top: 'TOP',
            back: '',
        })
    })

    it('keeps the tracked cube fixed while focus and grid move together', async () => {
        const { runtime } = createRuntime()
        const travel = runtime.travelWithCube(
            MAIN_CUBE_ID,
            { column: 2, row: -1 },
            { duration: 1, easing: 'linear' }
        )

        runtime.update(0.5)
        expect(runtime.mainCube.position.x).toBeCloseTo(0)
        expect(runtime.mainCube.position.z).toBeCloseTo(0)
        // Cardinal pathing completes the first horizontal cell before turning.
        expect(runtime.getGridFocus()).toEqual({ column: 1.5, row: 0 })

        runtime.update(0.5)
        await travel
        expect(runtime.mainCube.position.x).toBeCloseTo(0)
        expect(runtime.mainCube.position.z).toBeCloseTo(0)

        runtime.dispose()
    })

    it('keeps tracking the latest travel when an earlier call finishes', async () => {
        const { runtime } = createRuntime()
        const firstTravel = runtime.travelWithCube(
            MAIN_CUBE_ID,
            { column: 2, row: 0 },
            { duration: 1, easing: 'linear' }
        )

        runtime.update(0.25)
        const secondTravel = runtime.travelWithCube(
            MAIN_CUBE_ID,
            { column: 3, row: 0 },
            { duration: 1, easing: 'linear' }
        )
        await firstTravel

        runtime.update(0.5)
        expect(runtime.mainCube.position.x).toBeCloseTo(0)
        expect(runtime.mainCube.position.z).toBeCloseTo(0)

        runtime.update(0.5)
        await secondTravel
        runtime.dispose()
    })

    it('supports fading, removal, and complete scene cleanup', () => {
        const { runtime, scene } = createRuntime()
        const distantCube = runtime.addCube({
            id: 'distant',
            position: { column: 2, row: 0 },
            opacity: 0.25,
        })
        const body = distantCube.children[0]

        expect(distantCube.children).toHaveLength(2)
        expect(body).toBeInstanceOf(THREE.Mesh)
        if (!(body instanceof THREE.Mesh)) throw new Error('Cube body mesh is missing')
        expect(body.material).toBeInstanceOf(THREE.MeshBasicMaterial)
        if (!(body.material instanceof THREE.MeshBasicMaterial)) {
            throw new Error('Cube body material is missing')
        }
        expect(body.material.transparent).toBe(true)
        expect(body.material.depthWrite).toBe(true)
        expect(body.material.side).toBe(THREE.FrontSide)
        expect(runtime.getCubeOpacity('distant')).toBe(0.25)

        runtime.setCubeOpacity('distant', 0)
        expect(distantCube.visible).toBe(false)
        expect(runtime.getCubeOpacity('distant')).toBe(0)

        runtime.removeCube('distant')
        expect(runtime.hasCube('distant')).toBe(false)

        const grid = runtime.grid
        const mainCube = runtime.mainCube
        runtime.dispose()
        expect(scene.children).not.toContain(grid)
        expect(scene.children).not.toContain(mainCube)
    })
})
