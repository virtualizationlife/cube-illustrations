import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { GridVisibility } from '@runtime/grid/gridFade'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>

export type GridLines = {
    readonly object: Object3D
    /** Slides the repeating grid; both the transform and the fade follow this offset. */
    readonly setOffset: (columnOffset: number, rowOffset: number) => void
    readonly setOpacity: (opacity: number) => void
    /** Changes the shape and dimensions of the visible grid area. */
    readonly setVisibility: (visibility: GridVisibility) => void
    /** @deprecated Use setVisibility with a radial shape. Radii are in world units. */
    readonly setFadeRadii: (innerRadius: number, outerRadius: number) => void
    readonly dispose: () => void
}

export type CreateGridLinesOptions = {
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly color: number
    readonly opacity: number
    readonly visibility: GridVisibility
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
    visibility,
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
    const radialInnerUniform = uniform(0)
    // Zero disables the radial fade: `progress` collapses to 0 and the term evaluates to 1,
    // which is what the CPU version returned when the outer radius did not exceed the inner.
    const radialFadeInvRangeUniform = uniform(0)
    const visibilityShapeUniform = uniform(0)
    const roundedWidthUniform = uniform(0)
    const roundedHeightUniform = uniform(0)
    const roundedCornerRadiusUniform = uniform(0)
    const roundedFadeInvRangeUniform = uniform(0)

    const setVisibility = (nextVisibility: GridVisibility): void => {
        visibilityShapeUniform.value = nextVisibility.shape === 'radial' ? 0 : 1
        if (nextVisibility.shape === 'radial') {
            radialInnerUniform.value = Math.max(0, nextVisibility.innerRadiusCells) * gridCellSize
            radialFadeInvRangeUniform.value =
                nextVisibility.outerRadiusCells > nextVisibility.innerRadiusCells
                    ? 1 /
                      ((nextVisibility.outerRadiusCells - nextVisibility.innerRadiusCells) *
                          gridCellSize)
                    : 0
            return
        }

        roundedWidthUniform.value = Math.max(0, nextVisibility.widthCells) * gridCellSize
        roundedHeightUniform.value = Math.max(0, nextVisibility.heightCells) * gridCellSize
        roundedCornerRadiusUniform.value =
            Math.max(
                0,
                Math.min(
                    nextVisibility.cornerRadiusCells,
                    nextVisibility.widthCells / 2,
                    nextVisibility.heightCells / 2
                )
            ) * gridCellSize
        roundedFadeInvRangeUniform.value =
            nextVisibility.fadeCells > 0 ? 1 / (nextVisibility.fadeCells * gridCellSize) : 0
    }
    setVisibility(visibility)

    const planePosition = vec2(positionLocal.x, positionLocal.z).add(offsetUniform)
    const edgeLimit = float(halfGridSize + gridCellSize)
    const edgeFadeX = edgeLimit.sub(planePosition.x.abs()).div(gridCellSize).clamp(0, 1)
    const edgeFadeZ = edgeLimit.sub(planePosition.y.abs()).div(gridCellSize).clamp(0, 1)
    const fadeProgress = planePosition
        .length()
        .sub(radialInnerUniform)
        .mul(radialFadeInvRangeUniform)
        .clamp(0, 1)
    // The same smoothstep polynomial the CPU fade used: p * p * (3 - 2 * p), inverted.
    const radialFade = fadeProgress
        .mul(fadeProgress)
        .mul(float(3).sub(fadeProgress.mul(2)))
        .oneMinus()
    const halfRoundedWidth = roundedWidthUniform.mul(0.5)
    const halfRoundedHeight = roundedHeightUniform.mul(0.5)
    const roundedCornerX = halfRoundedWidth.sub(roundedCornerRadiusUniform)
    const roundedCornerY = halfRoundedHeight.sub(roundedCornerRadiusUniform)
    const roundedDeltaX = planePosition.x.abs().sub(roundedCornerX).max(0)
    const roundedDeltaY = planePosition.y.abs().sub(roundedCornerY).max(0)
    const roundedDistance = roundedDeltaX
        .mul(roundedDeltaX)
        .add(roundedDeltaY.mul(roundedDeltaY))
        .sqrt()
        .sub(roundedCornerRadiusUniform)
    const roundedProgress = roundedDistance.mul(roundedFadeInvRangeUniform).clamp(0, 1)
    const roundedFade = roundedProgress
        .mul(roundedProgress)
        .mul(float(3).sub(roundedProgress.mul(2)))
        .oneMinus()
    const visibilityFade = visibilityShapeUniform.mix(radialFade, roundedFade)

    const material = new THREE.LineBasicNodeMaterial({
        color,
        transparent: true,
        depthWrite: false,
    })
    material.opacityNode = edgeFadeX.mul(edgeFadeZ).mul(visibilityFade).mul(opacityUniform)

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
        setVisibility,
        setFadeRadii: (innerRadius, outerRadius) => {
            setVisibility({
                shape: 'radial',
                innerRadiusCells: innerRadius / gridCellSize,
                outerRadiusCells: outerRadius / gridCellSize,
            })
        },
        dispose: () => {
            geometry.dispose()
            material.dispose()
        },
    }
}
