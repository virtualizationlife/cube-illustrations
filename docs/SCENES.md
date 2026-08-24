# Cube Scenes

The scenes below are listed in the order in which they appear on the illustrations page. Their descriptions reflect the animation logic implemented in the code.

## 1. Moving World (`MovingGridScene`)

**Tags:** `space`, `navigation`

The main cube remains fixed at the center while the grid moves beneath it in random cardinal directions, creating the impression that the cube is traveling through the world.

Occasionally, another cube appears ahead. It begins invisible and gradually becomes visible as the main cube approaches. The movement pauses briefly when the two cubes meet. Most encountered cubes remain behind and fade away, but a randomly selected encounter may move behind the main cube and follow it for two, three, or four steps before separating.

**Abstract meaning:** A single entity remains at the center of attention as it moves through the world and encounters other entities along the way.

## 2. Changing Faces (`FlippingCubeScene`)

**Tags:** `form`, `transformation`

The cube floats one grid cell above the surface and periodically rotates to a new, randomly selected face. Most rotations retain the original one-second movement and two-second hold. Occasionally, the cube rapidly cycles through three to five different faces before stopping on one of them.

When the pointer hovers over the cube, it smoothly grows to 120% of its normal size. It returns to its original size when the pointer leaves.

**Abstract meaning:** An entity changes, reveals its different sides, and becomes more prominent in response to attention.

## 3. Discovery (`EncounterCubeScene`)

**Tags:** `space`, `perception`

The grid is a closed territory of 11 by 11 cells: it keeps full strength up to its border instead of fading away, so the limits of the space are visible. The main cube continuously follows a fixed, looping route that stays one cell inside that border. Three additional cubes are placed at random positions inside the territory and initially appear with low opacity.

As the main cube approaches one of them, that cube becomes brighter and eventually fully visible. It fades back toward its initial opacity as the main cube moves away. The scene represents exploration and the discovery of other objects within a bounded territory.

**Abstract meaning:** As an entity follows its path, it discovers what previously remained unnoticed.

## 4. Three Cubes (`ThreeCubesScene`)

**Tags:** `relation`, `structure`

Three identical cubes stand motionless in a straight row. One empty grid cell separates each pair of neighboring cubes.

There is no movement animation in this scene. It is a static composition representing a small, evenly spaced group.

**Abstract meaning:** Several equal entities form an ordered group while retaining their independence.

## 5. Main Cube (`CenteredCubeScene`)

**Tags:** `identity`, `focus`

A primary cube remains motionless at the exact center of the grid. At random intervals, a group of one, two, or three translucent cubes enters independently from randomly selected sides of the grid. They move slowly in steps of one, two, or three cells. Most continue across the scene, while some make a single random 90-degree turn and leave through a different side.

**Abstract meaning:** One primary entity stands at the center of attention and represents the foundation of the entire system.

## 6. Forming a Group (`SevenCubesScene`)

**Tags:** `relation`, `organization`

Seven cubes begin scattered across a large grid. After a short pause, six randomly selected cubes move toward the center one at a time and assemble into a compact, connected group. The remaining cube arrives late and waits beside them. The existing group then rearranges itself to include the late arrival in a new seven-cube form.

During each turn, a cube travels between one and three grid cells. Collision-safe pathfinding prevents cubes from occupying or crossing the same cell. Once the complete group has formed, it remains together briefly. The cubes then move one at a time back to their original scattered positions.

The cycle repeats continuously, and a new connected group shape is generated for every gathering phase.

**Abstract meaning:** Scattered entities unite into a whole and then become independent again.

## 7. VLL Cube (`VllCubeScene`)

**Tags:** `identity`, `symbol`

A cube begins at the center with `V`, `L`, and `L` displayed on its three visible faces. For every rotation, it smoothly rises by one grid cell and settles back onto the grid. After landing, only the three faces hidden from the camera receive new distinct random letters; the visible letters remain unchanged until those faces later turn away.

**Abstract meaning:** An entity becomes the bearer of a distinct identity, idea, or brand.

## 8. Random Structure (`StructureMorphScene`)

**Tags:** `form`, `reconfiguration`

Sixteen equal-sized cubes repeatedly rearrange into a randomly selected form. The available forms include a solid square, a hollow frame, two parallel lines, four separate blocks, and a zigzag. A random cube initiates every transformation, after which nearby cubes move in spatial order like a chain reaction. The next form is always different from the current one, and the cubes move between cells without colliding.

**Abstract meaning:** A system can preserve all of its parts while reorganizing its internal structure for different purposes.

## 9. Continuous Queue (`ContinuousQueueScene`)

**Tags:** `continuity`, `renewal`

Six evenly spaced cubes form a queue that runs diagonally toward the lower-left area of the frame. The leading cube leaves through the faded edge and then reappears translucently beside the still-occupied tail as an early arrival. While it waits, every element in the queue advances by two grid cells, one at a time, preserving one empty cell between neighbors. Only after the last element has moved does the waiting cube enter the newly opened tail position.

**Abstract meaning:** A continuously moving process makes room for new participants without stopping to accept them.

## 10. Crossing Flows (`CrossingFlowsScene`)

**Tags:** `relation`, `coordination`

Cubes appear at random intervals in the fully transparent zones on the left and right edges of a 10-by-10 grid. They become visible as they enter, travel toward the opposite side, and fade out when leaving. Individual head-on conflicts are resolved by a temporary neighboring lane. When traffic becomes dense, one entire direction receives priority for several movements while the opposing flow waits or yields; the priority direction alternates the next time congestion occurs.

**Abstract meaning:** Independent flows can share the same space when the system resolves conflicts and coordinates priority.

## Movement Notes

Most movement-based scenes slide between grid cells without rotating. `RollingCubeScene` instead
turns around its lower edge, while `JumpingCubeScene` and `RaisedStrideCubeScene` rise above the
grid. The grid itself moves in `MovingGridScene`, keeping the main cube visually fixed in the
viewport; the five focused movement scenes use traveling grid focus to keep the active cube central.
`FlippingCubeScene` and `VllCubeScene` actively change cube orientation.

## Additional Scenes

The following five scenes are a separate addition focused on memory, learning, maintenance, relationships, and preference.

### 11. Learned Detour (`LearnedDetourScene`)

**Tags:** `mind`, `learning`

A cube emerges from the fully transparent left edge, moves directly toward its destination, and stops when it reaches a three-cube barrier. It discovers an open route and disappears through the fully transparent right edge. On its next arrival it uses the learned detour without hesitation. After two successful journeys, the barrier changes position and blocks that route, forcing the cube to learn the opposite detour. Every journey begins and ends outside the visible area while the barrier continues alternating.

**Abstract meaning:** Experience changes future behavior, allowing an entity to avoid a known failure and act more efficiently.

### 12. Memory Replay (`MemoryReplayScene`)

**Tags:** `mind`, `memory`

A cube completes a multi-turn journey and then moves aside. Three increasingly translucent echo cubes enter the traveled route with a delay and move through the same positions in the same order. The echoes briefly pause at a significant position, continue the replay, and disappear one after another at the end of the remembered journey.

**Abstract meaning:** A past experience can be preserved and reconstructed as an ordered autobiographical memory.

### 13. Boundary Repair (`BoundaryRepairScene`)

**Tags:** `continuity`, `maintenance`

Eight cubes form a closed boundary around a central cube. An external cube enters from the faded edge, approaches one side of the boundary, and pushes a boundary cube outward. After the external cube retreats, between two and four nearby cubes shift around the perimeter to close the exposed gap. The displaced cube returns to the final vacant position and restores the complete boundary.

**Abstract meaning:** A vulnerable system maintains itself by redistributing its parts and repairing damage to its protective structure.

### 14. Reuniting Pair (`ReunitingPairScene`)

**Tags:** `continuity`, `relationship`

Two cubes travel together until a barrier forces them onto routes of different lengths. The cube taking the shorter path reaches the meeting point first and waits while its partner finishes the longer route. They resume synchronized movement only after both have arrived. On the return journey, their roles reverse, so each cube waits for the other in turn.

**Abstract meaning:** A relationship can preserve its continuity even when its participants temporarily follow different paths.

### 15. Repeated Preference (`PreferenceChoiceScene`)

**Tags:** `mind`, `preference`

A four-cube frame and a four-cube line define two destinations on opposite sides of the grid. The moving cube consistently chooses the frame. After every choice, the two arrangements physically exchange sides while the main cube waits at a new starting position. The cube then follows the frame to its new location instead of returning to the same side.

**Abstract meaning:** A stable preference is revealed by following a valued property even when its spatial location changes.

## Dynamic Scenes

The following five scenes extend the collection with prediction, anticipation, valence, continuation, and meaning. Each scene has its own fixed grid scale, and every multi-cube composition uses cubes whose size matches one grid cell. During the animation, camera zoom, grid opacity, and the grid's visible fade radius change with the current phase, while the cubes themselves never change size.

### 16. Predicted Paths (`PredictedPathsScene`)

**Tags:** `world`, `prediction`

A cube emerges from the transparent left edge and stops before a changing arrangement of obstacles. Three translucent versions of the cube branch out and test different possible routes. The unsuccessful predictions fade away when they reach a dead end, while the successful route remains visible as a short trail. The camera moves closer as the solid cube follows that route and leaves through the transparent right edge. On the next cycle, the obstacles and the correct route change.

**Abstract meaning:** An entity builds a model of several possible futures, rejects the ones that fail, and uses the successful prediction to guide its real action.

### 17. Learned Rhythm (`LearnedRhythmScene`)

**Tags:** `others`, `anticipation`

One cube crosses the grid horizontally while another repeatedly moves through the same intersection vertically. At first they arrive together, forcing the horizontal cube to stop. It then watches one or two passes, recognizes the interval between them, and crosses during the next opening. The rhythm changes between cycles, so the cube must observe and learn again rather than repeat a fixed delay.

**Abstract meaning:** Understanding another entity means learning the timing of its behavior and acting in anticipation of what it will do next.

### 18. Valence Field (`ValenceFieldScene`)

**Tags:** `valence`, `behavior`

A moving cube encounters two arrangements: an open frame and a straight line. It approaches the frame, circles it, and remains close, but slows down, turns away, and increases its distance when it reaches the line. The two arrangements exchange sides between cycles, demonstrating that the response belongs to their form rather than to a location. The view contracts around attraction and expands during avoidance.

**Abstract meaning:** Positive and negative value give otherwise neutral things an attractive or repulsive force that directly shapes behavior.

### 19. Moving Bridge (`MovingBridgeScene`)

**Tags:** `continuation`, `resources`

A central cube advances along two parallel rows of supporting cubes. Because the supply is finite, the last pair of supports continually travels around the moving cube and becomes the next pair in front of it. On every fourth transfer, one support arrives late: the traveler pauses over the incomplete bridge, the camera closes in, and movement resumes only when the missing support reaches its place.

**Abstract meaning:** Continuation depends on repeatedly moving limited resources from what has already been completed to what must exist next.

### 20. Becoming a Sign (`BecomingSignScene`)

**Tags:** `meaning`, `symbol`

Nine scattered cubes appear to be unrelated until they assemble into one of twelve randomly selected symbols: an arrow, chevron, plus, cross, diamond, frame, exclamation mark, lightning bolt, fork, spiral, gate, or pause sign. The same symbol never appears twice in succession, and every form can be rotated in a random direction. As the camera pulls back, a separate cube enters from a transparent edge, responds to the sign, and disappears through the corresponding edge. The symbol then dissolves back into scattered parts before another one forms.

**Abstract meaning:** Separate elements acquire meaning when their arrangement becomes a shared sign capable of directing another entity's action.

## New Phenomena

The following five scenes focus on communication, collective coordination, cooperation, phase transitions, and self-maintaining balance. Every cube remains the same size as one grid cell throughout each animation.

### 21. Signal Relay (`SignalRelayScene`)

**Tags:** `communication`, `continuity`

Nine cubes form a continuous line across the grid. A brief opacity pulse travels from one cube to the next, making the signal visibly independent from any single carrier. After the pulse reaches the end, the first cube fades through the transparent left edge, the remaining cubes advance one cell at a time, and the departed cube reappears from the transparent right edge to complete the renewed chain.

**Abstract meaning:** Information can continue to exist by moving between temporary carriers.

### 22. Collective Current (`CollectiveCurrentScene`)

**Tags:** `coordination`, `emergence`

Twelve scattered cubes initially take independent one-cell steps in random cardinal directions. A randomly selected cube then pulses and establishes a direction. The other cubes progressively take repeated steps in that same direction, producing a temporary collective current. The alignment eventually dissolves into independent movement before a different cube initiates another direction.

**Abstract meaning:** Collective order can emerge from local influence without a permanent leader or fixed global plan.

### 23. Shared Load (`SharedLoadScene`)

**Tags:** `cooperation`, `resources`

A raised cube advances between two rows of supporting cubes. After every step, one rear support travels around the structure to the front, followed separately by a support from the opposite row. The load waits until both individual transfers are complete and then advances again while the grid follows its continuing journey.

**Abstract meaning:** Limited resources can sustain a shared task when participants repeatedly give up completed positions to prepare what is needed next.

### 24. Phase Change (`PhaseChangeScene`)

**Tags:** `adaptation`, `organization`

Twelve cubes begin widely scattered around a large grid. A different random target cell becomes the seed of each cycle, and the cubes approach it one at a time in an expanding spatial order until they form a compact three-by-four crystal. After a pause, the cubes leave in random order and return to separated positions around the transparent perimeter before another crystal forms.

**Abstract meaning:** The same collection can alternate between independent freedom and collective order as its governing conditions change.

### 25. Dynamic Balance (`DynamicBalanceScene`)

**Tags:** `maintenance`, `stability`

A central cube and seven surrounding cubes form a compact group with one vacant boundary cell. A translucent cube arrives from the faded edge and fills the vacancy. The cube on the opposite side then leaves and becomes the next incoming participant, while one to three remaining cubes move around the perimeter to redistribute the empty position before the next arrival.

**Abstract meaning:** Stability is an ongoing achievement produced through exchange and internal redistribution rather than complete immobility.

## Coupled Phenomena

The following eight scenes focus on synchrony, delayed self, orientation, succession, mutual yielding, causal loops, scarce time, and residual avoidance.

### 26. Two Metronomes (`MetronomePairScene`)

**Tags:** `rhythm`, `synchrony`

Two cubes swing toward and away from the center on opposite sides of a shared row, like pendulums. They begin with different periods and a phase offset. Each swing pulls the neighbour's period and phase toward its own. After they stay in sync for several swings, they snap back to the original mismatched tempos and the coupling starts again.

**Abstract meaning:** Separate rhythms can lock into one tempo through repeated local influence, then fall back into difference.

### 27. Trailing Shadow (`TrailingShadowScene`)

**Tags:** `self`, `delay`

A solid cube walks a repeating path of legs along a row. A translucent double on a parallel row is always one cell behind: it only enters the cell the walker has just left. When the walker pauses, the shadow catches up, brightens, then fades back to its lagging opacity before the next leg. After a reversal the shadow briefly travels the wrong way, because it is still completing the abandoned step.

**Abstract meaning:** A delayed copy of the self reconstructs the recent past and only aligns when action stops.

### 28. Polarity (`PolarityScene`)

**Tags:** `relation`, `orientation`

Two cubes share a row. While they are rotationally aligned, the moving cube drifts in, then snaps into contact and holds. A quarter-turn of the same cube reverses the relation: the pair breaks apart and the mover retreats to a distant cell. The cycle repeats, so attraction and repulsion belong only to orientation, not to identity or distance.

**Abstract meaning:** The same pair can attract or repel depending solely on how one of them is turned.

### 29. Changing of the Guard (`GuardChangeScene`)

**Tags:** `continuity`, `handover`

One cube occupies a central post. Relief arrives from a transparent edge. On odd handovers the newcomer waits beside the post until the occupant leaves through the opposite edge, then steps into place. On even handovers the post is left empty for a beat: the view loosens, then the relief takes the vacant center. The departed cube becomes the next relief, so the post outlives every holder.

**Abstract meaning:** An office can continue across overlapping succession or a brief vacancy; the role is more durable than any occupant.

### 30. Corridor Dance (`CorridorDanceScene`)

**Tags:** `relation`, `symmetry`

Two cubes enter a corridor from opposite transparent edges and stop face to face. They sidestep together — the same way, three times — and return to the corridor, remaining blocked. The deadlock ends only when one cube stops mirroring and holds still; the other then takes the bypass, they pass, fade out through the far edges, and return from swapped entries.

**Abstract meaning:** Perfect mutual politeness can prevent progress until one participant stops matching the other.

### 31. Domino Ring (`DominoRingScene`)

**Tags:** `causality`, `recurrence`

Twelve cubes form a closed ring. A toppling wave travels around it: each cube falls a quarter-turn outward onto the neighbouring empty cell, holds, then rises. Because the wave returns to its start, the cause never runs out of effects. The cubes do not slide between cells; they rotate around an outer lower edge so each fall lands on a real grid tile.

**Abstract meaning:** In a closed causal loop, an effect becomes the next cause and the sequence has no final cube.

### 32. Thinning Clock (`ThinningClockScene`)

**Tags:** `time`, `scarcity`

A hand cube circles a twelve-cube dial, pausing at each remaining mark. After every lap it extinguishes the last two marks it passed, and the beat of the next lap is shorter. When only two marks remain, the dial refills and the tempo returns to the start. Each circuit is therefore poorer and faster than the one before until time is restored.

**Abstract meaning:** As the marks of time dwindle, each remaining interval has to carry more, until the measure itself is renewed.

### 33. Remembered Threshold (`RememberedThresholdScene`)

**Tags:** `mind`, `residue`

A cube enters a corridor from a transparent edge and meets a real obstacle once, stepping around it. The obstacle then vanishes, but the cube continues the detour with shrinking hesitation. On a later pass the camera tightens as the cube finally occupies the empty cell, after which the detour ends. The threshold then appears in a different column and the residue is learned again.

**Abstract meaning:** Avoidance can outlive the obstacle that taught it, until the remembered cell is tested and found empty.

## Narrative and Ontology

The following five scenes extend the collection with nested frames, divergent biography, partner recognition, embodied energy, and scale containment.

### 34. Recursive Frame (`RecursiveFrameScene`)

**Tags:** `ontology`, `continuity`, `reality`

Three nested square frames of translucent cubes surround a central cube. The central cube continuously travels around a fixed eight-step route. Periodically, the outermost frame expands and fades away, the middle frame moves outward, the inner frame shifts to the middle radius, and a renewed inner frame appears at the smallest radius. The cycle repeats indefinitely while the main cube never breaks its path.

**Abstract meaning:** Reality can renew its outer layers while a continuous process persists unchanged at the center.

### 35. Nested Cube (`NestedCubeScene`)

**Tags:** `form`, `containment`

A translucent cube three grid cells wide rests on the ground at the center of the grid. Inside its volume, an opaque one-cell cube occupies the same grid position but is raised one cell above the floor, so it sits fully within the larger cube without touching the ground.

There is no movement animation in this scene. It is a static composition that contrasts outer scale with an elevated interior.

**Abstract meaning:** A whole can contain a distinct part that occupies the same place while remaining separate in scale and elevation.

### 36. History Split (`HistorySplitScene`)

**Tags:** `continuity`, `biography`, `comparison`

From the same starting point, the main cube relives three different journeys through a shared world of walls, gates, and moving actors. A translucent preview cube traces each route before the main cube follows it. After each journey, faint trace cubes mark the path taken. The scene ends by pulling the camera back to reveal all three histories simultaneously before the cycle begins again.

**Abstract meaning:** One unchanged world can produce multiple divergent biographies from the same origin.

### 37. Recognized Partner (`RecognizedPartnerScene`)

**Tags:** `identity`, `memory`, `relationship`

Two identical visitors approach a central cube from opposite sides. The first visitor performs a four-step paired dance with the central cube, leaving translucent memory cubes at each position. After both visitors swap places, the central cube follows the same routine with the second visitor but moves toward the remembered positions rather than mirroring the partner's steps.

**Abstract meaning:** Recognition persists as spatial memory even when two indistinguishable partners exchange places.

### 38. Anticipatory Return (`AnticipatoryReturnScene`)

**Tags:** `embodiment`, `energy`, `maintenance`

A main cube carries a trailing column of five energy cubes. On the first cycle it travels far outward, spending one energy cube at each step, and returns too late, fading to a failure echo. On the next cycle it turns back earlier while energy remains, recharges at a home dock, and completes the return successfully.

**Abstract meaning:** A body learns to turn back before its remaining resources can no longer reach home.

## Interactive Scenes

### 39. Cursor Repulsion (`CursorRepulsionScene`)

**Tags:** `interaction`, `avoidance`

Three cubes begin in the same evenly spaced row as `ThreeCubesScene`. The pointer creates a continuous repulsion field around itself: whenever it approaches a cube, that cube accelerates away from it. The response begins before direct hover, so the cursor feels like a physical presence in the scene rather than a binary trigger.

The cubes retain a small amount of inertia, avoid overlapping one another, and return smoothly to their original positions when the pointer moves away or leaves the scene. Their logical grid cells remain unchanged while temporary visual offsets produce the movement.

**Abstract meaning:** Independent entities preserve the memory of their shared arrangement while making space for an approaching outside presence.

## Comparative Transformations

### 40. Three States (`ThreeCubeStatesScene`)

**Tags:** `form`, `contrast`, `transformation`

Three equal cubes begin in a straight row and react independently to pointer attention. Hovering the left cube smoothly grows it to 116% of its original size, while hovering the right cube shrinks it to 84%. Both return to their normal scale when the pointer leaves.

Hovering the middle cube triggers a complete animation: it rises by one grid cell, makes three random quarter-turns, and returns smoothly to the grid. The X, Y, and Z axes are shuffled for every activation, while the direction of each turn is selected independently. The sequence therefore uses all three spatial planes without becoming predictable.

**Abstract meaning:** Equal entities can diverge through expansion, reduction, and the continuous discovery of new orientations.

## Focused Movement

These five scenes are a focused study of a single cube moving across an endless grid. The grid travels with the cube so it remains the visual centre of the scene.

### 41. Rolling Cube (`RollingCubeScene`)

**Tags:** `movement`, `rotation`

The cube advances one grid cell at a time by rotating around the lower edge that faces its direction of travel. The pivot edge remains on the grid through the turn, and the cube settles fully onto its next face before repeating.

### 42. Sliding Cube (`SlidingCubeScene`)

**Tags:** `movement`, `translation`

The cube glides directly forward by one adjacent grid cell, without changing orientation. Each short pause makes the discrete cell-by-cell rhythm visible before the next step.

### 43. Jumping Cube (`JumpingCubeScene`)

**Tags:** `movement`, `jump`

The cube follows a smooth arc over one grid cell and lands on the cell after it. It repeats the two-cell jump continuously while the view follows.

### 44. Raised Stride (`RaisedStrideCubeScene`)

**Tags:** `movement`, `elevation`

The cube rises one cell above the grid, travels forward by two cells at that height, and then lowers itself back to ground level. The full three-phase motion repeats as one continuous stride.

### 45. Dissolving Transfer (`TeleportingCubeScene`)

**Tags:** `movement`, `transparency`, `transition`

A successor cube is chosen at a random grid position within a five-cell radius. It fades in as the current cube fades out; the opacity transition lasts three seconds by default and can be changed with the `transparencyDuration` parameter. Once the crossfade completes, the camera moves to the successor and the former cube is removed before the next transfer.

## 46. World Grid (`WorldGridScene`)

**Tags:** `world`, `space`

An empty panoramic grid is shown in a viewport three times as wide and twice as tall as a regular scene. Its visible area is a softly fading rounded rectangle rather than the gallery's usual radial field. No cubes are present yet: this scene establishes the world-scale stage for a future composition.

## Proposed Scenes

The eight scenes below are design briefs, not implementations. They are absent from the gallery and from the package exports. Each description uses the same catalogue format as the scenes above so they can be copied into this list if they are built.

### P1. Contagion (`ContagionScene`)

**Tags:** `propagation`, `resilience`

Twelve to fourteen cubes stand scattered across a large grid, taking occasional independent one-cell steps, all at full opacity. At a random moment one cube ignites: it pulses and switches to a marked state. The state is contagious by proximity — every unmarked cube within a small radius of a marked one catches it after a short individual delay, so the mark spreads as a two-dimensional wavefront, fast through dense clusters and slower across gaps. Isolated cubes may escape entirely.

Once the wave exhausts itself, recovery runs the same way in reverse from the first-infected cube. A pause, a reshuffle of positions, and a new cycle starts from a different cube.

**Abstract meaning:** A state spreads through local contact alone, and the shape of the crowd — not any central decision — determines who is reached and who is spared.

### P2. Tower (`TowerScene`)

**Tags:** `accumulation`, `order`

Cubes arrive one at a time from the transparent edges, travel to a designated build cell, and stack: the first occupies the ground, the next settles one cell higher, up to a height of four or five. Each climb moves through adjacent cells and then up the tower's side before sliding onto the top.

When the tower is complete it holds for a beat, then is dismantled from the top. Each cube travels to a new build cell elsewhere, where the tower reassembles — the last-removed top cube ends up at the bottom of the new tower.

**Abstract meaning:** Accumulation is sequential and so is its undoing — what was added last must leave first, and rebuilding reverses history.

### P3. Scale Shift (`ScaleShiftScene`)

**Tags:** `hierarchy`, `emergence`

The camera starts close on a compact group of three or four cubes performing a small local routine. It looks like a complete scene. The camera then zooms out and the grid fade radii widen, revealing that this group is one of nine, and that the nine groups form a larger symbol.

At the wide view the groups' local movements read as texture, and the macro-figure reorganises as groups travel as units into a different symbol. The camera then descends onto a different group. The symbol never repeats twice in a row.

**Abstract meaning:** Organisation has levels; the order of the whole is invisible from inside any of its parts, and only a change of scale reveals it.

### P4. Trail (`TrailScene`)

**Tags:** `communication`, `environment`

A pioneer cube crosses the grid along a winding route around a few obstacle cubes, leaving a fading non-occupying ghost mark in every cell it exits. Follower cubes enter behind it. A follower with a fresh trail moves briskly along the marks; where the trail has evaporated it slows and re-derives the route hesitantly. Walking a cell refreshes its mark, so a used path stays alive and an unused one disappears.

**Abstract meaning:** The environment itself can carry messages — a path exists only as long as someone keeps walking it.

### P5. Passing the Name (`PassedNameScene`)

**Tags:** `identity`, `inheritance`

One cube carries a distinct face label on all faces and walks a long patrol circuit. With each completed lap it dims and slows. When it reaches a low opacity, a fresh unlabelled cube enters, meets it, and receives the same label while the old cube's label fades away. The old cube exits; the newcomer continues the same circuit from the same point.

**Abstract meaning:** A name outlives its bearer — identity persists by being handed on, not by any carrier lasting.

### P6. Gear Train (`GearTrainScene`)

**Tags:** `causation`, `coupling`

Five cubes stand in a row, one empty cell between neighbours, each floating one cell above the grid. The leftmost cube begins a quarter-turn roll. When its rotation passes halfway, its neighbour begins the opposite quarter-turn, and so on down the row. At the end the wave reflects and runs back.

Occasionally a middle cube jams and stays still. The wave dies there. After two failed waves the jammed cube performs a catch-up double-turn, and transmission resumes.

**Abstract meaning:** In a coupled system motion is transmitted, inverted, and reflected — and one stuck element silences everything beyond it.

### P7. Shadow of Danger (`DangerShadowScene`)

**Tags:** `fear`, `proximity`

Eight cubes cycle through small unhurried errands in the middle of the grid. A ninth cube patrols a slow rectangle around them without entering the group. When the patroller comes within a few cells, an errand cube freezes and dims; when the patroller recedes, it resumes exactly where it stopped. A wave of stillness continuously tracks the patroller. Nothing is chased, caught, or displaced.

**Abstract meaning:** A threat needs no contact to govern behaviour — its mere presence reshapes what everyone around it does.

### P8. Bottleneck (`BottleneckScene`)

**Tags:** `throughput`, `self-organization`

A wall of cubes spans the grid vertically, with a single one-cell gap at its middle. Cubes appear from the transparent left edge faster than the gap can pass them, all needing the right edge. They condense into a funnel-shaped crowd, each advancing into whichever adjacent cell frees up. Cubes pass the gap one at a time; on the far side they fan out and accelerate, so the right side stays sparse. Occasionally arrivals drop, the crowd drains, and a lone cube sails through an empty gap.

**Abstract meaning:** When many independent intentions share one narrow passage, order appears on its own — as pressure, patience, and turn-taking that nobody designed.
