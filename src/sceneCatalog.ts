import type { ComponentType } from 'react'

import { AnticipatoryReturnScene } from '@components/AnticipatoryReturnScene'
import { BecomingSignScene } from '@components/BecomingSignScene'
import { BoundaryRepairScene } from '@components/BoundaryRepairScene'
import { CenteredCubeScene } from '@components/CenteredCubeScene'
import { CollectiveCurrentScene } from '@components/CollectiveCurrentScene'
import { ContinuousQueueScene } from '@components/ContinuousQueueScene'
import { CorridorDanceScene } from '@components/CorridorDanceScene'
import { CrossingFlowsScene } from '@components/CrossingFlowsScene'
import { DominoRingScene } from '@components/DominoRingScene'
import { DynamicBalanceScene } from '@components/DynamicBalanceScene'
import { EncounterCubeScene } from '@components/EncounterCubeScene'
import { FlippingCubeScene } from '@components/FlippingCubeScene'
import { GuardChangeScene } from '@components/GuardChangeScene'
import { HistorySplitScene } from '@components/HistorySplitScene'
import { LearnedDetourScene } from '@components/LearnedDetourScene'
import { LearnedRhythmScene } from '@components/LearnedRhythmScene'
import { MemoryReplayScene } from '@components/MemoryReplayScene'
import { MetronomePairScene } from '@components/MetronomePairScene'
import { MovingBridgeScene } from '@components/MovingBridgeScene'
import { MovingGridScene } from '@components/MovingGridScene'
import { NestedCubeScene } from '@components/NestedCubeScene'
import { PhaseChangeScene } from '@components/PhaseChangeScene'
import { PolarityScene } from '@components/PolarityScene'
import { PredictedPathsScene } from '@components/PredictedPathsScene'
import { PreferenceChoiceScene } from '@components/PreferenceChoiceScene'
import { RecognizedPartnerScene } from '@components/RecognizedPartnerScene'
import { RecursiveFrameScene } from '@components/RecursiveFrameScene'
import { RememberedThresholdScene } from '@components/RememberedThresholdScene'
import { ReunitingPairScene } from '@components/ReunitingPairScene'
import { SevenCubesScene } from '@components/SevenCubesScene'
import { SharedLoadScene } from '@components/SharedLoadScene'
import { SignalRelayScene } from '@components/SignalRelayScene'
import { StructureMorphScene } from '@components/StructureMorphScene'
import { ThinningClockScene } from '@components/ThinningClockScene'
import { CursorRepulsionScene, ThreeCubesScene } from '@components/ThreeCubesScene'
import { ThreeCubeStatesScene } from '@components/ThreeCubeStatesScene'
import { TrailingShadowScene } from '@components/TrailingShadowScene'
import { ValenceFieldScene } from '@components/ValenceFieldScene'
import { VllCubeScene } from '@components/VllCubeScene'
import type { CubeFaceLabelsProps } from '@scenes/cubeFaceLabels'
import type { SceneMetadata } from '@sdk/defineScene'

export type SceneCatalogEntry = {
    readonly component: ComponentType<CubeFaceLabelsProps>
} & SceneMetadata

/** Requires every listed scene to carry its own metadata, without constraining its props. */
const orderScenes = <Scenes extends readonly { readonly scene: SceneMetadata }[]>(
    scenes: Scenes
): Scenes => scenes

/**
 * The gallery order. Every scene carries its own metadata, so this list declares one thing
 * only: the sequence the scenes are shown in.
 */
const ORDERED_SCENES = orderScenes([
    MovingGridScene,
    FlippingCubeScene,
    EncounterCubeScene,
    ThreeCubesScene,
    CenteredCubeScene,
    SevenCubesScene,
    VllCubeScene,
    StructureMorphScene,
    ContinuousQueueScene,
    CrossingFlowsScene,
    LearnedDetourScene,
    MemoryReplayScene,
    BoundaryRepairScene,
    ReunitingPairScene,
    PreferenceChoiceScene,
    PredictedPathsScene,
    LearnedRhythmScene,
    ValenceFieldScene,
    MovingBridgeScene,
    BecomingSignScene,
    SignalRelayScene,
    CollectiveCurrentScene,
    SharedLoadScene,
    PhaseChangeScene,
    DynamicBalanceScene,
    MetronomePairScene,
    TrailingShadowScene,
    PolarityScene,
    GuardChangeScene,
    CorridorDanceScene,
    DominoRingScene,
    ThinningClockScene,
    RememberedThresholdScene,
    RecursiveFrameScene,
    NestedCubeScene,
    HistorySplitScene,
    RecognizedPartnerScene,
    AnticipatoryReturnScene,
    CursorRepulsionScene,
    ThreeCubeStatesScene,
])

/** The ordered source of truth for the built-in scene gallery. */
export const SCENE_CATALOG: readonly SceneCatalogEntry[] = ORDERED_SCENES.map((component) => ({
    component: component as ComponentType<CubeFaceLabelsProps>,
    ...component.scene,
}))
