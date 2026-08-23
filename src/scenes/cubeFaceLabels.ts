import type * as ThreeWebGpuNamespace from 'three/webgpu'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type MeshBasicMaterial = InstanceType<typeof ThreeWebGpuNamespace.MeshBasicMaterial>
type Texture = InstanceType<typeof ThreeWebGpuNamespace.Texture>

export const GRID_CUBE_FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const

export type GridCubeFace = (typeof GRID_CUBE_FACES)[number]
export type GridCubeFaceLabels = Partial<Record<GridCubeFace, string>>
export type GridCubeFaceLabelInput = string | GridCubeFaceLabels

export interface CubeFaceLabelsProps {
    /** One label for every face, or individual labels. Each label is limited to 3 symbols. */
    readonly faceLabels?: GridCubeFaceLabelInput
    /** Cube corner radius in world units. Defaults to 5% of the cube edge. */
    readonly cubeCornerRadius?: number
}

export interface CubeFaceLabelAssets {
    readonly object: Object3D
    readonly materials: readonly MeshBasicMaterial[]
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

const createLabelTexture = (
    THREE: typeof ThreeWebGpuNamespace,
    text: string
): Texture => {
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_SIZE
    canvas.height = TEXTURE_SIZE
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('Canvas 2D is required for cube face labels')

    context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    context.fillStyle = '#555b66'
    context.font = '600 92px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, TEXTURE_SIZE * 0.82)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
}

export const createCubeFaceLabels = ({
    THREE,
    size,
    labels,
    opacity,
}: CreateCubeFaceLabelsOptions): CubeFaceLabelAssets => {
    const resolvedLabels = resolveCubeFaceLabels(labels)
    const object = new THREE.Group()
    const geometry = new THREE.PlaneGeometry(size * LABEL_SIZE_RATIO, size * LABEL_SIZE_RATIO)
    const materials: MeshBasicMaterial[] = []
    const textures: Texture[] = []
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

    for (const face of GRID_CUBE_FACES) {
        const text = resolvedLabels[face]
        if (text.length === 0) continue

        const texture = createLabelTexture(THREE, text)
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
        const label = new THREE.Mesh(geometry, material)
        const transform = transforms[face]
        label.position.set(...transform.position)
        label.rotation.set(...transform.rotation)
        label.renderOrder = 2
        object.add(label)
        materials.push(material)
        textures.push(texture)
    }

    return {
        object,
        materials,
        dispose: () => {
            geometry.dispose()
            for (const material of materials) material.dispose()
            for (const texture of textures) texture.dispose()
        },
    }
}
