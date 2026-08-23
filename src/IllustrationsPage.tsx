import type { JSX } from 'react'

import { CenteredCubeScene } from './components/CenteredCubeScene'
import { BoundaryRepairScene } from './components/BoundaryRepairScene'
import { BecomingSignScene } from './components/BecomingSignScene'
import { ContinuousQueueScene } from './components/ContinuousQueueScene'
import { CrossingFlowsScene } from './components/CrossingFlowsScene'
import { EncounterCubeScene } from './components/EncounterCubeScene'
import { FlippingCubeScene } from './components/FlippingCubeScene'
import { MovingGridScene } from './components/MovingGridScene'
import { LearnedDetourScene } from './components/LearnedDetourScene'
import { LearnedRhythmScene } from './components/LearnedRhythmScene'
import { MemoryReplayScene } from './components/MemoryReplayScene'
import { MovingBridgeScene } from './components/MovingBridgeScene'
import { PredictedPathsScene } from './components/PredictedPathsScene'
import { PreferenceChoiceScene } from './components/PreferenceChoiceScene'
import { ReunitingPairScene } from './components/ReunitingPairScene'
import { SevenCubesScene } from './components/SevenCubesScene'
import { StructureMorphScene } from './components/StructureMorphScene'
import { ThreeCubesScene } from './components/ThreeCubesScene'
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
    </div>
)
