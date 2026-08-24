# cube-illustrations

Standalone React/WebGPU package containing the animated cube illustrations page and its reusable scene runtime.

## Local installation

From another project in the same parent directory:

```bash
npm install ../cube-illustrations
```

Or add it to `package.json`:

```json
{
    "dependencies": {
        "cube-illustrations": "file:../cube-illustrations"
    }
}
```

The consuming project must provide `react`, `react-dom`, and `three`.

The package has two supported entry points:

- `cube-illustrations` for built-in scene components and the gallery;
- `cube-illustrations/sdk` for authoring custom scenes.

## Usage

```tsx
import { IllustrationsPage } from 'cube-illustrations'

export const App = () => <IllustrationsPage />
```

The main package entry imports its stylesheet automatically. It can also be imported explicitly as `cube-illustrations/styles.css`.

Each ready-to-use scene is a separate component:

```tsx
import {
    AnticipatoryReturnScene,
    BoundaryRepairScene,
    BecomingSignScene,
    CenteredCubeScene,
    CollectiveCurrentScene,
    ContinuousQueueScene,
    CorridorDanceScene,
    CrossingFlowsScene,
    CursorRepulsionScene,
    DominoRingScene,
    DynamicBalanceScene,
    EncounterCubeScene,
    FlippingCubeScene,
    GuardChangeScene,
    HistorySplitScene,
    JumpingCubeScene,
    LearnedDetourScene,
    LearnedRhythmScene,
    MemoryReplayScene,
    MetronomePairScene,
    MovingGridScene,
    MovingBridgeScene,
    NestedCubeScene,
    PhaseChangeScene,
    PolarityScene,
    PredictedPathsScene,
    PreferenceChoiceScene,
    RecursiveFrameScene,
    RaisedStrideCubeScene,
    RecognizedPartnerScene,
    RememberedThresholdScene,
    ReunitingPairScene,
    RollingCubeScene,
    SevenCubesScene,
    SharedLoadScene,
    SignalRelayScene,
    SlidingCubeScene,
    StructureMorphScene,
    ThinningClockScene,
    TeleportingCubeScene,
    ThreeCubeStatesScene,
    ThreeCubesScene,
    TrailingShadowScene,
    VllCubeScene,
    ValenceFieldScene,
    WorldGridScene,
} from 'cube-illustrations'

export const Scene = () => (
    <>
        <RollingCubeScene />
        <SlidingCubeScene />
        <JumpingCubeScene />
        <RaisedStrideCubeScene />
        <TeleportingCubeScene transparencyDuration={3} />
        <CenteredCubeScene />
        <MovingGridScene />
        <FlippingCubeScene />
        <EncounterCubeScene />
        <ThreeCubesScene />
        <VllCubeScene />
        <SevenCubesScene />
        <StructureMorphScene />
        <ThreeCubeStatesScene />
        <ContinuousQueueScene />
        <CrossingFlowsScene />
        <CursorRepulsionScene />
        <LearnedDetourScene />
        <MemoryReplayScene />
        <BoundaryRepairScene />
        <ReunitingPairScene />
        <PreferenceChoiceScene />
        <PredictedPathsScene />
        <LearnedRhythmScene />
        <ValenceFieldScene />
        <WorldGridScene />
        <MovingBridgeScene />
        <BecomingSignScene />
        <SignalRelayScene />
        <CollectiveCurrentScene />
        <SharedLoadScene />
        <PhaseChangeScene />
        <DynamicBalanceScene />
        <MetronomePairScene />
        <TrailingShadowScene />
        <PolarityScene />
        <GuardChangeScene />
        <CorridorDanceScene />
        <DominoRingScene />
        <ThinningClockScene />
        <RememberedThresholdScene />
        <RecursiveFrameScene />
        <NestedCubeScene />
        <HistorySplitScene />
        <RecognizedPartnerScene />
        <AnticipatoryReturnScene />
    </>
)
```

`RollingCubeScene`, `SlidingCubeScene`, `JumpingCubeScene`, and `RaisedStrideCubeScene` are
single-cube movement studies: respectively a one-cell edge roll, a one-cell slide, a two-cell jump
over the intervening tile, and a one-cell lift followed by a two-cell aerial stride. Their grid focus
travels with the cube. `TeleportingCubeScene` crossfades the current cube with a successor at a
random position within five cells, then transfers grid focus to it. Its `transparencyDuration` prop
sets the concurrent fade-out/fade-in duration in seconds and defaults to `3`.

`MovingGridScene` occasionally lets a randomly selected encounter follow the main cube for a few
steps. `FlippingCubeScene` mixes its regular rotations with short rapid face sequences.
`CenteredCubeScene` remains fixed while translucent groups of one to three slow cubes enter from
random sides, with some changing direction once before they leave.
`CursorRepulsionScene` continuously pushes each of its three cubes away from an approaching pointer;
the cubes avoid one another and return smoothly to their original row when the pointer leaves.
In `ThreeCubeStatesScene`, hovering the left cube enlarges it and hovering the right cube reduces
it. Hovering the middle cube triggers a one-cell lift, followed by random quarter-turns around all
three axes and a smooth return to the grid.

`SevenCubesScene` starts from a random scatter. Six cubes gather first; a random late arrival then
causes the group to reorganize into a connected seven-cell island. A turn covers one, two, or three
cells before the next cube gets its turn. `VllCubeScene` rises one cell while rotating and replaces
letters only on the faces hidden from the camera after each turn.

`StructureMorphScene` continuously rearranges sixteen cubes into a random non-repeating form from
its built-in shape set, spreading each movement from a random seed cube. `ContinuousQueueScene`
advances its elements one by one while an early arrival waits beside the occupied tail.
`CrossingFlowsScene` sends random cubes across a 10-by-10 grid from both sides; head-on cubes yield
individually, while dense traffic temporarily alternates priority between entire directions.

`LearnedDetourScene` repeatedly adapts when a changing barrier blocks its learned route.
`MemoryReplayScene` reconstructs a completed journey with moving translucent echoes.
`BoundaryRepairScene` repairs a ring after an external cube breaches it. `ReunitingPairScene` makes
two cubes wait for each other after unequal routes. `PreferenceChoiceScene` follows the same shape
after two destination arrangements exchange sides.

`PredictedPathsScene` simulates possible routes before acting. `LearnedRhythmScene` learns another
cube's changing crossing rhythm. `ValenceFieldScene` approaches one form and avoids another after
they swap sides. `MovingBridgeScene` recycles rear supports ahead of a centered traveler.
`BecomingSignScene` turns a random scatter into one of twelve non-repeating symbols that guides the
main cube.

`SignalRelayScene` passes a visible impulse through a renewing chain. `CollectiveCurrentScene`
alternates between independent movement and locally aligned flow. `SharedLoadScene` moves finite
supports around a raised traveler one at a time. `PhaseChangeScene` repeatedly crystallizes a
scatter and melts it again. `DynamicBalanceScene` maintains a compact group through continual
arrival, departure, and redistribution.

`MetronomePairScene` couples two pendulums until they share a tempo, then detunes them again.
`TrailingShadowScene` keeps a translucent double one step behind a walker. `PolarityScene` attracts
or repels the same pair according to one cube's quarter-turn. `GuardChangeScene` alternates
overlapping and vacant handovers at a central post. `CorridorDanceScene` deadlocks two polite cubes
until one of them stops mirroring. `DominoRingScene` sends a toppling wave around a closed ring.
`ThinningClockScene` shortens each lap as dial marks disappear. `RememberedThresholdScene` keeps
detouring around a cell after the obstacle is gone.

`RecursiveFrameScene` renews nested frames while a centre cube keeps its inner route.
`NestedCubeScene` holds a raised cube inside a larger translucent cube. `HistorySplitScene` replays
three biographies through one world and then shows their traces together. `RecognizedPartnerScene`
repeats a dance from spatial memory after two identical visitors swap places.
`AnticipatoryReturnScene` spends an energy column on a long outbound trip, fails once, then turns
back in time.

## Face labels

Every ready-to-use scene accepts `faceLabels`. A string writes the same text on every face; a
face map controls each face separately. Labels are centered and limited to three Unicode symbols.

```tsx
<CenteredCubeScene faceLabels='LAB' />

<SevenCubesScene
    faceLabels={{
        front: 'ABC',
        right: '123',
        top: 'TOP',
    }}
/>
```

Available face names are `front`, `back`, `left`, `right`, `top`, and `bottom`. For custom scenes,
set `mainCubeFaceLabels` on `GridPathCubeScene`, or `faceLabels` on any item in
`additionalCubes`.

## Rounded corners

Cubes use a corner radius of 3% of their edge by default. Every ready-to-use scene accepts
`cubeCornerRadius` in world units; set it to `0` for sharp corners. Custom additional cubes can
override the scene value with `cornerRadius`.

```tsx
<CenteredCubeScene cubeCornerRadius={0.004} />

<GridPathCubeScene
    cubeSize={0.1}
    cubeCornerRadius={0.003}
    additionalCubes={[{ id: 'sharp', cornerRadius: 0 }]}
    // ...other required scene props
/>
```

## Collision-safe movement

Grid coordinates are exclusive: adding or directly placing a cube in an occupied cell throws an
error. Animated movement uses cardinal pathfinding and reserves the start and route cells, so
multiple cubes cannot enter or cross the same occupied space. `moveCubeTo` resolves without moving
when no safe route exists.

The lower-level scene components and grid animation/runtime APIs remain public exports for custom
compositions. They remain available from the root entry for compatibility; new scene authoring
should use `cube-illustrations/sdk`. The legacy root runtime exports may move in the next major
version.

## Scene SDK

`defineScene` owns the React, renderer, visibility, viewport, and cancellation lifecycle. A scene
only declares its metadata, view, initial composition, and choreography:

```tsx
import { defineScene } from 'cube-illustrations/sdk'

export const GreetingScene = defineScene({
    metadata: {
        id: 'greeting',
        title: 'Greeting',
        primaryCategory: 'interaction',
        tags: ['example'],
    },
    view: {
        cubeSize: 0.06,
        gridCellSize: 0.06,
        gridCellCount: 11,
        cameraAzimuthDeg: 35,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.addCube({
            id: 'partner',
            position: { column: 3, row: 0 },
            faceLabels: props.faceLabels,
        })
    },
    script: async ({ cubes, timeline }) => {
        await timeline.wait(0.5)
        await cubes.main.moveTo({ column: 2, row: 0 }, { duration: 0.8, easing: 'easeInOutCubic' })
        await cubes.get('partner').pulse()
    },
})
```

SDK delays and asynchronous runtime commands are cancelled automatically when the component
unmounts. `timeline` also provides `all`, `sequence`, `stagger`, and `loop`; `runtime` remains
available for lower-level operations.

SDK-authored scenes accept `seed` for reproducible random choices. Use the injected `random`
facade in `setup`, `script`, or `onFrame` instead of `Math.random`; the same seed then produces the
same sequence of `random.next()`, `random.item()`, and `random.shuffle()` results.

`SCENE_CATALOG` is the ordered source of built-in component metadata used by
`IllustrationsPage`; consumers can use it to build their own gallery or filtering UI.

## Camera angle

Lower-level scenes accept `cameraAzimuthDeg` for rotation around the grid and the optional
`cameraElevationDeg` for the angle above the horizon. Elevation defaults to `35` degrees when it is
not specified. All ready-to-use scenes use this standard elevation.

When radial grid fade radii are omitted, the grid fades completely at its nominal outer boundary.
The fully opaque center occupies 40% of that radius, leaving the remaining 60% for a broad partial-
opacity transition.

## Styling

Override these custom properties on a parent element or `:root`:

- `--cube_illustrations_scene_size` (default `280px`)
- `--cube_illustrations_page_padding` (default `24px`)
- `--cube_illustrations_gap` (default `0`)
- `--cube_illustrations_background` (default `#fff`)
- `--cube_illustrations_border` (default `0`; for example `1px solid rgb(0 0 0 / 10%)`)

## Development

Start the local playground and open the URL printed by Vite:

```bash
npm run demo
```

Run verification:

```bash
npm install
npm run check
npm test
```
