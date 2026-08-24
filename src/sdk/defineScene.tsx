import {
    useCallback,
    useRef,
    type ComponentType,
    type JSX,
} from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import {
    runSceneScript,
    type SceneScriptContext,
    type SceneScriptHandle,
} from '../scenes/runSceneScript'
import {
    createSceneRandom,
    type SceneRandom,
    type SceneRandomSeed,
} from '../scenes/sceneRandom'
import {
    useSimpleCubeScene,
    type IllustrationSceneSizeProps,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'
import {
    createSceneChoreography,
    type SceneCubeActors,
    type SceneTimeline,
} from './choreography'

export interface SceneMetadata {
    readonly id: string
    readonly title: string
    readonly tags: readonly string[]
    readonly description?: string
}

export interface CubeSceneProps extends CubeFaceLabelsProps {
    /** Replays SDK-authored random choices deterministically when provided. */
    readonly seed?: SceneRandomSeed
}

export interface CubeSceneView
    extends Omit<
        IllustrationSceneSizeProps,
        'cubeCornerRadius' | 'mainCubeFaceLabels'
    > {
    readonly enableCubeHover?: boolean
}

export interface DefinedSceneSetupContext<Props> extends SimpleCubeSetupContext {
    readonly props: Readonly<Props>
    readonly random: SceneRandom
}

export interface DefinedSceneScriptContext<Props, State>
    extends SceneScriptContext {
    readonly props: Readonly<Props>
    readonly state: State
    readonly cubes: SceneCubeActors
    readonly timeline: SceneTimeline
    readonly random: SceneRandom
}

export interface DefinedSceneFrameContext<Props, State>
    extends SimpleCubeFrameContext {
    readonly props: Readonly<Props>
    readonly state: State
    readonly random: SceneRandom
}

export interface DefineSceneOptions<
    Props extends CubeSceneProps,
    State = undefined,
> {
    readonly metadata: SceneMetadata
    readonly view: CubeSceneView
    readonly setup?: (context: DefinedSceneSetupContext<Props>) => State
    readonly script?: (
        context: DefinedSceneScriptContext<Props, State>
    ) => Promise<void>
    readonly onFrame?: (context: DefinedSceneFrameContext<Props, State>) => void
    readonly teardown?: (
        context: DefinedSceneSetupContext<Props>,
        state: State
    ) => void
    /** Changes to this value recreate the scene instance. */
    readonly restartKey?: (props: Readonly<Props>) => unknown
}

export type DefinedSceneComponent<Props extends CubeSceneProps> =
    ComponentType<Props> & {
        readonly scene: SceneMetadata
    }

/**
 * Creates a ready-to-render scene component while keeping renderer, lifecycle, script
 * cancellation, and viewport plumbing out of scene implementations.
 */
export const defineScene = <
    Props extends CubeSceneProps = CubeSceneProps,
    State = undefined,
>(
    definition: DefineSceneOptions<Props, State>
): DefinedSceneComponent<Props> => {
    const SceneComponent = (props: Props): JSX.Element => {
        const propsRef = useRef<Readonly<Props>>(props)
        const stateRef = useRef<State | null>(null)
        const hasSetupRef = useRef(false)
        const scriptRef = useRef<SceneScriptHandle | null>(null)
        const randomRef = useRef<SceneRandom>(createSceneRandom(props.seed))
        propsRef.current = props

        const restartKey = definition.restartKey?.(props)
        const onSetup = useCallback(
            (context: SimpleCubeSetupContext): (() => void) => {
                const random = createSceneRandom(propsRef.current.seed)
                randomRef.current = random
                const setupContext: DefinedSceneSetupContext<Props> = {
                    ...context,
                    props: propsRef.current,
                    random,
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
                            return definition.script?.({
                                ...scriptContext,
                                ...choreography,
                                props: propsRef.current,
                                state,
                                random,
                            }) ?? Promise.resolve()
                        }
                    )
                }

                return () => {
                    scriptRef.current?.dispose()
                    scriptRef.current = null
                    definition.teardown?.(setupContext, state)
                    hasSetupRef.current = false
                    stateRef.current = null
                }
            },
            // `restartKey` is the explicit escape hatch for custom scene props. Face labels
            // already restart legacy scenes and remain part of the standard contract.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [props.faceLabels, props.seed, restartKey]
        )

        const onFrame = useCallback((context: SimpleCubeFrameContext): void => {
            if (!hasSetupRef.current || definition.onFrame === undefined) return
            definition.onFrame({
                ...context,
                props: propsRef.current,
                state: stateRef.current as State,
                random: randomRef.current,
            })
        }, [])

        const { faceLabels, cubeCornerRadius } = props
        const { enableCubeHover = true, ...view } = definition.view
        const { canvasRef, status } = useSimpleCubeScene({
            ...view,
            cubeCornerRadius,
            mainCubeFaceLabels: faceLabels,
            enableCubeHover,
            onSetup,
            onFrame,
        })

        return <CubeSceneViewport canvasRef={canvasRef} status={status} />
    }

    Object.defineProperty(SceneComponent, 'name', {
        value: `${definition.metadata.id.replace(/(^|-)(\w)/g, (_match, _dash, letter: string) => letter.toUpperCase())}Scene`,
    })

    return Object.assign(SceneComponent, { scene: definition.metadata })
}
