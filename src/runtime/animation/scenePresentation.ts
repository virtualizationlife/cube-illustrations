import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { GridSceneRuntime } from '@runtime/grid/gridSceneRuntime'

type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

export type ScenePresentationValues = {
    readonly zoom: number
    readonly gridOpacity: number
    readonly gridFadeInnerRadiusCells: number
    readonly gridFadeOuterRadiusCells: number
}

export type ScenePresentationController = {
    readonly setTarget: (values: Partial<ScenePresentationValues>) => void
    readonly update: (delta: number, camera: PerspectiveCamera, runtime: GridSceneRuntime) => void
}

const smoothTowards = (
    current: number,
    target: number,
    delta: number,
    responseDuration: number
): number => {
    const progress = 1 - Math.exp(-delta / Math.max(0.0001, responseDuration))
    return current + (target - current) * progress
}

/** Smooth semantic zoom and grid visibility changes shared by narrative scenes. */
export const createScenePresentation = (
    initialValues: ScenePresentationValues,
    responseDuration = 0.32
): ScenePresentationController => {
    const current = { ...initialValues }
    const target = { ...initialValues }

    return {
        setTarget: (values) => {
            Object.assign(target, values)
        },
        update: (delta, camera, runtime) => {
            current.zoom = smoothTowards(current.zoom, target.zoom, delta, responseDuration)
            current.gridOpacity = smoothTowards(
                current.gridOpacity,
                target.gridOpacity,
                delta,
                responseDuration
            )
            current.gridFadeInnerRadiusCells = smoothTowards(
                current.gridFadeInnerRadiusCells,
                target.gridFadeInnerRadiusCells,
                delta,
                responseDuration
            )
            current.gridFadeOuterRadiusCells = smoothTowards(
                current.gridFadeOuterRadiusCells,
                target.gridFadeOuterRadiusCells,
                delta,
                responseDuration
            )

            camera.zoom = current.zoom
            camera.updateProjectionMatrix()
            runtime.setGridOpacity(current.gridOpacity)
            runtime.setGridFadeRadii(
                current.gridFadeInnerRadiusCells,
                current.gridFadeOuterRadiusCells
            )
        },
    }
}
