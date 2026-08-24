import { useCallback, useRef, useState, type ComponentType, type JSX } from 'react'

import {
    createScenePresentation,
    type ScenePresentationController,
    type ScenePresentationValues,
} from '@runtime/animation/scenePresentation'
import {
    runSceneScript,
    type SceneScriptContext,
    type SceneScriptHandle,
} from '@runtime/core/runSceneScript'
import {
    createSceneRandom,
    type SceneRandom,
    type SceneRandomSeed,
} from '@runtime/core/sceneRandom'
import {
    useSimpleCubeScene,
    type IllustrationSceneSizeProps,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '@runtime/core/useSimpleCubeScene'
import type { CubeFaceLabelsProps } from '@runtime/grid/cubeFaceLabels'
import type { GridSceneCubeEntry } from '@runtime/grid/gridSceneRuntime'
import { CubeSceneViewport } from '@runtime/rendering/CubeSceneViewport'

import { createSceneChoreography, type SceneCubeActors, type SceneTimeline } from './choreography'

export const SCENE_CATEGORIES = [
    'structure',
    'movement',
    'flow',
    'mind',
    'continuity',
    'interaction',
    'cycles',
    'world',
] as const

export type SceneCategory = (typeof SCENE_CATEGORIES)[number]

export type SceneLayout = 'standard' | 'panoramic'

export type SceneMetadata = {
    readonly id: string
    readonly title: string
    /** The canonical gallery folder for this scene. */
    readonly primaryCategory: SceneCategory
    readonly tags: readonly string[]
    readonly description?: string
    /** The card proportions used when this scene appears in the gallery. */
    readonly layout?: SceneLayout
    /** False keeps a scene out of the gallery's combined "all" view. Defaults to true. */
    readonly includeInAll?: boolean
    /** False hides the title and tags below this scene's viewport. Defaults to true. */
    readonly showCaption?: boolean
}

export type CubeSceneProps = {
    /** Replays SDK-authored random choices deterministically when provided. */
    readonly seed?: SceneRandomSeed
} & CubeFaceLabelsProps

export type CubeSceneView = {
    readonly enableCubeHover?: boolean
} & Omit<IllustrationSceneSizeProps, 'cubeCornerRadius' | 'mainCubeFaceLabels'>

/** Initial semantic zoom and grid visibility, smoothed towards new targets each frame. */
export type ScenePresentationOptions = {
    /** Seconds the smoothing takes to close most of the gap. Defaults to 0.32. */
    readonly responseDuration?: number
} & ScenePresentationValues

export type DefinedSceneSetupContext<Props> = {
    readonly props: Readonly<Props>
    readonly random: SceneRandom
    /** Present only when the definition declares `presentation`. */
    readonly presentation: ScenePresentationController | null
} & SimpleCubeSetupContext

export type DefinedSceneScriptContext<Props, State> = {
    readonly props: Readonly<Props>
    readonly state: State
    readonly cubes: SceneCubeActors
    readonly timeline: SceneTimeline
    readonly random: SceneRandom
    /** Present only when the definition declares `presentation`. */
    readonly presentation: ScenePresentationController | null
} & SceneScriptContext

export type DefinedSceneFrameContext<Props, State> = {
    readonly props: Readonly<Props>
    readonly state: State
    readonly random: SceneRandom
    /** Present only when the definition declares `presentation`. */
    readonly presentation: ScenePresentationController | null
} & SimpleCubeFrameContext

export type DefinedSceneHoverContext<Props, State> = {
    /** The cube under the pointer, or null when the pointer left every cube. */
    readonly cube: GridSceneCubeEntry | null
    readonly props: Readonly<Props>
    readonly state: State
}

export type DefineSceneOptions<Props extends CubeSceneProps, State = undefined> = {
    readonly metadata: SceneMetadata
    readonly view: CubeSceneView
    /**
     * Declaring this creates a presentation controller for the scene, updates it before
     * every frame, and exposes it to setup, script and frame callbacks.
     */
    readonly presentation?: ScenePresentationOptions
    readonly setup?: (context: DefinedSceneSetupContext<Props>) => State
    readonly script?: (context: DefinedSceneScriptContext<Props, State>) => Promise<void>
    readonly onFrame?: (context: DefinedSceneFrameContext<Props, State>) => void
    /** Requires `view.enableCubeHover`, which is on by default. */
    readonly onCubeHoverChange?: (context: DefinedSceneHoverContext<Props, State>) => void
    readonly teardown?: (context: DefinedSceneSetupContext<Props>, state: State) => void
    /** Changes to this value recreate the scene instance. */
    readonly restartKey?: (props: Readonly<Props>) => unknown
}

export type DefinedSceneComponent<Props> = ComponentType<Props> & {
    readonly scene: SceneMetadata
}

/**
 * Attaches catalog metadata to a scene component that `defineScene` did not build — a thin
 * wrapper over another scene, for instance — so every catalog entry carries its own
 * metadata regardless of how the component is implemented.
 */
export const attachSceneMetadata = <Props,>(
    component: ComponentType<Props>,
    metadata: SceneMetadata
): DefinedSceneComponent<Props> => Object.assign(component, { scene: metadata })

/**
 * Creates a ready-to-render scene component while keeping renderer, lifecycle, script
 * cancellation, and viewport plumbing out of scene implementations.
 */
export const defineScene = <Props extends CubeSceneProps = CubeSceneProps, State = undefined>(
    definition: DefineSceneOptions<Props, State>
): DefinedSceneComponent<Props> => {
    const SceneComponent = (props: Props): JSX.Element => {
        const propsRef = useRef<Readonly<Props>>(props)
        const stateRef = useRef<State | null>(null)
        const hasSetupRef = useRef(false)
        const scriptRef = useRef<SceneScriptHandle | null>(null)
        const randomRef = useRef<SceneRandom>(createSceneRandom(props.seed))
        const presentationRef = useRef<ScenePresentationController | null>(null)
        propsRef.current = props

        const restartKey = definition.restartKey?.(props)
        // `restartKey` is documented as an arbitrary value, so it is compared by identity
        // rather than serialised: `{ revision: 1 }` and `{ revision: 2 }` both stringify to
        // the same thing. The generation counter turns those comparisons into one stable key.
        const [restartState, setRestartState] = useState({
            seed: props.seed,
            key: restartKey,
            generation: 0,
        })
        if (!Object.is(restartState.seed, props.seed) || !Object.is(restartState.key, restartKey)) {
            setRestartState({
                seed: props.seed,
                key: restartKey,
                generation: restartState.generation + 1,
            })
        }
        const onSetup = useCallback(
            (context: SimpleCubeSetupContext): (() => void) => {
                const random = createSceneRandom(propsRef.current.seed)
                randomRef.current = random
                const presentation =
                    definition.presentation === undefined
                        ? null
                        : createScenePresentation(
                              definition.presentation,
                              definition.presentation.responseDuration
                          )
                presentationRef.current = presentation
                const setupContext: DefinedSceneSetupContext<Props> = {
                    ...context,
                    props: propsRef.current,
                    random,
                    presentation,
                }
                const state = definition.setup?.(setupContext) as State
                stateRef.current = state
                hasSetupRef.current = true

                if (definition.script !== undefined) {
                    scriptRef.current = runSceneScript(
                        definition.metadata.title,
                        context.runtime,
                        (scriptContext) => {
                            const choreography = createSceneChoreography(
                                scriptContext.runtime,
                                scriptContext.delay
                            )
                            return (
                                definition.script?.({
                                    ...scriptContext,
                                    ...choreography,
                                    props: propsRef.current,
                                    state,
                                    random,
                                    presentation,
                                }) ?? Promise.resolve()
                            )
                        }
                    )
                }

                return () => {
                    scriptRef.current?.dispose()
                    scriptRef.current = null
                    definition.teardown?.(setupContext, state)
                    presentationRef.current = null
                    hasSetupRef.current = false
                    stateRef.current = null
                }
            },
            // `restartKey` is the explicit escape hatch for custom scene props. Face labels
            // are applied in place by the renderer and deliberately do not restart a scene.
            // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
            [props.seed, restartKey]
        )

        const onFrame = useCallback((context: SimpleCubeFrameContext): void => {
            if (!hasSetupRef.current) return
            const presentation = presentationRef.current
            presentation?.update(context.delta, context.camera, context.runtime)
            if (definition.onFrame === undefined) return
            definition.onFrame({
                ...context,
                props: propsRef.current,
                state: stateRef.current as State,
                random: randomRef.current,
                presentation,
            })
        }, [])

        const onCubeHoverChange = useCallback((cube: GridSceneCubeEntry | null): void => {
            if (!hasSetupRef.current || definition.onCubeHoverChange === undefined) return
            definition.onCubeHoverChange({
                cube,
                props: propsRef.current,
                state: stateRef.current as State,
            })
        }, [])

        const { faceLabels, cubeCornerRadius } = props
        const { enableCubeHover = true, ...view } = definition.view
        const { canvasRef, status } = useSimpleCubeScene({
            ...view,
            cubeCornerRadius,
            mainCubeFaceLabels: faceLabels,
            lifecycleKey: restartState.generation,
            enableCubeHover,
            onCubeHoverChange,
            onSetup,
            onFrame,
        })

        return (
            <CubeSceneViewport
                canvasRef={canvasRef}
                status={status}
                variant={definition.metadata.layout ?? 'standard'}
            />
        )
    }

    Object.defineProperty(SceneComponent, 'name', {
        value: `${definition.metadata.id.replace(/(^|-)(\w)/g, (_match, _dash, letter: string) => letter.toUpperCase())}Scene`,
    })

    return Object.assign(SceneComponent, { scene: definition.metadata })
}
