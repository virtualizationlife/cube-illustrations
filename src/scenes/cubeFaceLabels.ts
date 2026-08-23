import type * as ThreeWebGpuNamespace from 'three/webgpu'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type Mesh = InstanceType<typeof ThreeWebGpuNamespace.Mesh>
type MeshBasicMaterial = InstanceType<typeof ThreeWebGpuNamespace.MeshBasicMaterial>
type Texture = InstanceType<typeof ThreeWebGpuNamespace.Texture>

export const GRID_CUBE_FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const

export type GridCubeFace = (typeof GRID_CUBE_FACES)[number]
export type GridCubeFaceLabels = Partial<Record<GridCubeFace, string>>
export type GridCubeFaceLabelInput = string | GridCubeFaceLabels

export interface CubeFaceLabelsProps {
    /** One label for every face, or individual labels. Each label is limited to 3 symbols. */
    readonly faceLabels?: GridCubeFaceLabelInput
    /** Cube corner radius in world units. Defaults to 3% of the cube edge. */
    readonly cubeCornerRadius?: number
}

export interface CubeFaceLabelAssets {
    readonly object: Object3D
    /** Live view of the materials currently in use; one per distinct label text. */
    readonly materials: readonly MeshBasicMaterial[]
    readonly setLabels: (labels: GridCubeFaceLabelInput) => void
    readonly setOpacity: (opacity: number) => void
    readonly dispose: () => void
}

interface CreateCubeFaceLabelsOptions {
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly size: number
    readonly labels: GridCubeFaceLabelInput
    readonly opacity: number
}

const TEXTURE_SIZE = 256
const LABEL_SIZE_RATIO = 0.72
const FACE_OFFSET_RATIO = 0.006

export const normalizeCubeFaceLabel = (label: string): string =>
    Array.from(label.trim()).slice(0, 3).join('')

export const resolveCubeFaceLabels = (
    labels: GridCubeFaceLabelInput
): Readonly<Record<GridCubeFace, string>> => {
    const getLabel = (face: GridCubeFace): string =>
        normalizeCubeFaceLabel(typeof labels === 'string' ? labels : (labels[face] ?? ''))

    return {
        front: getLabel('front'),
        back: getLabel('back'),
        left: getLabel('left'),
        right: getLabel('right'),
        top: getLabel('top'),
        bottom: getLabel('bottom'),
    }
}

const drawLabel = (canvas: HTMLCanvasElement, text: string): void => {
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('Canvas 2D is required for cube face labels')

    context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    context.fillStyle = '#555b66'
    context.font = '600 92px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, TEXTURE_SIZE * 0.82)
}

interface LabelSurface {
    readonly canvas: HTMLCanvasElement
    readonly texture: Texture
    readonly material: MeshBasicMaterial
}

/**
 * Text drawn on cube faces.
 *
 * Two things are deliberately avoided here. Faces whose label is empty get no texture, no
 * material and no mesh at all — `resolveCubeFaceLabels` fills unspecified faces with `''`,
 * so building all six unconditionally meant a 256×256 texture and a draw call per blank
 * face. And faces that share the same text share one surface, so the common
 * `faceLabels: 'ABC'` case allocates one texture instead of six.
 */
export const createCubeFaceLabels = ({
    THREE,
    size,
    labels,
    opacity,
}: CreateCubeFaceLabelsOptions): CubeFaceLabelAssets => {
    const object = new THREE.Group()
    const geometry = new THREE.PlaneGeometry(size * LABEL_SIZE_RATIO, size * LABEL_SIZE_RATIO)
    const materials: MeshBasicMaterial[] = []
    const surfaces = new Map<string, LabelSurface>()
    const meshes = new Map<GridCubeFace, Mesh>()
    let currentOpacity = opacity

    const offset = size / 2 + size * FACE_OFFSET_RATIO
    const transforms: Readonly<
        Record<
            GridCubeFace,
            {
                readonly position: readonly [number, number, number]
                readonly rotation: readonly [number, number, number]
            }
        >
    > = {
        front: { position: [0, 0, offset], rotation: [0, 0, 0] },
        back: { position: [0, 0, -offset], rotation: [0, Math.PI, 0] },
        left: { position: [-offset, 0, 0], rotation: [0, -Math.PI / 2, 0] },
        right: { position: [offset, 0, 0], rotation: [0, Math.PI / 2, 0] },
        top: { position: [0, offset, 0], rotation: [-Math.PI / 2, 0, 0] },
        bottom: { position: [0, -offset, 0], rotation: [Math.PI / 2, 0, 0] },
    }

    const createSurface = (text: string): LabelSurface => {
        const canvas = document.createElement('canvas')
        canvas.width = TEXTURE_SIZE
        canvas.height = TEXTURE_SIZE
        drawLabel(canvas, text)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: currentOpacity,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
        return { canvas, texture, material }
    }

    const disposeSurface = (surface: LabelSurface): void => {
        surface.material.dispose()
        surface.texture.dispose()
    }

    const getMesh = (face: GridCubeFace): Mesh => {
        const existing = meshes.get(face)
        if (existing !== undefined) return existing

        const mesh = new THREE.Mesh(geometry)
        const transform = transforms[face]
        mesh.position.set(...transform.position)
        mesh.rotation.set(...transform.rotation)
        mesh.renderOrder = 2
        meshes.set(face, mesh)
        return mesh
    }

    const applyLabels = (input: GridCubeFaceLabelInput): void => {
        const resolved = resolveCubeFaceLabels(input)
        const wantedTexts = new Set(GRID_CUBE_FACES.map((face) => resolved[face]))
        wantedTexts.delete('')

        // Surfaces whose text is gone become a pool: repainting one is far cheaper than
        // destroying a texture and uploading a new one mid-animation.
        const reusable: LabelSurface[] = []
        for (const [text, surface] of [...surfaces]) {
            if (wantedTexts.has(text)) continue
            surfaces.delete(text)
            reusable.push(surface)
        }

        for (const text of wantedTexts) {
            if (surfaces.has(text)) continue
            const recycled = reusable.pop()
            if (recycled === undefined) {
                surfaces.set(text, createSurface(text))
                continue
            }
            drawLabel(recycled.canvas, text)
            recycled.texture.needsUpdate = true
            surfaces.set(text, recycled)
        }
        for (const surface of reusable) disposeSurface(surface)

        for (const face of GRID_CUBE_FACES) {
            const text = resolved[face]
            const mesh = meshes.get(face)
            if (text === '') {
                if (mesh !== undefined) object.remove(mesh)
                continue
            }
            const surface = surfaces.get(text)
            if (surface === undefined) continue
            const faceMesh = getMesh(face)
            faceMesh.material = surface.material
            if (faceMesh.parent !== object) object.add(faceMesh)
        }

        materials.length = 0
        for (const surface of surfaces.values()) materials.push(surface.material)
    }

    applyLabels(labels)

    return {
        object,
        materials,
        setLabels: applyLabels,
        setOpacity: (nextOpacity) => {
            currentOpacity = nextOpacity
            for (const surface of surfaces.values()) surface.material.opacity = nextOpacity
        },
        dispose: () => {
            geometry.dispose()
            for (const surface of surfaces.values()) disposeSurface(surface)
            surfaces.clear()
            meshes.clear()
        },
    }
}
