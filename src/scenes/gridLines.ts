import type * as ThreeWebGpuNamespace from 'three/webgpu'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>

export interface GridLines {
    readonly object: Object3D
    /** Slides the repeating grid; both the transform and the fade follow this offset. */
    readonly setOffset: (columnOffset: number, rowOffset: number) => void
    readonly setOpacity: (opacity: number) => void
    /** Radii are in world units, matching the CPU implementation this replaced. */
    readonly setFadeRadii: (innerRadius: number, outerRadius: number) => void
    readonly dispose: () => void
}

export interface CreateGridLinesOptions {
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly color: number
    readonly opacity: number
    readonly fadeInnerRadius: number
    readonly fadeOuterRadius: number
}

/**
 * The repeating floor grid, as a single `LineSegments` whose fade is evaluated in the shader.
 *
 * The previous implementation built `2 * (gridCellCount + 3)` separate line objects, chopped
 * each into six segments per cell, and every frame recomputed a vertex alpha for all of them
 * on the CPU before re-uploading the whole colour attribute. That is one draw call and one
 * full buffer upload per line per frame.
 *
 * Both fade terms are pure functions of a point's position on the floor plane, so they move
 * into the material: one draw call, a static vertex buffer, and two uniform writes per frame.
 * Evaluating per fragment also drops the reason the lines were subdivided — the subdivision
 * existed only so linear interpolation between vertices could approximate the curve — so each
 * line is now a single segment.
 */
export const createGridLines = ({
    THREE,
    gridCellSize,
    gridCellCount,
    color,
    opacity,
    fadeInnerRadius,
    fadeOuterRadius,
}: CreateGridLinesOptions): GridLines => {
    const { uniform, positionLocal, vec2, float } = THREE.TSL

    const halfGridSize = (gridCellSize * gridCellCount) / 2
    const lineStart = -halfGridSize - gridCellSize
    const lineEnd = lineStart + (gridCellCount + 2) * gridCellSize

    const positions: number[] = []
    // One extra line on either side cross-fades when the repeating grid moves a cell.
    for (let index = -1; index <= gridCellCount + 1; index += 1) {
        const basePosition = (-gridCellCount / 2 + index) * gridCellSize
        positions.push(basePosition, 0, lineStart, basePosition, 0, lineEnd)
        positions.push(lineStart, 0, basePosition, lineEnd, 0, basePosition)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))

    const offsetUniform = uniform(new THREE.Vector2(0, 0))
    const opacityUniform = uniform(opacity)
    const fadeInnerUniform = uniform(fadeInnerRadius)
    // Zero disables the radial fade: `progress` collapses to 0 and the term evaluates to 1,
    // which is what the CPU version returned when the outer radius did not exceed the inner.
    const fadeInvRangeUniform = uniform(
        fadeOuterRadius > fadeInnerRadius ? 1 / (fadeOuterRadius - fadeInnerRadius) : 0
    )

    const planePosition = vec2(positionLocal.x, positionLocal.z).add(offsetUniform)
    const edgeLimit = float(halfGridSize + gridCellSize)
    const edgeFadeX = edgeLimit.sub(planePosition.x.abs()).div(gridCellSize).clamp(0, 1)
    const edgeFadeZ = edgeLimit.sub(planePosition.y.abs()).div(gridCellSize).clamp(0, 1)
    const fadeProgress = planePosition
        .length()
        .sub(fadeInnerUniform)
        .mul(fadeInvRangeUniform)
        .clamp(0, 1)
    // The same smoothstep polynomial the CPU fade used: p * p * (3 - 2 * p), inverted.
    const radialFade = fadeProgress
        .mul(fadeProgress)
        .mul(float(3).sub(fadeProgress.mul(2)))
        .oneMinus()

    const material = new THREE.LineBasicNodeMaterial({
        color,
        transparent: true,
        depthWrite: false,
    })
    material.opacityNode = edgeFadeX.mul(edgeFadeZ).mul(radialFade).mul(opacityUniform)

    const object = new THREE.LineSegments(geometry, material)
    object.renderOrder = 0

    return {
        object,
        setOffset: (columnOffset, rowOffset) => {
            object.position.set(columnOffset, 0, rowOffset)
            offsetUniform.value.set(columnOffset, rowOffset)
        },
        setOpacity: (nextOpacity) => {
            opacityUniform.value = nextOpacity
        },
        setFadeRadii: (innerRadius, outerRadius) => {
            fadeInnerUniform.value = innerRadius
            fadeInvRangeUniform.value =
                outerRadius > innerRadius ? 1 / (outerRadius - innerRadius) : 0
        },
        dispose: () => {
            geometry.dispose()
            material.dispose()
        },
    }
}
