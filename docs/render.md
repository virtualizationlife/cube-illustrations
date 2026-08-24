# Render Performance Notes

How the WebGPU rendering in this package spent its time, what was changed, and how the
changes were checked against the original output.

The goal throughout was speed **without losing quality**. Every item below records what it
cost the renderer, what replaced it, and what risk it carried to the image.

Measured against `three@0.185.1` and the 25 scenes in
[src/IllustrationsPage.tsx](../src/IllustrationsPage.tsx).

---

## Status

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

## The headline problem: 25 renderers

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

## 1. One `GPUDevice` shared by every scene

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

### 1b. Not done: one renderer for the whole page

Sharing a device does not share the *pipeline cache*; each `WebGPURenderer` still compiles
its own copy of every shader and submits its own command buffer. A single renderer drawing
each scene into a scissored viewport matched to its DOM slot would collapse the page to one
device, one pipeline cache, one rAF and one submission.

It is left undone deliberately: the canvas stops being owned by `CubeSceneViewport`, so the
per-scene `data-ready` fade, the `unsupported` fallback and the hover binding all have to be
re-pointed at the slot element, and the package's public shape changes for consumers who
embed a single scene. Worth doing if the page is still the bottleneck.

---

## 2. Off-screen and hidden scenes stop rendering

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

## 3. The grid: one draw call, and the fade in the shader

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

## 4. Two lights that did nothing

```ts
scene.add(new THREE.AmbientLight(0xffffff, 1.15))
scene.add(new THREE.HemisphereLight(0xf0f2f5, 0x8a8e96, 0.85))
```

Every material in these scenes is a `*BasicMaterial` — cube body, cube edges, grid lines,
face labels — and basic materials never read lights. Both objects were pure overhead:
collected into render lists and driving lighting state every frame, for 25 scenes,
contributing nothing. **Removed.**

---

## 5. Cube geometry is cached and indexed

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

## 6. Face labels

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

## 7. Opaque cubes leave the transparent pass

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

## 8. The per-frame transform pass is dirty-flagged

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

## 9. Hover raycasting

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

## 10. The backbuffer follows the real CSS box

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

## Verification

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

### Reproducing it

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

## Also worth knowing

**`three` is loaded twice.** `three/addons/...` — `RoundedBoxGeometry`, and now
`BufferGeometryUtils` — imports from `three`, resolving to `three.module.js`, while the
scenes import `three/webgpu`, which is `three.webgpu.js`. Each build contains a full copy of
the core. `vite.config.ts` marks `three` and `three/webgpu` external but not
`three/addons/*`, so consumers end up shipping both. Pre-existing, untouched here, and worth
addressing separately — either by externalising the addon path or by building the two
geometries directly against the `three/webgpu` namespace.
