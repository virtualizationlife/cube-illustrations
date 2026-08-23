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

## Usage

```tsx
import { IllustrationsPage } from 'cube-illustrations'

export const App = () => <IllustrationsPage />
```

The main package entry imports its stylesheet automatically. It can also be imported explicitly as `cube-illustrations/styles.css`.

Each ready-to-use scene is a separate component:

```tsx
import {
    CenteredCubeScene,
    EncounterCubeScene,
    FlippingCubeScene,
    MovingGridScene,
    SevenCubesScene,
    ThreeCubesScene,
} from 'cube-illustrations'

export const Scene = () => (
    <>
        <CenteredCubeScene />
        <MovingGridScene />
        <FlippingCubeScene />
        <EncounterCubeScene />
        <ThreeCubesScene />
        <SevenCubesScene />
    </>
)
```

`SevenCubesScene` starts from a random scatter. On every cycle it generates a new connected
seven-cell island, creates a random cube queue, and moves only one cube at a time. A turn covers
one, two, or three cells before the next cube gets its turn.

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

Cubes use a corner radius of 5% of their edge by default. Every ready-to-use scene accepts
`cubeCornerRadius` in world units; set it to `0` for sharp corners. Custom additional cubes can
override the scene value with `cornerRadius`.

```tsx
<CenteredCubeScene cubeCornerRadius={0.004} />

<GridPathCubeScene
    cubeSize={0.1}
    cubeCornerRadius={0.005}
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
compositions.

## Styling

Override these custom properties on a parent element or `:root`:

- `--cube-illustrations-scene-size` (default `260px`)
- `--cube-illustrations-page-padding` (default `24px`)
- `--cube-illustrations-gap` (default `0`)
- `--cube-illustrations-background` (default `#fff`)
- `--cube-illustrations-border` (default `0`; for example `1px solid rgb(0 0 0 / 10%)`)

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
