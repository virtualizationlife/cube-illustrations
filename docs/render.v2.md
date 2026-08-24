# Render v2: One Renderer, and a Scene SDK

> Implementation status (August 2026): the shared `SceneRenderHost`, cancellation-aware
> `runSceneScript`, `defineScene`, actor/timeline choreography helpers, seeded random facade,
> scene catalog, `cube-illustrations/sdk` entry point, and pure `GridWorld` extraction are
> implemented. `SignalRelayScene` and `HistorySplitScene` are the reference migrations; remaining
> legacy scenes can move incrementally without changing their public component API.

A design document. [render.md](render.md) records the optimisation pass that is already done;
this document describes the two structural steps that remain:

1. **One renderer for the whole page** — item 1b from render.md, left undone there
   deliberately, designed here in full.
2. **A scene SDK** — extracting the code that all 33 scene components currently repeat
   into a shared, safer authoring layer.

The two are independent and can land separately, but they are described together because
the SDK's `defineScene` entry point is the natural place to hide the renderer change from
scene authors entirely.

---

## Part I — One renderer for the whole page

### Where the cost is now

After the render.md pass, every scene still owns a `WebGPURenderer`. They share one
`GPUDevice`, but each renderer keeps:

- its own **pipeline cache** — the same cube/edge/grid shaders are compiled once per
  scene, ~33 times per page load;
- its own **swap chain** (canvas context) and backbuffer;
- its own **`setAnimationLoop` subscription** and its own command-buffer submission per
  frame.

With visibility gating, 4–8 scenes render at a time, so the steady-state frame cost is
4–8 submissions instead of one, and the load-time cost is 33 shader-compile passes
instead of one. Collapsing the page to a single renderer removes both.

### The design: an optional page-level host

The classic three.js "multiple scenes, one canvas" technique, wrapped in a React context
so the package's public shape does not change.

```tsx
// IllustrationsPage — and any consumer who wants the shared path — wraps its scenes:
<SceneRenderHost>
    <MovingGridScene />
    <SignalRelayScene />
    {/* ... */}
</SceneRenderHost>
```

**With a host present**, `useSimpleCubeScene` does not construct a renderer. Instead it
registers a *slot* with the host:

```ts
interface SceneSlot {
    /** The DOM element the scene occupies; the host renders into its box. */
    readonly element: HTMLElement
    readonly scene: Scene
    readonly camera: PerspectiveCamera
    /** Advances scene logic; the host calls it only for slots it will draw. */
    readonly update: (delta: number, elapsed: number) => void
    /** Whether the slot currently wants frames (visibility gate, see below). */
    readonly isActive: () => boolean
}

interface SceneRenderHostHandle {
    readonly register: (slot: SceneSlot) => () => void   // returns unregister
}
```

The host owns:

- **one `WebGPURenderer`** on one transparent canvas covering the viewport;
- **one `THREE.Timer`** and one animation loop;
- the per-frame draw pass: for every active slot, compute the slot element's rectangle,
  set `renderer.setViewport` / `setScissor` / `setScissorTest(true)` to that rectangle,
  and render that slot's scene with its camera.

One frame is then: one `timer.update()`, N slot updates, N scissored renders, **one**
command-buffer submission, against **one** pipeline cache that has already seen every
shader after the first scene warmed it.

**Without a host** (a consumer embedding a single scene), the hook falls back to exactly
the current path: its own canvas, its own renderer, shared device. This is what keeps the
package's public shape intact — the objection that parked item 1b in render.md.

### The canvas and scroll

Two workable options; the first is recommended.

**Option A — fixed overlay canvas (recommended).** The host's canvas is
`position: fixed; inset: 0; pointer-events: none; z-index` below content. Every frame,
each active slot's rectangle comes from `element.getBoundingClientRect()`, which is
already viewport-relative — scroll needs no special handling at all. WebGPU scissor
coordinates want the rect flipped to bottom-left origin and scaled by the pixel ratio:

```ts
const rect = slot.element.getBoundingClientRect()
const left = rect.left * dpr
const bottom = (canvasCssHeight - rect.bottom) * dpr
renderer.setViewport(left, bottom, rect.width * dpr, rect.height * dpr)
renderer.setScissor(left, bottom, rect.width * dpr, rect.height * dpr)
```

`getBoundingClientRect` per visible slot per frame is a layout read, but with no
interleaved writes it does not thrash; 8 reads per frame is noise. If it ever shows up,
cache rects and refresh them from a scroll/resize listener plus a `ResizeObserver` per
slot.

**Option B — canvas transformed with the page.** An absolutely positioned canvas inside
the scroll container, `transform: translateY(scrollTop)` applied per frame. Only worth it
if a fixed element is unacceptable in the consumer's stacking context.

The backbuffer is sized to the visible viewport (`window.innerWidth/Height × dpr`,
capped at DPR 2 as today) and resized from a `resize` listener. Note this replaces
33 small backbuffers with one large one — at a 260px default slot on a laptop viewport
this is roughly comparable total memory, not a regression.

### Clearing and overlap

- One `renderer.setClearColor(0x000000, 0)` and a full-canvas clear at frame start;
  each scissored render then only touches its own rectangle.
- Slots must not overlap (they don't — the page is a grid). If a future layout overlaps
  them, last-registered wins inside the intersection; document this rather than defend
  against it.

### Visibility gating moves into the slot

The per-scene `IntersectionObserver` (128px `rootMargin`) stays exactly where it is, but
instead of starting/stopping a private loop it flips the slot's `isActive` flag. The host
skips inactive slots — no `update`, no draw. `document.hidden` pauses the host's whole
loop, replacing 33 `visibilitychange` listeners with one.

The per-scene *clock* semantics from render.md item 2 are preserved: each slot keeps its
own accumulated `elapsed` built from clamped deltas, so a scene paused off-screen still
resumes where it stopped. The host passes `delta`; the slot accumulates.

### What re-points from the canvas to the slot element

Three things currently assume the scene owns a canvas:

| Concern | Today | Under the host |
|---|---|---|
| `data-ready` fade | attribute on the per-scene canvas | attribute on the slot element; CSS selector changes from `canvas[data-ready]` to `[data-scene-ready]` |
| `unsupported` fallback | replaces the canvas | rendered inside the slot element; the host simply never draws that slot |
| `bindGridCubeHover` | pointer events + rect from the canvas | pointer events + rect from the slot element |

`bindGridCubeHover` already works in element-relative NDC — it reads
`getBoundingClientRect()` and normalises the pointer into ±1 before raycasting — so
re-pointing it is a constructor-argument change, not a logic change.

`CubeSceneViewport` becomes a plain slot `<div>` under the host (no `<canvas>` child);
in standalone mode it renders the canvas exactly as today. Both modes keep the same
outer DOM shape so consumer CSS targeting the slot keeps working.

### Renderer init and the `unsupported` path

The host initialises its renderer once, with the shared device from
[sharedGpuDevice.ts](../src/scenes/sharedGpuDevice.ts); if `renderer.init()` rejects, the
host marks itself unsupported and every registered slot shows its fallback. Slots that
register later get the answer synchronously. Standalone scenes keep their own
init/fallback exactly as now.

### Teardown

- Slot unregister (scene unmount): remove from the host's list; dispose the scene's
  runtime as today. Nothing renderer-related to dispose — the slot never owned any.
- Host unmount: stop the loop, dispose the one renderer. Slots outliving the host is a
  React tree impossibility (they are its children).

### Migration plan

1. Introduce `SceneRenderHost` + context + slot registry; no consumers yet.
2. Teach `useSimpleCubeScene` the two paths: host present → register slot; absent →
   current code, untouched.
3. Re-point hover, `data-ready`, and `unsupported` at the slot element (works in both
   modes).
4. Wrap `IllustrationsPage` in the host.
5. Verify with the A/B harness from render.md § Verification — this change is exactly
   the kind the isolated static comparison was built for. Expected result: zero pixel
   diff (nothing about materials, geometry, or camera changes; only who submits the
   draw).

### Risks

- **Scissor-rect rounding.** Fractional CSS rects × DPR can land a scissor edge one
  device pixel off the slot border. Round the rect the same way for viewport and
  scissor, and let the slot's own background (page background) hide the seam.
- **One scene's cost bleeds into all.** A pathological scene previously janked only its
  own canvas; now it janks the shared frame. Acceptable on this page (scenes are small),
  worth a note in the host's docs.
- **Stacking contexts.** A fixed canvas must sit visually *behind* any page chrome that
  overlaps the scene area. The demo page has none; consumers get a documented
  `z-index` knob on the host.

---

## Part II — Caches shared across scenes

Independent of Part I and cheaper; both follow the precedent set by
[sharedGpuDevice.ts](../src/scenes/sharedGpuDevice.ts).

### Geometry cache: per-runtime → per-page

`createCubeGeometryCache` (render.md item 5) is instantiated inside every
`createGridSceneRuntime`, so 33 scenes using the same `size:cornerRadius` build 33
copies of the same merged `RoundedBoxGeometry` + `EdgesGeometry`. The cache is already
refcounted; lifting it to a module-level singleton keyed the same way makes
`runtime.dispose()` release references instead of disposing, and the geometry dies when
the last runtime using it does. The per-runtime behaviour is preserved as a fallback for
tests that assert full teardown, via an injectable cache in
`CreateGridSceneRuntimeOptions`.

### Label texture cache

[cubeFaceLabels.ts](../src/scenes/cubeFaceLabels.ts) already shares one texture between
faces with identical text *within one cube*. A page-level map `text → texture`
(refcounted, same pattern) extends that across cubes and scenes — the common case of the
whole page rendered with `faceLabels='ABC'` collapses from one texture per cube to one
texture total.

### `three` loaded twice

Recorded at the end of render.md: `three/addons/*` imports core `three`
(`three.module.js`) while the scenes import `three/webgpu` (`three.webgpu.js`), so
consumers bundle the core twice. Fix alongside Part I, whichever is less invasive:

- add `three/addons/*` (or just the two used addon paths) to `external` in
  `vite.config.ts`, or
- vendor `RoundedBoxGeometry` + the `mergeVertices` call against the `three/webgpu`
  namespace — both are small, dependency-light files.

---

## Part III — The scene SDK

The 33 components in [src/components](../src/components) total ~6,300 lines, and three
layers of them are the same code written 33 times. In descending order of value:

### III.1 A script runner with real cancellation

**The problem.** Every scene hand-rolls the same ritual:

```ts
let cancelled = false
const delay = createCancellableDelay()
// ...
await runtime.fadeCubeTo(cubeId, 0.28, { duration: 0.12, easing: 'easeOutCubic' })
if (cancelled) return              // ← after every single await
await runtime.fadeCubeTo(cubeId, 1, { duration: 0.16, easing: 'easeOutCubic' })
if (cancelled) return
await delay.wait(0.025)
```

`SignalRelayScene` alone carries seven of these checks. A forgotten check is a silent
bug with a known shape: the scene keeps issuing `moveCubeTo`/`addCube` against a
runtime that is being torn down. The flag-and-check pattern makes the *author*
responsible for correctness at every await point.

**The fix: cancellation as an exception, not a flag.**

```ts
export class SceneCancelledError extends Error {}

export interface SceneScriptContext {
    readonly runtime: GridSceneRuntime      // cancellation-aware proxy, see below
    readonly delay: (seconds: number) => Promise<void>
    readonly signal: AbortSignal            // escape hatch for custom awaits
}

export interface SceneScriptHandle {
    readonly dispose: () => void
}

export const runSceneScript = (
    name: string,
    runtime: GridSceneRuntime,
    script: (ctx: SceneScriptContext) => Promise<void>
): SceneScriptHandle => { /* ... */ }
```

- `ctx.delay(s)` rejects with `SceneCancelledError` when the script is disposed.
- `ctx.runtime` wraps the real runtime: the async methods (`moveCubeTo`, `fadeCubeTo`,
  `moveGridFocusTo`, `travelWithCube`) race their promise against the abort signal and
  reject on cancel; the sync methods check `signal.aborted` and throw. So *any* await
  inside the script becomes a cancellation point automatically.
- The runner catches `SceneCancelledError` silently and routes every other rejection
  through the existing `startSceneAnimation` error report.

A scene body then reads as pure choreography:

```ts
const script = async (ctx: SceneScriptContext) => {
    await ctx.delay(0.7)
    for (;;) {
        await sendPulse(ctx)
        await ctx.delay(0.45)
        await renewRelay(ctx)
        await ctx.delay(0.7)
    }
}
```

Every `if (cancelled) return` disappears — across the current components that is
roughly 150–200 lines deleted, and more importantly a whole bug class closed.

**One semantic note.** Rejecting an in-flight `moveCubeTo` on cancel must still release
its cell reservations. `runtime.dispose()` already does this via `finishCubeMovement`;
the proxy's rejection is *observational* (the scene stops awaiting), while the actual
cleanup remains the runtime teardown's job, unchanged.

### III.2 `defineScene`: the declarative component factory

The React wrapper of all 33 components is byte-similar: a `useCallback` around
`onSetup`, a `useSimpleCubeScene` call with scene constants, `CubeSceneViewport`.

```ts
export const SignalRelayScene = defineScene({
    name: 'Signal Relay',
    view: {
        cubeSize: 0.05,
        gridCellSize: 0.05,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 25,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, faceLabels }) => {
        /* place cubes; return nothing — teardown is the runner's job */
    },
    script: async (ctx) => { /* choreography */ },
})
```

`defineScene` produces a component with the standard `CubeFaceLabelsProps`
(`faceLabels`, `cubeCornerRadius`) that wires setup → script runner → dispose in the
right order. Scenes that need per-frame logic (hover scale, presentation) declare an
optional `onFrame(ctx)` alongside `script`.

Benefits beyond deleted boilerplate: the `view` block is *data*, which gives the
deterministic harness (III.5) and any future gallery/preview tooling a serialisable
description of every scene; and when Part I lands, `defineScene` is the single place
that chooses host-slot vs standalone rendering — scene authors never see the
difference.

### III.3 Presentation folds into the runtime

`createScenePresentation` (zoom + grid opacity + fade radii smoothing) is a separate
controller that five scenes must remember to construct, drive from `onFrame`, and pass
the camera into. Since the runtime already owns grid opacity and fade radii, and the
camera is available to the frame loop, this becomes:

```ts
runtime.present({ zoom: 1.12, gridOpacity: 0.55 }, { response: 0.32 })
```

— a fire-and-forget target the runtime's own `update()` eases toward, same
`smoothTowards` math. Scenes stop touching `camera.zoom` and
`updateProjectionMatrix()` by hand, and `onFrame` disappears entirely from the scenes
that only used it to pump the presentation controller.

### III.4 Choreography helpers

Recurring figures currently reimplemented per scene, worth one shared module each:

- **Edge entry/exit.** The `Promise.all([moveCubeTo, fadeCubeTo])` pair appears in a
  dozen scenes. → `ctx.enterFrom(edge, cubeId, target, opts)` and
  `ctx.exitTo(edge, cubeId, opts)`, where `edge` resolves to a coordinate outside the
  visible fade radius for the scene's grid.
- **Pulse.** The fade-down/fade-up opacity blip (SignalRelay, CollectiveCurrent). →
  `ctx.pulse(cubeId, { depth, downDuration, upDuration })`.
- **Group moves in spatial order.** StructureMorph, PhaseChange and BecomingSign each
  implement "move a set of cubes into a formation, one at a time, ordered by distance
  from a seed". → `ctx.moveGroup(ids, formation, { order: 'from-seed' | 'random',
  seed, segmentDuration })`, built on the existing collision-safe `moveCubeTo`.
- **The shape library.** StructureMorph's form set and BecomingSign's twelve symbols
  are reusable assets locked inside components. → `src/scenes/formations.ts` exporting
  named coordinate sets plus `rotateFormation` / `pickDifferent` utilities.
- **Stagger/sequence.** `ctx.stagger(items, gapSeconds, fn)` for "each with a delay",
  `ctx.all([...])` as a cancellation-aware `Promise.all`.

None of these grow the runtime — they compose its existing API and live beside the
script runner.

### III.5 Deterministic mode as a first-class feature

render.md § Verification hit the wall directly: a page-level A/B needs a seeded
`sceneRandom` and a fixed-step clock instead of `THREE.Timer`. Both belong in the SDK,
not in a throwaway harness:

- `sceneRandom` gains an injectable/seedable generator (default: `Math.random`,
  unchanged).
- The frame driver (hook today, host after Part I) accepts a clock:
  `{ mode: 'realtime' } | { mode: 'fixed', stepSeconds, }`, where fixed mode advances
  exactly one step per rendered frame.

What this buys, beyond verifying Part I safely: screenshot regression tests per scene,
reproducible bug reports ("seed 42, frame 300"), and offline video capture of scenes at
any resolution without depending on wall-clock frame pacing.

---

## Suggested order of work

1. **III.1 script runner** — cheapest, closes a real bug class, no rendering risk.
   Migrate scenes gradually; both styles can coexist.
2. **Part II caches + the double-`three` fix** — small, isolated wins.
3. **Part I host renderer** — the big frame/startup win; verified with the existing
   A/B method plus III.5's fixed clock.
4. **III.2 `defineScene` + III.3/III.4 helpers** — best done while migrating scenes to
   the runner anyway; new scenes (see [SCENES.md](SCENES.md#proposed-scenes)) should be
   written in this style from day one.
