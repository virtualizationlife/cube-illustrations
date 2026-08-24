import type { ComponentType } from 'react'

import { AnticipatoryReturnScene } from './components/AnticipatoryReturnScene'
import { BoundaryRepairScene } from './components/BoundaryRepairScene'
import { BecomingSignScene } from './components/BecomingSignScene'
import { CenteredCubeScene } from './components/CenteredCubeScene'
import { CollectiveCurrentScene } from './components/CollectiveCurrentScene'
import { ContinuousQueueScene } from './components/ContinuousQueueScene'
import { CorridorDanceScene } from './components/CorridorDanceScene'
import { CrossingFlowsScene } from './components/CrossingFlowsScene'
import { DynamicBalanceScene } from './components/DynamicBalanceScene'
import { DominoRingScene } from './components/DominoRingScene'
import { EncounterCubeScene } from './components/EncounterCubeScene'
import { FlippingCubeScene } from './components/FlippingCubeScene'
import { GuardChangeScene } from './components/GuardChangeScene'
import { HistorySplitScene } from './components/HistorySplitScene'
import { LearnedDetourScene } from './components/LearnedDetourScene'
import { LearnedRhythmScene } from './components/LearnedRhythmScene'
import { MemoryReplayScene } from './components/MemoryReplayScene'
import { MetronomePairScene } from './components/MetronomePairScene'
import { MovingBridgeScene } from './components/MovingBridgeScene'
import { MovingGridScene } from './components/MovingGridScene'
import { NestedCubeScene } from './components/NestedCubeScene'
import { PhaseChangeScene } from './components/PhaseChangeScene'
import { PolarityScene } from './components/PolarityScene'
import { PredictedPathsScene } from './components/PredictedPathsScene'
import { PreferenceChoiceScene } from './components/PreferenceChoiceScene'
import { RecognizedPartnerScene } from './components/RecognizedPartnerScene'
import { RecursiveFrameScene } from './components/RecursiveFrameScene'
import { RememberedThresholdScene } from './components/RememberedThresholdScene'
import { ReunitingPairScene } from './components/ReunitingPairScene'
import { SevenCubesScene } from './components/SevenCubesScene'
import { SharedLoadScene } from './components/SharedLoadScene'
import { SignalRelayScene } from './components/SignalRelayScene'
import { StructureMorphScene } from './components/StructureMorphScene'
import { ThreeCubeStatesScene } from './components/ThreeCubeStatesScene'
import { CursorRepulsionScene, ThreeCubesScene } from './components/ThreeCubesScene'
import { ThinningClockScene } from './components/ThinningClockScene'
import { TrailingShadowScene } from './components/TrailingShadowScene'
import { ValenceFieldScene } from './components/ValenceFieldScene'
import { VllCubeScene } from './components/VllCubeScene'
import type { CubeFaceLabelsProps } from './scenes/cubeFaceLabels'
import type {
    CubeSceneProps,
    DefinedSceneComponent,
    SceneMetadata,
} from './sdk/defineScene'

export interface SceneCatalogEntry extends SceneMetadata {
    readonly component: ComponentType<CubeFaceLabelsProps>
}

const scene = (
    component: ComponentType<CubeFaceLabelsProps>,
    id: string,
    title: string,
    tags: readonly string[]
): SceneCatalogEntry => ({ component, id, title, tags })

const definedScene = (
    component: DefinedSceneComponent<CubeSceneProps>
): SceneCatalogEntry => ({ component, ...component.scene })

/** The ordered source of truth for the built-in scene gallery. */
export const SCENE_CATALOG: readonly SceneCatalogEntry[] = [
    scene(MovingGridScene, 'moving-world', 'Moving World', ['space', 'navigation']),
    scene(FlippingCubeScene, 'changing-faces', 'Changing Faces', ['form', 'transformation']),
    scene(EncounterCubeScene, 'discovery', 'Discovery', ['space', 'perception']),
    scene(ThreeCubesScene, 'three-cubes', 'Three Cubes', ['relation', 'structure']),
    scene(CenteredCubeScene, 'main-cube', 'Main Cube', ['identity', 'focus']),
    scene(SevenCubesScene, 'forming-a-group', 'Forming a Group', ['relation', 'organization']),
    scene(VllCubeScene, 'vll-cube', 'VLL Cube', ['identity', 'symbol']),
    scene(StructureMorphScene, 'random-structure', 'Random Structure', ['form', 'reconfiguration']),
    scene(ContinuousQueueScene, 'continuous-queue', 'Continuous Queue', ['continuity', 'renewal']),
    scene(CrossingFlowsScene, 'crossing-flows', 'Crossing Flows', ['relation', 'coordination']),
    scene(LearnedDetourScene, 'learned-detour', 'Learned Detour', ['mind', 'learning']),
    scene(MemoryReplayScene, 'memory-replay', 'Memory Replay', ['mind', 'memory']),
    scene(BoundaryRepairScene, 'boundary-repair', 'Boundary Repair', ['continuity', 'maintenance']),
    scene(ReunitingPairScene, 'reuniting-pair', 'Reuniting Pair', ['continuity', 'relationship']),
    scene(PreferenceChoiceScene, 'repeated-preference', 'Repeated Preference', ['mind', 'preference']),
    scene(PredictedPathsScene, 'predicted-paths', 'Predicted Paths', ['world', 'prediction']),
    scene(LearnedRhythmScene, 'learned-rhythm', 'Learned Rhythm', ['others', 'anticipation']),
    scene(ValenceFieldScene, 'valence-field', 'Valence Field', ['valence', 'behavior']),
    scene(MovingBridgeScene, 'moving-bridge', 'Moving Bridge', ['continuation', 'resources']),
    scene(BecomingSignScene, 'becoming-a-sign', 'Becoming a Sign', ['meaning', 'symbol']),
    definedScene(SignalRelayScene),
    scene(CollectiveCurrentScene, 'collective-current', 'Collective Current', ['coordination', 'emergence']),
    scene(SharedLoadScene, 'shared-load', 'Shared Load', ['cooperation', 'resources']),
    scene(PhaseChangeScene, 'phase-change', 'Phase Change', ['adaptation', 'organization']),
    scene(DynamicBalanceScene, 'dynamic-balance', 'Dynamic Balance', ['maintenance', 'stability']),
    scene(MetronomePairScene, 'two-metronomes', 'Two Metronomes', ['rhythm', 'synchrony']),
    scene(TrailingShadowScene, 'trailing-shadow', 'Trailing Shadow', ['self', 'delay']),
    scene(PolarityScene, 'polarity', 'Polarity', ['relation', 'orientation']),
    scene(GuardChangeScene, 'changing-of-the-guard', 'Changing of the Guard', ['continuity', 'handover']),
    scene(CorridorDanceScene, 'corridor-dance', 'Corridor Dance', ['relation', 'symmetry']),
    scene(DominoRingScene, 'domino-ring', 'Domino Ring', ['causality', 'recurrence']),
    scene(ThinningClockScene, 'thinning-clock', 'Thinning Clock', ['time', 'scarcity']),
    scene(RememberedThresholdScene, 'remembered-threshold', 'Remembered Threshold', ['mind', 'residue']),
    scene(RecursiveFrameScene, 'recursive-frame', 'Recursive Frame', ['ontology', 'continuity', 'reality']),
    scene(NestedCubeScene, 'nested-cube', 'Nested Cube', ['form', 'containment']),
    definedScene(HistorySplitScene),
    scene(RecognizedPartnerScene, 'recognized-partner', 'Recognized Partner', ['identity', 'memory', 'relationship']),
    scene(AnticipatoryReturnScene, 'anticipatory-return', 'Anticipatory Return', ['embodiment', 'energy', 'maintenance']),
    scene(CursorRepulsionScene, 'cursor-repulsion', 'Cursor Repulsion', ['interaction', 'avoidance']),
    scene(ThreeCubeStatesScene, 'three-states', 'Three States', ['form', 'contrast', 'transformation']),
]
