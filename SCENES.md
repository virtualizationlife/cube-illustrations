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

In the movement-based scenes, cubes slide between grid cells without rotating. The grid itself moves in `MovingGridScene`, keeping the main cube visually fixed in the viewport. `FlippingCubeScene` and `VllCubeScene` actively change cube orientation.

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
