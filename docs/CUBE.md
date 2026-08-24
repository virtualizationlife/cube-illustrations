# CUBE — Character on the Map

## Overview

Cube is the player's physical presence on the world map. It represents the player's current position, direction, emotional state, and progress through the world.

Cube should not feel like a static map marker or an interface cursor. Even when the player is inactive, it behaves like a small living character: it observes the environment, reacts to nearby events, remembers previous encounters, and expresses intention through movement.

The map and Cube form one responsive system. Cube changes because of the world, and the world changes because Cube has moved through it.

Primary scene references:

- [Moving World](SCENES.md#1-moving-world-movinggridscene) for travel and navigation;
- [Main Cube](SCENES.md#5-main-cube-centeredcubescene) for identity and visual focus;
- [Discovery](SCENES.md#3-discovery-encountercubescene) for exploration and perception;
- [Changing Faces](SCENES.md#2-changing-faces-flippingcubescene) for expression and transformation.

---

## Character Role

Cube connects the player, the map, and the events that happen within the world.

Its main responsibilities are:

- showing the player's current position;
- indicating a chosen direction or destination;
- moving between map locations;
- reacting to terrain, obstacles, and other entities;
- introducing new locations and points of interest;
- transitioning from the map into gameplay events;
- reflecting the player's current condition and progress;
- preserving traces of previous journeys, choices, and relationships.

Cube remains the visual and narrative focus of the map experience. Other objects may enter, leave, assemble, or transform, but the player should always understand which entity represents them.

Scene references: [Main Cube](SCENES.md#5-main-cube-centeredcubescene), [VLL Cube](SCENES.md#7-vll-cube-vllcubescene), and [Moving World](SCENES.md#1-moving-world-movinggridscene).

---

## Map Arrival

When Cube first appears on the map, the scene should establish its relationship with the world.

Cube may enter from a faded edge, emerge from a transition, fall onto the grid, or become visible as the camera reveals the map. After arriving, it pauses briefly and observes its surroundings before entering an idle state.

The arrival should communicate:

- where the player is;
- which routes are currently visible;
- whether the location is familiar or unknown;
- which objects or entities are nearby;
- what the next meaningful destination might be.

The entrance and exit language is demonstrated by [Main Cube](SCENES.md#5-main-cube-centeredcubescene), [Crossing Flows](SCENES.md#10-crossing-flows-crossingflowsscene), and [Learned Detour](SCENES.md#11-learned-detour-learneddetourscene).

---

## Idle Behavior

While waiting for player input, Cube should remain subtly animated. The movement should add personality without distracting from navigation or competing with important map events.

Possible idle actions include:

- gently rocking between its edges;
- briefly lifting or rotating to reveal another face;
- looking or leaning toward a nearby point of interest;
- reacting to ambient movement around it;
- making a small impatient hop;
- examining the path ahead and returning to rest.

Idle behavior may change with context. A safe location produces calm movement, while an unknown or dangerous location produces shorter, more cautious reactions.

Scene references: [Changing Faces](SCENES.md#2-changing-faces-flippingcubescene) and [VLL Cube](SCENES.md#7-vll-cube-vllcubescene).

---

## Route Selection

When the player selects a destination, Cube reacts before movement begins. This short anticipation makes the choice feel intentional rather than mechanical.

Cube may:

- rotate or lean toward the selected path;
- inspect an uncertain route;
- become more energetic when a new location is selected;
- hesitate when the route contains a known danger;
- refuse a route that is unavailable;
- preview more than one possible path before committing.

The selected route can respond by glowing, unfolding, increasing in opacity, or visually connecting itself to Cube.

Scene references: [Predicted Paths](SCENES.md#16-predicted-paths-predictedpathsscene), [Repeated Preference](SCENES.md#15-repeated-preference-preferencechoicescene), and [Becoming a Sign](SCENES.md#20-becoming-a-sign-becomingsignscene).

---

## Travel

Cube's movement should feel physical, readable, and connected to the map surface. It may roll from one face to another, slide between cells, make short jumps, or remain visually centered while the world moves beneath it.

The project already supports two useful frames of reference:

1. **Cube moves through a fixed world.** The grid remains stable while Cube travels between cells.
2. **The world moves around Cube.** Cube stays at the visual center while the grid moves beneath it, preserving the character as the main point of attention.

The five focused movement scenes establish a compact vocabulary: roll one cell around the leading
lower edge, slide one cell without rotating, jump over one cell, rise and stride two cells above the
surface, or dissolve into a successor at another nearby cell. The last option uses a concurrent
fade-out/fade-in, followed by a transfer of visual focus.

Different routes can produce different movement qualities:

- a normal road creates steady, even movement;
- rough terrain produces heavier steps or imperfect landings;
- a downhill route increases speed and momentum;
- a broken path requires jumps or temporary supports;
- a dangerous area creates slower, more cautious movement;
- a special path may temporarily change Cube's orientation or movement rules.

Scene references: [Rolling Cube](SCENES.md#41-rolling-cube-rollingcubescene), [Sliding Cube](SCENES.md#42-sliding-cube-slidingcubescene), [Jumping Cube](SCENES.md#43-jumping-cube-jumpingcubescene), [Raised Stride](SCENES.md#44-raised-stride-raisedstridecubescene), [Dissolving Transfer](SCENES.md#45-dissolving-transfer-teleportingcubescene), [Moving World](SCENES.md#1-moving-world-movinggridscene), [Discovery](SCENES.md#3-discovery-encountercubescene), [Moving Bridge](SCENES.md#19-moving-bridge-movingbridgescene), and [Shared Load](SCENES.md#23-shared-load-sharedloadscene).

---

## Encounters and Discovery

Travel reveals other entities and makes previously unnoticed parts of the world meaningful.

An encountered object can begin as a faint or ambiguous presence. As Cube approaches, it becomes more visible and easier to understand. Cube may slow down, orient itself toward the object, circle it, wait beside it, or continue with the object as a temporary companion.

Discovery is therefore not only the appearance of a new object. It is a change in the relationship between Cube and the world.

Scene references: [Discovery](SCENES.md#3-discovery-encountercubescene), [Moving World](SCENES.md#1-moving-world-movinggridscene), and [Reuniting Pair](SCENES.md#14-reuniting-pair-reunitingpairscene).

---

## Obstacles

Obstacles interrupt expected movement and give Cube an opportunity to express character.

Cube may:

- bump into a blocked route;
- stop at the edge of a gap;
- test more than one possible detour;
- lose balance and recover;
- wait for another moving entity to pass;
- search for an alternative direction;
- ask the player for help through animation.

An obstacle should communicate why movement stopped and what can happen next. Repeated obstacles can also show that Cube learns: after discovering a successful detour, it should use that knowledge on a later journey until the world changes again.

Scene references: [Learned Detour](SCENES.md#11-learned-detour-learneddetourscene), [Predicted Paths](SCENES.md#16-predicted-paths-predictedpathsscene), and [Learned Rhythm](SCENES.md#17-learned-rhythm-learnedrhythmscene).

---

## Location Arrival

When Cube reaches a destination, the movement should clearly transition from travel into interaction.

The arrival animation may include:

- a final controlled movement into the location cell;
- a small landing impact;
- a celebratory hop;
- a curious inspection of the destination;
- activation or transformation of the map node;
- a camera adjustment that gives the location more importance;
- a transition into the associated gameplay scene.

Important locations should have distinctive arrival reactions. Returning to a known place may feel calm and efficient, while discovering a new place may produce a longer and more expressive pause.

Scene references: [Discovery](SCENES.md#3-discovery-encountercubescene), [Repeated Preference](SCENES.md#15-repeated-preference-preferencechoicescene), and [Becoming a Sign](SCENES.md#20-becoming-a-sign-becomingsignscene).

---

## Rewards and Discoveries

Cube reacts to rewards as a character rather than as a passive container.

When receiving or activating something important, Cube may:

- glow or pulse;
- rise above the grid;
- rotate to reveal a new face;
- gain a temporary symbol;
- assemble with nearby cubes;
- trigger the appearance of a new path;
- briefly lose balance from excitement.

The surrounding map can respond at the same time by revealing routes, activating distant locations, or reorganizing existing elements into a meaningful form.

Scene references: [Changing Faces](SCENES.md#2-changing-faces-flippingcubescene), [Forming a Group](SCENES.md#6-forming-a-group-sevencubesscene), [Random Structure](SCENES.md#8-random-structure-structuremorphscene), and [Becoming a Sign](SCENES.md#20-becoming-a-sign-becomingsignscene).

---

## Failure and Recovery

Failure should temporarily affect Cube's behavior without making it feel permanently defeated.

Possible reactions include:

- landing on the wrong face;
- becoming dim, dusty, or visually unstable;
- pausing after an impact;
- moving more slowly for a short period;
- shaking off the failure;
- using a remembered route on the next attempt;
- accepting support from other cubes.

Recovery reinforces Cube's persistent and optimistic personality. The important narrative change is not damage itself, but what Cube remembers and does differently afterward.

Scene references: [Learned Detour](SCENES.md#11-learned-detour-learneddetourscene), [Memory Replay](SCENES.md#12-memory-replay-memoryreplayscene), [Boundary Repair](SCENES.md#13-boundary-repair-boundaryrepairscene), and [Dynamic Balance](SCENES.md#25-dynamic-balance-dynamicbalancescene).

---

## Memory, Learning, and Preference

Cube can carry simple internal state from one map event to the next. This makes repeated journeys feel connected rather than reset.

The map can reveal Cube's internal life through observable behavior:

- **Memory:** previous movement is replayed as translucent echoes.
- **Learning:** a known obstacle changes the route selected on the next attempt.
- **Prediction:** several possible future paths appear before the real movement begins.
- **Anticipation:** Cube observes another entity's rhythm and moves at the right moment.
- **Preference:** Cube follows a valued form even after that form changes position.
- **Valence:** Cube approaches one structure and avoids another.

Scene references: [Memory Replay](SCENES.md#12-memory-replay-memoryreplayscene), [Learned Detour](SCENES.md#11-learned-detour-learneddetourscene), [Predicted Paths](SCENES.md#16-predicted-paths-predictedpathsscene), [Learned Rhythm](SCENES.md#17-learned-rhythm-learnedrhythmscene), [Repeated Preference](SCENES.md#15-repeated-preference-preferencechoicescene), and [Valence Field](SCENES.md#18-valence-field-valencefieldscene).

---

## Relationships

Other cubes should not be treated only as decoration. Their movement can create temporary companionship, cooperation, conflict, waiting, separation, and reunion.

Cube may:

- travel beside another cube;
- wait for a slower companion;
- join or leave a group;
- yield to an opposing flow;
- pass a signal to another entity;
- rely on other cubes to build a route;
- help repair a damaged structure.

These behaviors allow the map to communicate social relationships without dialogue.

Scene references: [Reuniting Pair](SCENES.md#14-reuniting-pair-reunitingpairscene), [Forming a Group](SCENES.md#6-forming-a-group-sevencubesscene), [Crossing Flows](SCENES.md#10-crossing-flows-crossingflowsscene), [Signal Relay](SCENES.md#21-signal-relay-signalrelayscene), and [Shared Load](SCENES.md#23-shared-load-sharedloadscene).

---

## Personality

Cube is curious, persistent, expressive, and slightly naive.

It does not need dialogue to communicate. Its personality is expressed through:

- timing;
- orientation;
- balance;
- speed;
- hesitation;
- repetition;
- attention to other entities;
- small physical reactions;
- changes in behavior after experience.

The player should feel that they are travelling with Cube rather than moving an interface cursor.

---

## Visual Relationship with the Map

Cube must belong to the environment while remaining readable against different backgrounds. It should use the same geometric language and grid scale as the rest of the world, but retain enough contrast, motion priority, or face detail to remain identifiable.

The map can react to Cube through:

- highlighted routes;
- activated location nodes;
- opacity changes based on proximity;
- small environmental movements;
- camera and grid changes;
- light or shadow changes;
- particles or translucent echoes;
- a temporary trail showing recent travel;
- structures that assemble in response to Cube.

Cube and the map should feel like parts of the same responsive system rather than a character placed on top of a separate interface.

Scene references: [Discovery](SCENES.md#3-discovery-encountercubescene), [Predicted Paths](SCENES.md#16-predicted-paths-predictedpathsscene), [Valence Field](SCENES.md#18-valence-field-valencefieldscene), and [Becoming a Sign](SCENES.md#20-becoming-a-sign-becomingsignscene).

---

## Scene Reference Table

The table connects Cube's conceptual map behavior to scenes that already exist in the illustration system. These scenes are references for motion, composition, and meaning; they do not have to become literal game states one-to-one.

| Map moment                        | Existing scene                                                                | Component               | Cube behavior                                                 | Narrative purpose                                                   |
| --------------------------------- | ----------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Establish the protagonist         | [Main Cube](SCENES.md#5-main-cube-centeredcubescene)                          | `CenteredCubeScene`     | Remains central while other entities pass through the world   | Makes the player's identity visually unambiguous                    |
| Travel across the map             | [Moving World](SCENES.md#1-moving-world-movinggridscene)                      | `MovingGridScene`       | Stays centered while the grid moves beneath it                | Keeps Cube as the stable focus during navigation                    |
| Roll across a tile                | [Rolling Cube](SCENES.md#41-rolling-cube-rollingcubescene)                    | `RollingCubeScene`      | Pivots around the leading lower edge onto the adjacent cell   | Makes the grid step feel physical and weight-bearing                |
| Glide along a clear route         | [Sliding Cube](SCENES.md#42-sliding-cube-slidingcubescene)                    | `SlidingCubeScene`      | Translates exactly one cell without changing orientation      | Gives ordinary travel a clean, legible rhythm                       |
| Clear a gap                       | [Jumping Cube](SCENES.md#43-jumping-cube-jumpingcubescene)                    | `JumpingCubeScene`      | Arcs over one cell and lands on the following cell            | Makes a missing or unsafe tile readable as a discontinuity          |
| Cross raised terrain              | [Raised Stride](SCENES.md#44-raised-stride-raisedstridecubescene)             | `RaisedStrideCubeScene` | Rises one cell, travels two cells, then returns to the ground | Distinguishes an elevated passage from ordinary ground movement     |
| Relocate through transformation   | [Dissolving Transfer](SCENES.md#45-dissolving-transfer-teleportingcubescene)  | `TeleportingCubeScene`  | Crossfades with a nearby successor, then receives the focus   | Frames relocation as continuity of identity instead of a hard cut   |
| Express a changing state          | [Changing Faces](SCENES.md#2-changing-faces-flippingcubescene)                | `FlippingCubeScene`     | Rotates, rises, and reveals different faces                   | Shows mood, state, or transformation without dialogue               |
| Discover an object                | [Discovery](SCENES.md#3-discovery-encountercubescene)                         | `EncounterCubeScene`    | Approaches faint entities and makes them visible              | Turns proximity into perception and discovery                       |
| Enter or leave a populated world  | [Crossing Flows](SCENES.md#10-crossing-flows-crossingflowsscene)              | `CrossingFlowsScene`    | Moves among opposing traffic and yields when necessary        | Establishes that the map contains other independent actors          |
| Choose a preferred destination    | [Repeated Preference](SCENES.md#15-repeated-preference-preferencechoicescene) | `PreferenceChoiceScene` | Follows the same valued form after locations swap             | Shows stable intention rather than arbitrary movement               |
| Encounter a blocked route         | [Learned Detour](SCENES.md#11-learned-detour-learneddetourscene)              | `LearnedDetourScene`    | Stops, finds a detour, and remembers it                       | Connects failure with learning                                      |
| Preview possible paths            | [Predicted Paths](SCENES.md#16-predicted-paths-predictedpathsscene)           | `PredictedPathsScene`   | Tests several ghost routes before moving                      | Makes route selection and planning visible                          |
| Anticipate another entity         | [Learned Rhythm](SCENES.md#17-learned-rhythm-learnedrhythmscene)              | `LearnedRhythmScene`    | Observes a crossing rhythm and moves during an opening        | Shows attention, timing, and anticipation                           |
| Remember a journey                | [Memory Replay](SCENES.md#12-memory-replay-memoryreplayscene)                 | `MemoryReplayScene`     | Leaves translucent echoes along a previous route              | Gives past movement a visible presence                              |
| Travel with a companion           | [Reuniting Pair](SCENES.md#14-reuniting-pair-reunitingpairscene)              | `ReunitingPairScene`    | Separates, waits, reunites, and resumes movement              | Represents continuity in a relationship                             |
| Join a group                      | [Forming a Group](SCENES.md#6-forming-a-group-sevencubesscene)                | `SevenCubesScene`       | Moves from a scattered position into a connected form         | Shows belonging without erasing individuality                       |
| Receive help crossing             | [Moving Bridge](SCENES.md#19-moving-bridge-movingbridgescene)                 | `MovingBridgeScene`     | Advances as limited supports move into place                  | Frames progress as dependence on available resources                |
| Cooperate with others             | [Shared Load](SCENES.md#23-shared-load-sharedloadscene)                       | `SharedLoadScene`       | Waits while supporting cubes prepare the next step            | Makes cooperation and synchronization readable                      |
| React positively or negatively    | [Valence Field](SCENES.md#18-valence-field-valencefieldscene)                 | `ValenceFieldScene`     | Approaches one form and avoids another                        | Externalizes attraction, caution, and emotional value               |
| Repair after disruption           | [Boundary Repair](SCENES.md#13-boundary-repair-boundaryrepairscene)           | `BoundaryRepairScene`   | Participates in or observes restoration of a boundary         | Shows recovery as an active system behavior                         |
| Maintain stability through change | [Dynamic Balance](SCENES.md#25-dynamic-balance-dynamicbalancescene)           | `DynamicBalanceScene`   | Remains part of a structure that continuously redistributes   | Presents stability as adaptation rather than immobility             |
| Read a sign in the world          | [Becoming a Sign](SCENES.md#20-becoming-a-sign-becomingsignscene)             | `BecomingSignScene`     | Responds to a symbol assembled by other cubes                 | Connects environmental form with meaningful action                  |
| Carry or receive information      | [Signal Relay](SCENES.md#21-signal-relay-signalrelayscene)                    | `SignalRelayScene`      | Becomes one temporary carrier in a moving signal              | Shows communication without text or speech                          |
| Reveal a distinct identity        | [VLL Cube](SCENES.md#7-vll-cube-vllcubescene)                                 | `VllCubeScene`          | Preserves visible face labels while hidden faces change       | Gives Cube a recognizable personal or brand identity                |
| React to the pointer              | [Cursor Repulsion](SCENES.md#cursor-repulsion-cursorrepulsionscene)           | `CursorRepulsionScene`  | Moves away from the approaching cursor and returns afterward  | Treats the player's pointer as a physical presence in the map world |

---

## Core Map Flow

A minimal narrative flow can be assembled from the existing scene language:

`Main Cube`  
→ `Moving World`  
→ `Predicted Paths` or `Repeated Preference`  
→ `Discovery`  
→ `Becoming a Sign`  
→ location or gameplay transition

An obstacle and recovery flow can use:

`Moving World`  
→ `Learned Detour`  
→ `Memory Replay`  
→ `Predicted Paths`  
→ resumed travel

A relationship flow can use:

`Discovery`  
→ `Reuniting Pair`  
→ `Shared Load`  
→ `Forming a Group`

---

## Design Principle

Every map action should answer at least one of these questions:

1. What does Cube want?
2. What does Cube notice?
3. What has Cube learned or remembered?
4. How does the world respond to Cube?
5. How does Cube's relationship with another entity change?

If an animation answers none of these questions, it is probably decorative rather than character-defining.

For the complete implementation-oriented catalogue, see [SCENES.md](SCENES.md). For a compact comparison of scene features, see [SCENE-FEATURES.md](SCENE-FEATURES.md).
