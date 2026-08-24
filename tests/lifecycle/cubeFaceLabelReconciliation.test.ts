import * as THREE from 'three/webgpu'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createGridSceneRuntime, MAIN_CUBE_ID } from '@runtime/grid/gridSceneRuntime'

/**
 * Label textures are painted on a 2D canvas, which node has no notion of. The stub gives
 * `createCubeFaceLabels` just enough of one to build its assets.
 */
const installCanvasStub = (): (() => void) => {
    const previousDocument = (globalThis as { document?: unknown }).document
    const context = {
        clearRect: () => undefined,
        fillText: () => undefined,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
    }
    ;(globalThis as { document?: unknown }).document = {
        createElement: () => ({
            width: 0,
            height: 0,
            getContext: () => context,
        }),
    }
    return () => {
        ;(globalThis as { document?: unknown }).document = previousDocument
    }
}

let restoreCanvas: () => void

beforeAll(() => {
    restoreCanvas = installCanvasStub()
})

afterAll(() => {
    restoreCanvas()
})

const createRuntime = () =>
    createGridSceneRuntime({
        scene: new THREE.Scene(),
        THREE,
        gridCellSize: 0.1,
        gridCellCount: 5,
        mainCubeSize: 0.1,
        mainCubeHoverCells: 0,
    })

/** Body and edges; a labelled cube carries a third child holding the label meshes. */
const UNLABELLED_CHILD_COUNT = 2

describe('face label reconciliation', () => {
    it('creates label assets for a cube that was built without them', () => {
        const runtime = createRuntime()
        expect(runtime.mainCube.children).toHaveLength(UNLABELLED_CHILD_COUNT)

        runtime.setCubeFaceLabels(MAIN_CUBE_ID, 'AB')

        expect(runtime.mainCube.children).toHaveLength(UNLABELLED_CHILD_COUNT + 1)
    })

    it('updates labels in place instead of stacking new assets', () => {
        const runtime = createRuntime()
        runtime.setCubeFaceLabels(MAIN_CUBE_ID, 'AB')
        const [, , labelObject] = runtime.mainCube.children

        runtime.setCubeFaceLabels(MAIN_CUBE_ID, 'CD')

        expect(runtime.mainCube.children).toHaveLength(UNLABELLED_CHILD_COUNT + 1)
        expect(runtime.mainCube.children[2]).toBe(labelObject)
    })

    it('removes label assets when the labels go away', () => {
        const runtime = createRuntime()
        runtime.setCubeFaceLabels(MAIN_CUBE_ID, 'AB')

        runtime.setCubeFaceLabels(MAIN_CUBE_ID, undefined)

        expect(runtime.mainCube.children).toHaveLength(UNLABELLED_CHILD_COUNT)
    })

    it('does nothing when labels are removed from a cube that never had them', () => {
        const runtime = createRuntime()

        runtime.setCubeFaceLabels(MAIN_CUBE_ID, undefined)

        expect(runtime.mainCube.children).toHaveLength(UNLABELLED_CHILD_COUNT)
    })

    it("gives newly created labels the cube's current opacity", () => {
        const runtime = createRuntime()
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0.4)

        runtime.setCubeFaceLabels(MAIN_CUBE_ID, 'AB')

        const labelObject = runtime.mainCube.children[2]
        if (labelObject === undefined) throw new Error('Label assets were not created')
        const labelMesh = labelObject.children[0]
        if (!(labelMesh instanceof THREE.Mesh)) throw new Error('Label mesh is missing')
        const material = labelMesh.material
        if (Array.isArray(material)) throw new Error('Unexpected material array')
        expect(material.opacity).toBeCloseTo(0.4)
    })

    it('applies labels to a cube added later, too', () => {
        const runtime = createRuntime()
        const cube = runtime.addCube({ id: 'later', position: { column: 1, row: 0 } })
        expect(cube.children).toHaveLength(UNLABELLED_CHILD_COUNT)

        runtime.setCubeFaceLabels('later', 'XY')

        expect(cube.children).toHaveLength(UNLABELLED_CHILD_COUNT + 1)
    })
})
