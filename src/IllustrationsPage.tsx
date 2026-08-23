import type { JSX } from 'react'

import { CenteredCubeScene } from './components/CenteredCubeScene'
import { EncounterCubeScene } from './components/EncounterCubeScene'
import { FlippingCubeScene } from './components/FlippingCubeScene'
import { MovingGridScene } from './components/MovingGridScene'
import { SevenCubesScene } from './components/SevenCubesScene'
import { ThreeCubesScene } from './components/ThreeCubesScene'

export const IllustrationsPage = (): JSX.Element => (
    <div className='cube_illustrations__page'>
        <MovingGridScene />
        <FlippingCubeScene />
        <EncounterCubeScene />
        <ThreeCubesScene />
        <CenteredCubeScene />
        <SevenCubesScene />
    </div>
)
