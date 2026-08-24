# Rendering

How the WebGPU rendering in this package spends its time, what has been changed, and what
is designed but not yet built.

* **Part I — the optimisation pass** records work that is done: ten changes to how scenes
  render, each with what it cost, what replaced it, and what risk it carried to the image.
* **Part II — one renderer and a scene SDK** is a design document for the two structural
  steps that follow from it.

---

# Part I — The optimisation pass

How the WebGPU rendering in this package spent its time, what was changed, and how the
changes were checked against the original output.

The goal throughout was speed **without losing quality**. Every item below records what it
cost the renderer, what replaced it, and what risk it carried to the image.

Measured against `three@0.185.1` and the 25 scenes in
[src/IllustrationsPage.tsx](../src/IllustrationsPage.tsx).

---

### Status

| # | Change | Impact | Status | Pixel risk |
|---|--------|--------|--------|------------|
| 1 | One `GPUDevice` shared by every scene | Very high | Done | None |
| 2 | Off-screen and hidden scenes stop rendering | Very high | Done | None |
| 3 | Grid merged into one object, fade moved into the shader | Very high | Done | Verified |
| 4 | Two unused lights removed | Free | Done | None |
| 5 | Cube geometry cached and indexed | Startup + memory | Done | None |
| 6 | Empty face labels skipped, identical labels share a texture | Medium | Done | None |
| 7 | Opaque cubes leave the transparent pass | Medium | Done | Verified |
| 8 | Per-frame transform pass is dirty-flagged | Medium | Done | None |
| 9 | Hover raycasting stops rebuilding its world each frame | Low | Done | None |
| 10 | Backbuffer follows the real CSS box | Medium | Done | Verified |
| 1b | One renderer for the whole page | Highest | **Not done** | — |

Verified end state: `tsc` clean, 18/18 tests passing, `vite build` succeeds, and a
rendered A/B comparison (see [Verification](#verification)) shows the image unchanged.

---

### The headline problem: 25 renderers

Each of the 25 scene components called `useSimpleCubeScene`, and each of those built its
own renderer:

```ts
renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true })
await renderer.init()
```

So the page ran with 25 `GPUAdapter`/`GPUDevice` pairs, 25 swap chains, 25 independent
pipeline caches compiling the same shaders, 25 `requestAnimationFrame` subscriptions, and
25 command-buffer submissions per frame — around a thousand draw calls the GPU could not
batch. Items 1 and 2 attack this directly and are worth more than the rest combined.

---

### 1. One `GPUDevice` shared by every scene

`WebGPUBackend` accepts a pre-existing device instead of requesting its own
([WebGPUBackend.js:209,250](../node_modules/three/src/renderers/webgpu/WebGPUBackend.js#L209)),
and — the part that makes this safe with our teardown — `dispose()` only destroys the
device when the backend created it itself:

```js
// node_modules/three/src/renderers/webgpu/WebGPUBackend.js:2903
if ( this.parameters.device === undefined && this.device !== null ) {
    this.device.destroy();
}
```

A shared device therefore survives an unmounting scene.

**Implemented** in [src/scenes/sharedGpuDevice.ts](../src/scenes/sharedGpuDevice.ts): one
lazily-created, memoised device request for the whole page.

It resolves to `null` rather than throwing when WebGPU is unavailable, and the caller then
constructs the renderer without a `device`, so three still picks its own backend and falls
back to WebGL2 exactly as before. The `unsupported` status path is unchanged.

**Saved.** 24 redundant adapter/device requests — each tens of milliseconds of async
startup, all of them contending during initial page load — plus the duplicated backend
state behind each device.

#### 1b. Not done: one renderer for the whole page

Sharing a device does not share the *pipeline cache*; each `WebGPURenderer` still compiles
its own copy of every shader and submits its own command buffer. A single renderer drawing
each scene into a scissored viewport matched to its DOM slot would collapse the page to one
device, one pipeline cache, one rAF and one submission.

It is left undone deliberately: the canvas stops being owned by `CubeSceneViewport`, so the
per-scene `data-ready` fade, the `unsupported` fallback and the hover binding all have to be
re-pointed at the slot element, and the package's public shape changes for consumers who
embed a single scene. Worth doing if the page is still the bottleneck.

---

### 2. Off-screen and hidden scenes stop rendering

The animation loop previously ran from mount to unmount. With 25 scenes in a wrapping
layout, typically 4–8 are on screen; the rest rendered full frames into a canvas nobody saw.

**Implemented** in [src/scenes/useSimpleCubeScene.ts](../src/scenes/useSimpleCubeScene.ts): an
`IntersectionObserver` with a 128px `rootMargin` (so a scene is already running by the time
it scrolls in) combined with `document.hidden`, driving `setAnimationLoop`.

**One deliberate behavioural change came with it.** `elapsed` used to be read straight off
`THREE.Timer`, i.e. wall-clock time since start. A paused scene would come back with its
clock advanced by the whole pause, and
[FaceFlipCubeScene](../src/scenes/FaceFlipCubeScene.tsx#L187) uses `elapsed` for hold timing
(`holdUntil = elapsed + HOLD_DURATION_S`) — so every pending hold would read as expired on
resume. `elapsed` is now accumulated from the same clamped per-frame delta the rest of the
scene uses, so a paused scene resumes exactly where it stopped. For a continuously rendering
scene the two definitions differ only by frame-hitch overage.

Note the scene *logic* is already driven by `runtime.update()` — `moveCubeTo` promises only
settle as the loop advances them — so pausing the loop pauses the whole animation coherently
rather than letting half of it run on.

**Saved.** Proportional to how much of the page is off-screen: in practice 3–5× the frame
budget, plus battery on a background tab.

---

### 3. The grid: one draw call, and the fade in the shader

This was the most expensive thing per frame, in two distinct ways.

**Draw calls.** The grid was built as `2 * (gridCellCount + 3)` separate `LineSegments`,
each with its own geometry and material. At `gridCellCount: 23` that is 52 draw calls of
grid per scene before any cubes.

**Per-frame uploads.** `updateGridVisual` recomputed every vertex alpha on the CPU and
flagged the whole colour attribute dirty — a full buffer re-upload, per line, per frame.

**Implemented** in [src/scenes/gridLines.ts](../src/scenes/gridLines.ts).

Baking each line's `basePosition` into its vertices turned out to give *both* line families
the same offset, `(columnOffset, 0, rowOffset)` — so the whole grid merges into a **single**
`LineSegments`, not the two the first analysis predicted.

Both fade terms are pure functions of a point's position on the floor plane, so they moved
into the material as TSL, driven by uniforms:

```ts
const planePosition = vec2(positionLocal.x, positionLocal.z).add(offsetUniform)
const edgeFadeX = edgeLimit.sub(planePosition.x.abs()).div(gridCellSize).clamp(0, 1)
const edgeFadeZ = edgeLimit.sub(planePosition.y.abs()).div(gridCellSize).clamp(0, 1)
const fadeProgress = planePosition.length().sub(fadeInnerUniform).mul(fadeInvRangeUniform).clamp(0, 1)
const radialFade = fadeProgress.mul(fadeProgress).mul(float(3).sub(fadeProgress.mul(2))).oneMinus()
material.opacityNode = edgeFadeX.mul(edgeFadeZ).mul(radialFade).mul(opacityUniform)
```

`p * p * (3 - 2 * p)` is the same smoothstep polynomial the CPU version used. The
"outer radius does not exceed inner" case is preserved without a branch: `fadeInvRange` is
zero there, `fadeProgress` collapses to 0, and the term evaluates to 1.

**The subdivision then became unnecessary.** Each line used to be chopped into six segments
per cell purely so linear interpolation between vertex alphas could approximate the fade
curve. Evaluating per fragment removes the reason, so a line is now a single segment — and
the gradient becomes the exact function the old code was approximating rather than a
piecewise-linear version of it. That is the one place the output is not bit-identical, and
it is smoother, not worse; it accounts for the residual diff measured below.

Across the whole page:

| | Before | After |
|---|---|---|
| Grid draw calls per frame | 982 | 25 |
| Grid vertices | 228,720 | 1,964 |
| Colour bytes uploaded per frame | 3.49 MB | 0 |

Per-frame CPU work for the grid is now two uniform writes per scene.

---

### 4. Two lights that did nothing

```ts
scene.add(new THREE.AmbientLight(0xffffff, 1.15))
scene.add(new THREE.HemisphereLight(0xf0f2f5, 0x8a8e96, 0.85))
```

Every material in these scenes is a `*BasicMaterial` — cube body, cube edges, grid lines,
face labels — and basic materials never read lights. Both objects were pure overhead:
collected into render lists and driving lighting state every frame, for 25 scenes,
contributing nothing. **Removed.**

---

### 5. Cube geometry is cached and indexed

`addCube` used to build up to two `RoundedBoxGeometry` instances and one `EdgesGeometry`
per cube. `EdgesGeometry` is an expensive CPU pass — it hashes and merges every edge looking
for the dihedral-angle threshold — and scenes that spawn cubes mid-animation paid it on the
frame the cube appeared, which is where a hitch shows most.

**Implemented** in [src/scenes/cubeGeometryCache.ts](../src/scenes/cubeGeometryCache.ts): a
refcounted cache keyed on `size:cornerRadius`, released on `removeCube` and disposed at
refcount zero. It is per-runtime, so `runtime.dispose()` stays a complete teardown.
Materials remain per-cube — they carry per-cube opacity and must not be shared.

The rounded box is also run through `mergeVertices`, which welds only vertices whose every
attribute matches, so hard normal and UV seams survive and the mesh rasterises identically:

```
RoundedBoxGeometry(1, 1, 1, 3, 0.02): 1764 vertices, non-indexed
after mergeVertices:                   380 vertices, indexed
```

A 78% cut in stored vertices per cube shape, and in `CollectiveCurrentScene` twelve
identical cubes now share one copy instead of building twelve.

`mergeVertices` preserves `geometry.type` and `geometry.parameters`, so existing
introspection — including the assertions in
[tests/gridSceneRuntime.test.ts](../tests/gridSceneRuntime.test.ts) — still sees a
`RoundedBoxGeometry` with its original parameters.

---

### 6. Face labels

`resolveCubeFaceLabels` fills unspecified faces with `''`, and the old code then built a
256×256 canvas, texture, material and mesh for every one of the six faces regardless — so a
cube labelled `{ front: 'A' }` allocated roughly 1.5 MB of texture for five blank faces and
drew them.

**Implemented** in [src/scenes/cubeFaceLabels.ts](../src/scenes/cubeFaceLabels.ts):

- Faces with an empty label get no texture, no material and no mesh at all.
- Faces sharing the same text share one surface, so the common `faceLabels: 'ABC'` case
  allocates **one** texture instead of six.
- `setLabels` reconciles rather than rebuilds: a surface whose text disappeared is repainted
  for a new text instead of being destroyed and re-uploaded, which matters for scenes like
  [BecomingSignScene](../src/components/BecomingSignScene.tsx) that change labels during an
  animation.

`CubeFaceLabelAssets` gained `setOpacity`; `materials` is kept as a live view of the
surfaces currently in use.

---

### 7. Opaque cubes leave the transparent pass

The cube body and edges were always `transparent: true`, so they went into the transparent
render list: sorted back-to-front every frame, blended, and unable to benefit from early-z.
At `opacity === 1` the blend is `src × 1 + dst × 0` — exactly what an opaque draw produces.

`setVisualOpacity` now flips `transparent` as opacity crosses 1, guarded so the flag only
changes on a real change (it rebuilds the pipeline). Label materials stay transparent
always — they carry glyph alpha.

**Why the reordering is safe here.** This moves the body from the transparent pass to the
opaque pass, which runs first, so the grid is now drawn *after* the cubes instead of before.
The only way that could change the image is a grid line nearer to the camera than a cube
fragment covering the same pixel: previously the cube would paint over it, now the depth
test would let it through.

That configuration cannot occur in these scenes. The grid lies on the floor plane, every
cube sits on or above it (`hoverCells` is 0 or 1, and the body is lifted a further
`0.02` cell so its edges do not z-fight), and the camera looks down from a positive
elevation. Under those conditions floor points nearer to the camera project strictly *lower*
on screen than a cube's base, and a cube's footprint lies entirely above its own base — so a
cube's pixels only ever overlap floor lines that are farther away, which the depth test
occludes identically in both orderings. The rendered A/B below confirms it empirically.

---

### 8. The per-frame transform pass is dirty-flagged

`update()` used to end with an unconditional `applyPositions()` — recomputing the grid and
repositioning every cube — including on the many frames where a scene is parked in
`stepPause` with no transition running.

It now tracks whether the grid focus actually moved (a focus transition, or a tracked
travel) and repositions only what changed: everything on a focus change, just the cube that
moved otherwise.

**Allocation churn went with it.** The transition helpers used to return a fresh coordinate
object and a fresh `{ value, complete }` wrapper per cube per frame, and `gridFocus` was
reassigned from a spread each frame. Transitions now write into the target coordinate in
place; `getCubePosition` and `getGridFocus` still hand out copies, so nothing observable
changed.

---

### 9. Hover raycasting

The old `update()` ran `getCubes()` (allocating an array and an entry per cube), then
`filter`, then `flatMap` with a nested `filter`, then resolved the hit by walking the parent
chain calling `cubes.find` at each level — O(n²) in cube count — every frame the pointer was
over the canvas.

Now: the hit list is rebuilt only when `runtime.getCubeRevision()` changes (a new
`GridSceneRuntime` method that increments on add/remove), the intersection array is reused
across frames via `intersectObjects`' optional target, and each body mesh carries its
`cubeId` in `userData` so a hit resolves by map lookup.

**One idea from the first draft was dropped:** gating the raycast on pointer movement. Cubes
move under a stationary pointer, so hover state has to be re-evaluated every frame — the
gate would have introduced a real behavioural bug. The per-frame *allocations* are what got
removed, not the per-frame raycast.

---

### 10. The backbuffer follows the real CSS box

`ILLUSTRATION_VIEWPORT` was a hard-coded 300 logical pixels passed to `setSize`, while the
slot is sized by `--cube-illustrations-scene-size`, defaulting to 260px. On a 2× display
that produced a 600×600 backbuffer for a box needing 520×520 — about 33% more fragments, and
33% more 4× MSAA samples, thrown away by the browser's downscale.

More seriously, it was a latent bug in the other direction: a consumer setting the slot to
400px got a 300-logical-pixel buffer stretched up to fill it — a real, visible loss of
quality. The current `src/styles.css`, which now sizes slots with `minmax()` and
`aspect-ratio`, makes the slot genuinely fluid, so the fixed 300 would have been wrong at
most viewport widths.

A `ResizeObserver` now drives `setSize` and the camera aspect from the canvas's own box,
falling back to `ILLUSTRATION_VIEWPORT` only while the element has no laid-out size.

This is the one item that reduces sample count on the default 260px layout. On these flat,
unlit materials with MSAA already active the difference is not perceptible, and it is a
downscale being removed rather than resolution being lost.

---

### Verification

Two comparisons were run against the pre-change code, both in headless Chrome with WebGPU
enabled, at `--force-device-scale-factor=1`, against a copy of this tree with the four
modified source files restored from `HEAD` and the three new ones removed.

**Whole-page comparison: inconclusive, as expected.** With `Math.random` seeded identically
in both builds the page still diverges, because the visibility gating changes *when* each
scene's loop starts by a frame or two and every subsequent animation step inherits the
shift. The diff shows cubes at different grid positions — animation phase, not rendering.
A meaningful page-level diff needs the deterministic clock harness described below.

**Isolated static comparison: the real test.** A harness rendering three static scenes —
fractional grid focus (which is what exercises the fade offset), a fully opaque cube, a
cube at `opacity: 0.4`, a hovering cube, a sharp-cornered cube, and face labels — with the
slot pinned to 300px so item 10 does not confound the result:

```
changed pixels:  519 / 326,400  (0.159%)
max channel delta: 13 / 255
pixels with delta >= 8:  48
pixels with delta >= 16:  0
```

The differing pixels are scattered singletons along faint grid lines, with no structural
difference anywhere: no shifted geometry, no missing or extra lines, no changed cube
silhouettes, no altered edges or labels. That is the signature of item 3's per-fragment fade
replacing the per-vertex interpolated one, at an amplitude well under a perceptible step on
a light grey line — and it confirms item 7's reordering changes nothing.

#### Reproducing it

1. Copy the tree, restore `cubeFaceLabels.ts`, `gridSceneRuntime.ts`,
   `bindGridCubeHover.ts` and `useSimpleCubeScene.ts` from `HEAD`, delete
   `sharedGpuDevice.ts`, `cubeGeometryCache.ts` and `gridLines.ts`.
2. Add the same static harness page to both trees and serve both.
3. Screenshot each with
   `--headless=new --enable-unsafe-webgpu --force-device-scale-factor=1 --virtual-time-budget=5000`.
4. Diff with PIL.

For a page-level diff, the harness has to go further: seed
[sceneRandom.ts](../src/scenes/sceneRandom.ts), replace `THREE.Timer` with a fixed-step clock,
and step a set number of frames before capturing.

---

### Also worth knowing

**`three` is loaded twice.** `three/addons/...` — `RoundedBoxGeometry`, and now
`BufferGeometryUtils` — imports from `three`, resolving to `three.module.js`, while the
scenes import `three/webgpu`, which is `three.webgpu.js`. Each build contains a full copy of
the core. `vite.config.ts` marks `three` and `three/webgpu` external but not
`three/addons/*`, so consumers end up shipping both. Pre-existing, untouched here, and worth
addressing separately — either by externalising the addon path or by building the two
geometries directly against the `three/webgpu` namespace.

---

# Part II — One renderer, and a scene SDK

> Implementation status: everything designed below is implemented. The shared
> `SceneRenderHost`, cancellation-aware `runSceneScript`, `defineScene`, actor/timeline
> choreography helpers, seeded random facade, scene catalog, `cube-illustrations/sdk` entry
> point and pure `GridWorld` extraction all exist, and the migration is finished: every scene
> in the gallery is built with the SDK — 35 through `defineScene`, 5 wrappers through
> `attachSceneMetadata` — with no change to their public component API. See
> [refactoring.plan.md](refactoring.plan.md) for how that was carried out.

A design document. part I records the optimisation pass that is already done;
this document describes the two structural steps that remain:

1. **One renderer for the whole page** — item 1b of part I, left undone there
   deliberately, designed here in full.
2. **A scene SDK** — extracting the code that all 33 scene components currently repeat
   into a shared, safer authoring layer.

The two are independent and can land separately, but they are described together because
the SDK's `defineScene` entry point is the natural place to hide the renderer change from
scene authors entirely.

---

### Part I — One renderer for the whole page

#### Where the cost is now

After the part I pass, every scene still owns a `WebGPURenderer`. They share one
`GPUDevice`, but each renderer keeps:

- its own **pipeline cache** — the same cube/edge/grid shaders are compiled once per
  scene, ~33 times per page load;
- its own **swap chain** (canvas context) and backbuffer;
- its own **`setAnimationLoop` subscription** and its own command-buffer submission per
  frame.

With visibility gating, 4–8 scenes render at a time, so the steady-state frame cost is
4–8 submissions instead of one, and the load-time cost is 33 shader-compile passes
instead of one. Collapsing the page to a single renderer removes both.

#### The design: an optional page-level host

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
package's public shape intact — the objection that parked item 1b in part I.

#### The canvas and scroll

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

#### Clearing and overlap

- One `renderer.setClearColor(0x000000, 0)` and a full-canvas clear at frame start;
  each scissored render then only touches its own rectangle.
- Slots must not overlap (they don't — the page is a grid). If a future layout overlaps
  them, last-registered wins inside the intersection; document this rather than defend
  against it.

#### Visibility gating moves into the slot

The per-scene `IntersectionObserver` (128px `rootMargin`) stays exactly where it is, but
instead of starting/stopping a private loop it flips the slot's `isActive` flag. The host
skips inactive slots — no `update`, no draw. `document.hidden` pauses the host's whole
loop, replacing 33 `visibilitychange` listeners with one.

The per-scene *clock* semantics from part I item 2 are preserved: each slot keeps its
own accumulated `elapsed` built from clamped deltas, so a scene paused off-screen still
resumes where it stopped. The host passes `delta`; the slot accumulates.

#### What re-points from the canvas to the slot element

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

#### Renderer init and the `unsupported` path

The host initialises its renderer once, with the shared device from
[sharedGpuDevice.ts](../src/scenes/sharedGpuDevice.ts); if `renderer.init()` rejects, the
host marks itself unsupported and every registered slot shows its fallback. Slots that
register later get the answer synchronously. Standalone scenes keep their own
init/fallback exactly as now.

#### Teardown

- Slot unregister (scene unmount): remove from the host's list; dispose the scene's
  runtime as today. Nothing renderer-related to dispose — the slot never owned any.
- Host unmount: stop the loop, dispose the one renderer. Slots outliving the host is a
  React tree impossibility (they are its children).

#### Migration plan

1. Introduce `SceneRenderHost` + context + slot registry; no consumers yet.
2. Teach `useSimpleCubeScene` the two paths: host present → register slot; absent →
   current code, untouched.
3. Re-point hover, `data-ready`, and `unsupported` at the slot element (works in both
   modes).
4. Wrap `IllustrationsPage` in the host.
5. Verify with the A/B harness from part I § Verification — this change is exactly
   the kind the isolated static comparison was built for. Expected result: zero pixel
   diff (nothing about materials, geometry, or camera changes; only who submits the
   draw).

#### Risks

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

### Part II — Caches shared across scenes

Independent of Part I and cheaper; both follow the precedent set by
[sharedGpuDevice.ts](../src/scenes/sharedGpuDevice.ts).

#### Geometry cache: per-runtime → per-page

`createCubeGeometryCache` (part I item 5) is instantiated inside every
`createGridSceneRuntime`, so 33 scenes using the same `size:cornerRadius` build 33
copies of the same merged `RoundedBoxGeometry` + `EdgesGeometry`. The cache is already
refcounted; lifting it to a module-level singleton keyed the same way makes
`runtime.dispose()` release references instead of disposing, and the geometry dies when
the last runtime using it does. The per-runtime behaviour is preserved as a fallback for
tests that assert full teardown, via an injectable cache in
`CreateGridSceneRuntimeOptions`.

#### Label texture cache

[cubeFaceLabels.ts](../src/scenes/cubeFaceLabels.ts) already shares one texture between
faces with identical text *within one cube*. A page-level map `text → texture`
(refcounted, same pattern) extends that across cubes and scenes — the common case of the
whole page rendered with `faceLabels='ABC'` collapses from one texture per cube to one
texture total.

#### `three` loaded twice

Recorded at the end of part I: `three/addons/*` imports core `three`
(`three.module.js`) while the scenes import `three/webgpu` (`three.webgpu.js`), so
consumers bundle the core twice. Fix alongside Part I, whichever is less invasive:

- add `three/addons/*` (or just the two used addon paths) to `external` in
  `vite.config.ts`, or
- vendor `RoundedBoxGeometry` + the `mergeVertices` call against the `three/webgpu`
  namespace — both are small, dependency-light files.

---

### Part III — The scene SDK

The 33 components in [src/components](../src/components) total ~6,300 lines, and three
layers of them are the same code written 33 times. In descending order of value:

#### III.1 A script runner with real cancellation

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

#### III.2 `defineScene`: the declarative component factory

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

#### III.3 Presentation folds into the runtime

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

#### III.4 Choreography helpers

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

#### III.5 Deterministic mode as a first-class feature

part I § Verification hit the wall directly: a page-level A/B needs a seeded
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

### Suggested order of work

1. **III.1 script runner** — cheapest, closes a real bug class, no rendering risk.
   Migrate scenes gradually; both styles can coexist.
2. **Part II caches + the double-`three` fix** — small, isolated wins.
3. **Part I host renderer** — the big frame/startup win; verified with the existing
   A/B method plus III.5's fixed clock.
4. **III.2 `defineScene` + III.3/III.4 helpers** — best done while migrating scenes to
   the runner anyway; new scenes (see [SCENES.md](SCENES.md#proposed-scenes)) should be
   written in this style from day one.
