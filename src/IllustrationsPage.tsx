import type { JSX } from 'react'

import { SceneRenderHost } from './scenes/SceneRenderHost'
import { AnticipatoryReturnScene } from './components/AnticipatoryReturnScene'
import { CenteredCubeScene } from './components/CenteredCubeScene'
import { CollectiveCurrentScene } from './components/CollectiveCurrentScene'
import { BoundaryRepairScene } from './components/BoundaryRepairScene'
import { BecomingSignScene } from './components/BecomingSignScene'
import { ContinuousQueueScene } from './components/ContinuousQueueScene'
import { CrossingFlowsScene } from './components/CrossingFlowsScene'
import { CorridorDanceScene } from './components/CorridorDanceScene'
import { DynamicBalanceScene } from './components/DynamicBalanceScene'
import { DominoRingScene } from './components/DominoRingScene'
import { EncounterCubeScene } from './components/EncounterCubeScene'
import { FlippingCubeScene } from './components/FlippingCubeScene'
import { GuardChangeScene } from './components/GuardChangeScene'
import { HistorySplitScene } from './components/HistorySplitScene'
import { MovingGridScene } from './components/MovingGridScene'
import { LearnedDetourScene } from './components/LearnedDetourScene'
import { LearnedRhythmScene } from './components/LearnedRhythmScene'
import { MemoryReplayScene } from './components/MemoryReplayScene'
import { MetronomePairScene } from './components/MetronomePairScene'
import { MovingBridgeScene } from './components/MovingBridgeScene'
import { NestedCubeScene } from './components/NestedCubeScene'
import { PhaseChangeScene } from './components/PhaseChangeScene'
import { PolarityScene } from './components/PolarityScene'
import { PredictedPathsScene } from './components/PredictedPathsScene'
import { PreferenceChoiceScene } from './components/PreferenceChoiceScene'
import { RememberedThresholdScene } from './components/RememberedThresholdScene'
import { RecursiveFrameScene } from './components/RecursiveFrameScene'
import { RecognizedPartnerScene } from './components/RecognizedPartnerScene'
import { ReunitingPairScene } from './components/ReunitingPairScene'
import { SevenCubesScene } from './components/SevenCubesScene'
import { SharedLoadScene } from './components/SharedLoadScene'
import { SignalRelayScene } from './components/SignalRelayScene'
import { StructureMorphScene } from './components/StructureMorphScene'
import {
    CursorRepulsionScene,
    ThreeCubesScene,
} from './components/ThreeCubesScene'
import { ThreeCubeStatesScene } from './components/ThreeCubeStatesScene'
import { ThinningClockScene } from './components/ThinningClockScene'
import { TrailingShadowScene } from './components/TrailingShadowScene'
import { ValenceFieldScene } from './components/ValenceFieldScene'
import { VllCubeScene } from './components/VllCubeScene'

interface LabeledSceneProps {
    readonly label: string
    readonly tags: string
    readonly children: JSX.Element
}

const LabeledScene = ({ label, tags, children }: LabeledSceneProps): JSX.Element => (
    <div className='cube_illustrations__labeled_scene'>
        {children}
        <p className='cube_illustrations__scene_label'>{label}</p>
        <p className='cube_illustrations__scene_tags'>{tags}</p>
    </div>
)

export const IllustrationsPage = (): JSX.Element => (
    <SceneRenderHost>
        <div className='cube_illustrations__page'>
        <LabeledScene label='Moving World' tags='space, navigation'>
            <MovingGridScene />
        </LabeledScene>
        <LabeledScene label='Changing Faces' tags='form, transformation'>
            <FlippingCubeScene />
        </LabeledScene>
        <LabeledScene label='Discovery' tags='space, perception'>
            <EncounterCubeScene />
        </LabeledScene>
        <LabeledScene label='Three Cubes' tags='relation, structure'>
            <ThreeCubesScene />
        </LabeledScene>
        <LabeledScene label='Main Cube' tags='identity, focus'>
            <CenteredCubeScene />
        </LabeledScene>
        <LabeledScene label='Forming a Group' tags='relation, organization'>
            <SevenCubesScene />
        </LabeledScene>
        <LabeledScene label='VLL Cube' tags='identity, symbol'>
            <VllCubeScene />
        </LabeledScene>
        <LabeledScene label='Random Structure' tags='form, reconfiguration'>
            <StructureMorphScene />
        </LabeledScene>
        <LabeledScene label='Continuous Queue' tags='continuity, renewal'>
            <ContinuousQueueScene />
        </LabeledScene>
        <LabeledScene label='Crossing Flows' tags='relation, coordination'>
            <CrossingFlowsScene />
        </LabeledScene>
        <LabeledScene label='Learned Detour' tags='mind, learning'>
            <LearnedDetourScene />
        </LabeledScene>
        <LabeledScene label='Memory Replay' tags='mind, memory'>
            <MemoryReplayScene />
        </LabeledScene>
        <LabeledScene label='Boundary Repair' tags='continuity, maintenance'>
            <BoundaryRepairScene />
        </LabeledScene>
        <LabeledScene label='Reuniting Pair' tags='continuity, relationship'>
            <ReunitingPairScene />
        </LabeledScene>
        <LabeledScene label='Repeated Preference' tags='mind, preference'>
            <PreferenceChoiceScene />
        </LabeledScene>
        <LabeledScene label='Predicted Paths' tags='world, prediction'>
            <PredictedPathsScene />
        </LabeledScene>
        <LabeledScene label='Learned Rhythm' tags='others, anticipation'>
            <LearnedRhythmScene />
        </LabeledScene>
        <LabeledScene label='Valence Field' tags='valence, behavior'>
            <ValenceFieldScene />
        </LabeledScene>
        <LabeledScene label='Moving Bridge' tags='continuation, resources'>
            <MovingBridgeScene />
        </LabeledScene>
        <LabeledScene label='Becoming a Sign' tags='meaning, symbol'>
            <BecomingSignScene />
        </LabeledScene>
        <LabeledScene label='Signal Relay' tags='communication, continuity'>
            <SignalRelayScene />
        </LabeledScene>
        <LabeledScene label='Collective Current' tags='coordination, emergence'>
            <CollectiveCurrentScene />
        </LabeledScene>
        <LabeledScene label='Shared Load' tags='cooperation, resources'>
            <SharedLoadScene />
        </LabeledScene>
        <LabeledScene label='Phase Change' tags='adaptation, organization'>
            <PhaseChangeScene />
        </LabeledScene>
        <LabeledScene label='Dynamic Balance' tags='maintenance, stability'>
            <DynamicBalanceScene />
        </LabeledScene>
        <LabeledScene label='Two Metronomes' tags='rhythm, synchrony'>
            <MetronomePairScene />
        </LabeledScene>
        <LabeledScene label='Trailing Shadow' tags='self, delay'>
            <TrailingShadowScene />
        </LabeledScene>
        <LabeledScene label='Polarity' tags='relation, orientation'>
            <PolarityScene />
        </LabeledScene>
        <LabeledScene label='Changing of the Guard' tags='continuity, handover'>
            <GuardChangeScene />
        </LabeledScene>
        <LabeledScene label='Corridor Dance' tags='relation, symmetry'>
            <CorridorDanceScene />
        </LabeledScene>
        <LabeledScene label='Domino Ring' tags='causality, recurrence'>
            <DominoRingScene />
        </LabeledScene>
        <LabeledScene label='Thinning Clock' tags='time, scarcity'>
            <ThinningClockScene />
        </LabeledScene>
        <LabeledScene label='Remembered Threshold' tags='mind, residue'>
            <RememberedThresholdScene />
        </LabeledScene>
        <LabeledScene label='Recursive Frame' tags='ontology, continuity, reality'>
            <RecursiveFrameScene />
        </LabeledScene>
        <LabeledScene label='Nested Cube' tags='form, containment'>
            <NestedCubeScene />
        </LabeledScene>
        <LabeledScene label='History Split' tags='continuity, biography, comparison'>
            <HistorySplitScene />
        </LabeledScene>
        <LabeledScene label='Recognized Partner' tags='identity, memory, relationship'>
            <RecognizedPartnerScene />
        </LabeledScene>
        <LabeledScene label='Anticipatory Return' tags='embodiment, energy, maintenance'>
            <AnticipatoryReturnScene />
        </LabeledScene>
        <LabeledScene label='Cursor Repulsion' tags='interaction, avoidance'>
            <CursorRepulsionScene />
        </LabeledScene>
        <LabeledScene label='Three States' tags='form, contrast, transformation'>
            <ThreeCubeStatesScene />
        </LabeledScene>
        </div>
    </SceneRenderHost>
)
