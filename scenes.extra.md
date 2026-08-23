# Proposed Scenes

Eight scene proposals extending the collection described in [SCENES.md](SCENES.md). None of
them is implemented; this document is the design brief for each.

The selection is driven by the gaps visible in [SCENE-FEATURES.md](SCENE-FEATURES.md):
proximity reaction appears in only 5 of 33 scenes, cube rotation in 4, animated camera
zoom in 5, vertical stacking (`hoverCells` above ground with `occupiesCell: false`) is
used only by the two bridge scenes, and dynamic face-label changes only by
`BecomingSignScene`. Each proposal below either exercises one of those rare mechanics or
introduces a phenomenon the collection does not yet depict — and each is checked against
all existing scenes, including the undocumented eight (`PolarityScene`,
`TrailingShadowScene`, `ThinningClockScene`, `MetronomePairScene`, `DominoRingScene`,
`CorridorDanceScene`, `GuardChangeScene`, `RememberedThresholdScene`), so nothing here
duplicates them.

All proposals respect the house constraints: cubes are the size of one grid cell and
never change size, movement is sliding between cells (rotation only where noted),
appearance and disappearance happen through opacity and the transparent grid edge, and
all multi-cube movement goes through the collision-safe `moveCubeTo`.

---

## P1. Contagion (`ContagionScene`)

**Tags:** `propagation`, `resilience`

**Recommended first.**

Twelve to fourteen cubes stand scattered across a large grid, taking occasional
independent one-cell steps, all at full opacity. At a random moment one cube "ignites":
it pulses and switches to a marked state (opacity held at ~0.45, or a face label such as
`●` if labels read better at this grid scale). The state is contagious by proximity —
every unmarked cube within a small radius of a marked one catches it after a short
individual delay, so the mark spreads through the scatter as a visible two-dimensional
wavefront, fast through dense clusters and slower across gaps. Isolated cubes far from
any neighbour may escape entirely.

Once the wave exhausts itself, recovery runs the same way in reverse: the first-infected
cube returns to full opacity, and recovery spreads outward along the same neighbour
relation. A pause, a reshuffle of positions, and a new cycle starts from a different
cube, so every cycle has a different epidemic shape.

**Why it is new.** `SignalRelayScene` passes an impulse along a prepared line;
this scene propagates a *state* through an unstructured 2D field, where topology —
density, gaps, isolation — decides the outcome. No existing scene shows a wavefront.

**Implementation notes.** Entirely on the existing API: `getGridDistance` for the
neighbour radius, `fadeCubeTo` for state changes, per-cube delays via the script
runner's `stagger`. No runtime changes.

**Abstract meaning:** A state spreads through local contact alone, and the shape of the
crowd — not any central decision — determines who is reached and who is spared.

## P2. Tower (`TowerScene`)

**Tags:** `accumulation`, `order`

**Recommended first.**

A designated build cell stands near the centre. Cubes arrive one at a time from the
transparent edges, travel to the build cell, and stack: the first occupies the ground,
the next settles at `hoverCells: 1`, the next at 2, up to a height of four or five. The
climb is depicted as the arriving cube moving to an adjacent cell, then rising level by
level along the tower's side before sliding onto the top — always through positions, no
teleporting opacity tricks.

When the tower is complete, it holds for a beat, and then is dismantled in the only
order possible: from the top. Each cube descends the same way it rose and travels to a
*new* build cell chosen elsewhere on the grid, where the tower reassembles — the
last-removed top cube inevitably ends up at the bottom of the new tower, visibly
inverting the order of accumulation.

**Why it is new.** Every existing scene is flat; the vertical axis is used only for
hovering travellers in the two bridge scenes. This is the first scene whose subject *is*
the third dimension, and the camera's fixed 35° elevation already reads stacked cubes
well.

**Implementation notes.** Stacking uses the existing `hoverCells` +
`occupiesCell: false` combination (a lifted cube shares its ground cell). The runtime
needs nothing new, but the scene must manage one invariant itself: only the top cube of
a stack may move. `viewOffsetY` should be raised slightly so a five-high tower stays
framed.

**Abstract meaning:** Accumulation is sequential and so is its undoing — what was added
last must leave first, and rebuilding reverses history.

## P3. Scale Shift (`ScaleShiftScene`)

**Tags:** `hierarchy`, `emergence`

**Recommended first.**

The camera starts close, on a single compact group of three or four cubes going about a
small local routine — a slow rotation of positions, the kind of movement several
existing scenes perform. It looks like a complete scene. Then the camera zooms out and
the grid fade radii widen, and the frame reveals that this group is one of *nine*, and
that the nine groups themselves are arranged into a larger figure — one of the symbol
formations (arrow, frame, cross...) drawn at group scale.

At the wide view the groups' local movements read as texture, and the macro-figure
slowly reorganises: groups travel as units (their members moving in loose formation) to
form a different symbol. The camera then descends onto a *different* group, which
resumes its local routine, and the cycle repeats. The symbol never repeats twice in a
row.

**Why it is new.** The five scenes with animated zoom use it as emphasis on a single
level of action. Here the zoom *is* the content: the same configuration is orderly at
one scale and invisible at another. No existing scene has two levels of organisation.

**Implementation notes.** The heaviest of the three recommended scenes: ~30 cubes and a
zoom range wider than any current scene (roughly 0.6–1.6), which needs the largest grid
in the collection (`gridCellCount` ≈ 27–31, cell size ≈ 0.03). Formations come from the
shape library extracted per [render.v2.md](render.v2.md) § III.4; camera motion goes
through the presentation controller. Group-as-unit travel is a `stagger` of ordinary
`moveCubeTo` calls per member.

**Abstract meaning:** Organisation has levels; the order of the whole is invisible from
inside any of its parts, and only a change of scale reveals it.

## P4. Trail (`TrailScene`)

**Tags:** `communication`, `environment`

A pioneer cube crosses the grid from edge to edge along a winding route around two or
three obstacle cubes. As it moves, it leaves a mark in every cell it exits: a
non-occupying ghost cube at ~0.25 opacity. Each mark immediately begins a slow fade to
zero over several seconds — the trail is evaporating from the moment it is laid.

Follower cubes enter at intervals behind the pioneer. A follower with a fresh trail in
front of it moves briskly, cell to cell along the marks; where the trail has already
evaporated it slows down and re-derives the route hesitantly (short pauses, an
occasional one-cell wrong turn that it undoes). Early followers therefore glide; late
ones struggle. When a follower walks a cell, its mark is refreshed to full trail
opacity — a used path stays alive, an unused one disappears.

**Why it is new.** `MemoryReplayScene` reconstructs a *private* memory as echoes;
`TrailingShadowScene` is a lagging double of one cube. Here the memory is *external and
shared* — written into the environment, readable by strangers, and decaying unless
maintained. Stigmergy has no existing scene.

**Implementation notes.** Ghost marks are `occupiesCell: false` cubes with no labels,
created and removed per cell; the geometry cache (one shared shape) makes their churn
cheap. Trail freshness is a per-cell timestamp in scene state; `fadeCubeTo` handles the
evaporation.

**Abstract meaning:** The environment itself can carry messages — a path exists only as
long as someone keeps walking it.

## P5. Passing the Name (`PassedNameScene`)

**Tags:** `identity`, `inheritance`

One cube carries a distinct face label — a single symbol, say `Λ` — on all faces, and
walks a long patrol circuit near the grid's edge. With each completed lap it dims a
step: 1.0, 0.8, 0.6... Its movement also slows slightly. When it reaches the ground of
~0.4 opacity, a fresh unlabelled cube enters from the nearest transparent edge and walks
to meet it.

The handover is the scene's centre: the two stand adjacent, the old cube's label fades
off its faces while the same label fades in on the newcomer's faces (both via
`setCubeFaceLabels` on faces hidden and shown — or simply cross-faded), the old cube
then exits through the edge and vanishes, and the newcomer — now at full opacity and
full speed — continues the *same* circuit from the same point. The label is the only
thing that survives.

**Why it is new.** `GuardChangeScene` is about a *post* outliving its holders — a
position in space. This scene is about a *sign* outliving its carriers: the identity is
portable, transferred explicitly, and the circuit continues under the same name in a
different body. It is also only the second scene ever to change face labels at runtime.

**Implementation notes.** `setCubeFaceLabels` exists on the runtime; the label
cross-fade needs no new API (labels inherit cube opacity via `setOpacity`, so the
handover can be staged with two brief `fadeCubeTo` dips). Everything else is standard
pathfinding movement.

**Abstract meaning:** A name outlives its bearer — identity persists by being handed
on, not by any carrier lasting.

## P6. Gear Train (`GearTrainScene`)

**Tags:** `causation`, `coupling`

Five cubes stand in a row, one empty cell between neighbours, each floating one cell
above the grid like `FlippingCubeScene`. The leftmost cube begins a quarter-turn roll in
place. The moment its rotation passes the halfway point, its neighbour begins the
*opposite* quarter-turn, and so on down the row — a wave of alternating rotations runs
left to right with a mechanical, meshed-gears feel. At the end of the row the wave
reflects and runs back.

Occasionally one middle cube "jams": it stays still when its turn comes. The wave dies
there — cubes past the jam never move — making the dependency visible by its absence.
After two failed waves the jammed cube does an apologetic catch-up double-turn, and full
transmission resumes.

**Why it is new.** Rotation appears in only four scenes, always as one cube's own
behaviour (`FlippingCube`, `Vll`, `Polarity`) or a falling topple (`DominoRing` — which
is gravity, not coupling, and never reverses). Here rotation is *transmitted*, phase
matters, alternation matters, and the jam demonstrates the coupling. `SignalRelayScene`
passes an opacity pulse; this passes motion.

**Implementation notes.** Reuses the face-rotation machinery of
[FaceFlipCubeScene](src/scenes/FaceFlipCubeScene.tsx). The wave timing is plain script
sequencing; no runtime changes.

**Abstract meaning:** In a coupled system motion is transmitted, inverted, and
reflected — and one stuck element silences everything beyond it.

## P7. Shadow of Danger (`DangerShadowScene`)

**Tags:** `fear`, `proximity`

Eight cubes are spread over the middle of the grid, each cycling through small
unhurried errands — a step or two, a pause. A ninth cube patrols a slow rectangular
circuit around them, slightly outside the group, never entering it and never touching
anyone.

Each errand cube reacts only to distance: when the patroller comes within a few cells,
the cube freezes mid-errand and dims to ~0.55; when the patroller recedes, it brightens
and resumes exactly where it stopped. Since the patrol is a loop, a wave of stillness
and dimness continuously sweeps around the group, tracking the patroller like a shadow.
Nothing is ever chased, caught, or displaced.

**Why it is new.** Proximity reaction exists in five scenes, always positively —
approach *reveals* (`EncounterCube`, `MovingGrid`) or teaches (`LearnedRhythm`). This
inverts it: presence alone *suppresses* behaviour. There is no pursuit scene and no
threat scene in the collection.

**Implementation notes.** Pure existing API: `getGridDistance` against the patroller's
position each frame, `fadeCubeTo` for the dim, and the script runner pausing each cube's
errand loop. The freeze must interrupt an in-flight `moveCubeTo` gracefully — simplest
is to move in single-cell steps and check the distance between steps.

**Abstract meaning:** A threat needs no contact to govern behaviour — its mere presence
reshapes what everyone around it does.

## P8. Bottleneck (`BottleneckScene`)

**Tags:** `throughput`, `self-organization`

A wall of cubes spans the grid vertically, with a single one-cell gap at its middle.
Cubes appear from the transparent left edge at random rows, at a rate the gap cannot
match, all needing to reach and exit the right edge. Approaching cubes converge on the
gap, and a crowd condenses in front of it — not a neat queue but a funnel-shaped
cluster, each cube advancing into whichever adjacent cell frees up, pressure visibly
propagating backward when the front stalls.

Cubes pass through the gap strictly one at a time, and on the far side the funnel
inverts: departures fan out to their own rows and accelerate away, so the right side is
always sparse while the left side is dense. Occasionally the arrival rate drops, the
crowd drains completely, and a lone cube sails through an empty gap — showing the same
system fluid and congested in one cycle.

**Why it is new.** `CrossingFlowsScene` coordinates two opposing flows with priority
rules; `CorridorDanceScene` is two cubes resolving mutual politeness; `ContinuousQueue`
is an orderly pre-formed line. None shows *congestion at a shared narrow resource* — a
crowd self-organising into throughput without any assigned order.

**Implementation notes.** The collision-safe pathfinding already produces most of the
funnel behaviour for free: cubes route around occupied cells and stall when boxed in.
The scene adds a simple arbiter for the gap cell (one reservation at a time) and tuned
spawn rates. Grid ≈ 15×15, azimuth 0° like the other flow scenes.

**Abstract meaning:** When many independent intentions share one narrow passage, order
appears on its own — as pressure, patience, and turn-taking that nobody designed.

---

## Priority and rationale

| # | Scene | New mechanic exercised | Runtime changes | Effort |
| --- | --- | --- | :-: | :-: |
| P1 | Contagion | 2D state wavefront | none | low |
| P2 | Tower | vertical stacking as subject | none | low |
| P3 | Scale Shift | zoom as content, two levels | none | high |
| P4 | Trail | environment as memory | none | medium |
| P5 | Passing the Name | runtime label transfer | none | low |
| P6 | Gear Train | transmitted rotation | none | medium |
| P7 | Shadow of Danger | negative proximity | none | low |
| P8 | Bottleneck | congestion at shared resource | none | medium |

The recommended first batch is **P1 Contagion, P2 Tower, P3 Scale Shift**: together they
introduce the three most visually novel mechanics (a spreading wavefront, the vertical
axis, zoom as subject) while requiring no runtime API additions at all. P3 is the most
expensive of the three and benefits most from the shape library and choreography helpers
proposed in [render.v2.md](render.v2.md) § III.4, so if the SDK work lands first, P3
gets cheaper.

Whenever any of these are implemented, they should be added to [SCENES.md](SCENES.md)
and [SCENE-FEATURES.md](SCENE-FEATURES.md) in the established format — along with the
eight currently undocumented scenes, which are missing from both documents today.
