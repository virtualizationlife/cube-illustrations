import type { ComponentType } from 'react'

import { BoundaryRepairScene } from '@gallery/continuity/BoundaryRepairScene'
import { GuardChangeScene } from '@gallery/continuity/GuardChangeScene'
import { HistorySplitScene } from '@gallery/continuity/HistorySplitScene'
import { RecursiveFrameScene } from '@gallery/continuity/RecursiveFrameScene'
import { RememberedThresholdScene } from '@gallery/continuity/RememberedThresholdScene'
import { ReunitingPairScene } from '@gallery/continuity/ReunitingPairScene'
import { DominoRingScene } from '@gallery/cycles/DominoRingScene'
import { MetronomePairScene } from '@gallery/cycles/MetronomePairScene'
import { PhaseChangeScene } from '@gallery/cycles/PhaseChangeScene'
import { SevenCubesScene } from '@gallery/cycles/SevenCubesScene'
import { ThinningClockScene } from '@gallery/cycles/ThinningClockScene'
import { CollectiveCurrentScene } from '@gallery/flow/CollectiveCurrentScene'
import { ContinuousQueueScene } from '@gallery/flow/ContinuousQueueScene'
import { CorridorDanceScene } from '@gallery/flow/CorridorDanceScene'
import { CrossingFlowsScene } from '@gallery/flow/CrossingFlowsScene'
import { MovingBridgeScene } from '@gallery/flow/MovingBridgeScene'
import { MovingGridScene } from '@gallery/flow/MovingGridScene'
import { SharedLoadScene } from '@gallery/flow/SharedLoadScene'
import { BecomingSignScene } from '@gallery/interaction/BecomingSignScene'
import { EncounterCubeScene } from '@gallery/interaction/EncounterCubeScene'
import { FlippingCubeScene } from '@gallery/interaction/FlippingCubeScene'
import { PolarityScene } from '@gallery/interaction/PolarityScene'
import { SignalRelayScene } from '@gallery/interaction/SignalRelayScene'
import { TrailingShadowScene } from '@gallery/interaction/TrailingShadowScene'
import { ValenceFieldScene } from '@gallery/interaction/ValenceFieldScene'
import { AnticipatoryReturnScene } from '@gallery/mind/AnticipatoryReturnScene'
import { LearnedDetourScene } from '@gallery/mind/LearnedDetourScene'
import { LearnedRhythmScene } from '@gallery/mind/LearnedRhythmScene'
import { MemoryReplayScene } from '@gallery/mind/MemoryReplayScene'
import { PredictedPathsScene } from '@gallery/mind/PredictedPathsScene'
import { PreferenceChoiceScene } from '@gallery/mind/PreferenceChoiceScene'
import { RecognizedPartnerScene } from '@gallery/mind/RecognizedPartnerScene'
import { JumpingCubeScene } from '@gallery/movement/JumpingCubeScene'
import { RaisedStrideCubeScene } from '@gallery/movement/RaisedStrideCubeScene'
import { RollingCubeScene } from '@gallery/movement/RollingCubeScene'
import { SlidingCubeScene } from '@gallery/movement/SlidingCubeScene'
import { TeleportingCubeScene } from '@gallery/movement/TeleportingCubeScene'
import { CenteredCubeScene } from '@gallery/structure/CenteredCubeScene'
import { DynamicBalanceScene } from '@gallery/structure/DynamicBalanceScene'
import { NestedCubeScene } from '@gallery/structure/NestedCubeScene'
import { StructureMorphScene } from '@gallery/structure/StructureMorphScene'
import { CursorRepulsionScene, ThreeCubesScene } from '@gallery/structure/ThreeCubesScene'
import { ThreeCubeStatesScene } from '@gallery/structure/ThreeCubeStatesScene'
import { VllCubeScene } from '@gallery/structure/VllCubeScene'
import type { CubeFaceLabelsProps } from '@runtime/grid/cubeFaceLabels'
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
    RollingCubeScene,
    SlidingCubeScene,
    JumpingCubeScene,
    RaisedStrideCubeScene,
    TeleportingCubeScene,
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
