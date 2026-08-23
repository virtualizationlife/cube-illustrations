# Scene Feature Matrix

A cross-reference of all 25 illustration scenes and the features they contain. Scenes are listed in
the order they appear on the illustrations page and in [SCENES.md](SCENES.md), which describes each
one in prose. This document is the compact view: what is inside every scene, marked feature by
feature.

## Legend

| Mark | Meaning |
| --- | --- |
| `●` | The feature is present and central to the scene |
| `◐` | The feature is present in a limited, occasional, or secondary form |
| `·` | The feature is absent |

Numeric and categorical columns give the actual value used in the component instead of a mark.

## 1. Identity

| # | Scene | Component | Set | Tags |
| --: | --- | --- | --- | --- |
| 1 | Moving World | `MovingGridScene` | Core | space, navigation |
| 2 | Changing Faces | `FlippingCubeScene` | Core | form, transformation |
| 3 | Discovery | `EncounterCubeScene` | Core | space, perception |
| 4 | Three Cubes | `ThreeCubesScene` | Core | relation, structure |
| 5 | Main Cube | `CenteredCubeScene` | Core | identity, focus |
| 6 | Forming a Group | `SevenCubesScene` | Core | relation, organization |
| 7 | VLL Cube | `VllCubeScene` | Core | identity, symbol |
| 8 | Random Structure | `StructureMorphScene` | Core | form, reconfiguration |
| 9 | Continuous Queue | `ContinuousQueueScene` | Core | continuity, renewal |
| 10 | Crossing Flows | `CrossingFlowsScene` | Core | relation, coordination |
| 11 | Learned Detour | `LearnedDetourScene` | Additional | mind, learning |
| 12 | Memory Replay | `MemoryReplayScene` | Additional | mind, memory |
| 13 | Boundary Repair | `BoundaryRepairScene` | Additional | continuity, maintenance |
| 14 | Reuniting Pair | `ReunitingPairScene` | Additional | continuity, relationship |
| 15 | Repeated Preference | `PreferenceChoiceScene` | Additional | mind, preference |
| 16 | Predicted Paths | `PredictedPathsScene` | Dynamic | world, prediction |
| 17 | Learned Rhythm | `LearnedRhythmScene` | Dynamic | others, anticipation |
| 18 | Valence Field | `ValenceFieldScene` | Dynamic | valence, behavior |
| 19 | Moving Bridge | `MovingBridgeScene` | Dynamic | continuation, resources |
| 20 | Becoming a Sign | `BecomingSignScene` | Dynamic | meaning, symbol |
| 21 | Signal Relay | `SignalRelayScene` | Phenomena | communication, continuity |
| 22 | Collective Current | `CollectiveCurrentScene` | Phenomena | coordination, emergence |
| 23 | Shared Load | `SharedLoadScene` | Phenomena | cooperation, resources |
| 24 | Phase Change | `PhaseChangeScene` | Phenomena | adaptation, organization |
| 25 | Dynamic Balance | `DynamicBalanceScene` | Phenomena | maintenance, stability |

## 2. What is depicted

| # | Scene | Cubes on screen | Single protagonist | Group / collective | Static composition | Obstacle or barrier | Assembled shape | Text on faces |
| --: | --- | --- | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | Moving World | 1 + up to 1 | ● | · | · | · | · | · |
| 2 | Changing Faces | 1 | ● | · | · | · | · | · |
| 3 | Discovery | 1 + 3 | ● | ◐ | · | · | · | · |
| 4 | Three Cubes | 3 | · | ● | ● | · | ◐ | · |
| 5 | Main Cube | 1 + 1–3 | ● | ◐ | · | · | · | · |
| 6 | Forming a Group | 7 | · | ● | · | · | ● | · |
| 7 | VLL Cube | 1 | ● | · | · | · | · | ● |
| 8 | Random Structure | 16 | · | ● | · | · | ● | · |
| 9 | Continuous Queue | 6 | · | ● | · | · | ● | · |
| 10 | Crossing Flows | up to 14 | · | ● | · | · | · | · |
| 11 | Learned Detour | 1 + 3 | ● | · | · | ● | · | · |
| 12 | Memory Replay | 1 + 3 | ● | · | · | · | · | · |
| 13 | Boundary Repair | 1 + 8 + 1 | ◐ | ● | · | · | ● | · |
| 14 | Reuniting Pair | 2 + 3 | · | ◐ | · | ● | · | · |
| 15 | Repeated Preference | 1 + 4 + 4 | ● | ◐ | · | · | ● | · |
| 16 | Predicted Paths | 1 + 3 + 3 | ● | · | · | ● | · | · |
| 17 | Learned Rhythm | 2 | ● | · | · | ◐ | · | · |
| 18 | Valence Field | 1 + 4 + 4 | ● | ◐ | · | · | ● | · |
| 19 | Moving Bridge | 1 + 10 | ● | ● | · | · | ● | · |
| 20 | Becoming a Sign | 9 + 1 | ◐ | ● | · | · | ● | · |
| 21 | Signal Relay | 9 | · | ● | · | · | ● | · |
| 22 | Collective Current | 12 | · | ● | · | · | · | · |
| 23 | Shared Load | 1 + 10 | ● | ● | · | · | ● | · |
| 24 | Phase Change | 12 | · | ● | · | · | ● | · |
| 25 | Dynamic Balance | 1 + 8 + 1 | ◐ | ● | · | · | ● | · |

Every scene also accepts the `faceLabels` prop, so text can be added to any of them. The column
marks only what the scene shows by default.

## 3. Composition and system

| # | Scene | Layout | Cube inventory | Ghost copies |
| --: | --- | --- | --- | :-: |
| 1 | Moving World | single cube | open | ◐ |
| 2 | Changing Faces | single cube | closed | · |
| 3 | Discovery | single + scatter | closed | ◐ |
| 4 | Three Cubes | line of three | closed | · |
| 5 | Main Cube | single + passers-by | open | ◐ |
| 6 | Forming a Group | scatter → block | closed | · |
| 7 | VLL Cube | single cube | closed | · |
| 8 | Random Structure | block, morphing | closed | · |
| 9 | Continuous Queue | diagonal line | closed, wraps | · |
| 10 | Crossing Flows | two opposing flows | open | · |
| 11 | Learned Detour | path + wall | closed, wraps | · |
| 12 | Memory Replay | path + echoes | open | ● |
| 13 | Boundary Repair | ring | closed, wraps | · |
| 14 | Reuniting Pair | pair + wall | closed | · |
| 15 | Repeated Preference | frame + line | closed | · |
| 16 | Predicted Paths | path + obstacles | open | ● |
| 17 | Learned Rhythm | crossing axes | closed, wraps | · |
| 18 | Valence Field | frame + line | closed | · |
| 19 | Moving Bridge | two rails | closed | · |
| 20 | Becoming a Sign | scatter → symbol | closed, wraps | · |
| 21 | Signal Relay | straight line | closed, wraps | · |
| 22 | Collective Current | scatter | closed | · |
| 23 | Shared Load | two rails | closed | · |
| 24 | Phase Change | scatter ↔ block | closed | · |
| 25 | Dynamic Balance | ring | closed, wraps | ◐ |

`Cube inventory` says whether the scene is a closed system. `closed` — the same cubes only move
around; `closed, wraps` — the population is constant, but a cube leaves through a transparent edge
and returns from the other side; `open` — cubes are genuinely created and destroyed while the scene
runs. `Ghost copies` marks translucent cubes that are not full participants: predicted branches,
memory echoes, passers-by.

## 4. Motion

| # | Scene | Cubes move | Main cube stays at centre | Frame of reference | Cube rotates | Lifted above grid | Enters / exits through edge | Opacity fades | Waiting or synchronising |
| --: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | Moving World | ◐ | ● | world moves | · | · | ◐ | ● | ◐ |
| 2 | Changing Faces | · | ● | fixed | ● | ● | · | · | · |
| 3 | Discovery | ● | · | fixed | · | · | · | ● | · |
| 4 | Three Cubes | · | ● | fixed | · | · | · | · | · |
| 5 | Main Cube | ● | ● | fixed | · | · | ● | ● | · |
| 6 | Forming a Group | ● | · | fixed | · | · | · | · | ◐ |
| 7 | VLL Cube | · | ● | fixed | ● | ◐ | · | · | · |
| 8 | Random Structure | ● | · | fixed | · | · | · | · | ◐ |
| 9 | Continuous Queue | ● | · | fixed | · | · | ● | ● | ● |
| 10 | Crossing Flows | ● | · | fixed | · | · | ● | ● | ● |
| 11 | Learned Detour | ● | · | fixed | · | · | ● | ● | ◐ |
| 12 | Memory Replay | ● | · | fixed | · | · | · | ● | ◐ |
| 13 | Boundary Repair | ● | ● | fixed | · | · | ● | ● | ◐ |
| 14 | Reuniting Pair | ● | · | fixed | · | · | · | · | ● |
| 15 | Repeated Preference | ● | · | fixed | · | · | · | · | ◐ |
| 16 | Predicted Paths | ● | · | fixed | · | · | ● | ● | ◐ |
| 17 | Learned Rhythm | ● | · | fixed | · | · | ● | ● | ● |
| 18 | Valence Field | ● | · | fixed | · | · | · | ◐ | ◐ |
| 19 | Moving Bridge | ● | ● | follows cube | · | · | · | · | ● |
| 20 | Becoming a Sign | ● | · | fixed | · | · | ● | ● | ◐ |
| 21 | Signal Relay | ● | · | fixed | · | · | ● | ● | · |
| 22 | Collective Current | ● | · | fixed | · | · | · | ◐ | · |
| 23 | Shared Load | ● | ● | follows cube | · | ● | · | · | ● |
| 24 | Phase Change | ● | · | fixed | · | · | ◐ | · | ◐ |
| 25 | Dynamic Balance | ● | ● | fixed | · | · | ● | ● | ◐ |

`Frame of reference` says what produces the motion on screen. `world moves` — the grid itself is
animated and the cube stands still (`movementMode='move-grid'`, only Moving World). `follows cube` —
the cube really travels, but the grid focus is retargeted to it every frame (`travelWithCube`), so it
stays in the middle while the supports stream past it. `fixed` — the grid never moves and only cubes
do.

That distinction matters for the centre column: scenes 1, 19, and 23 hold the centre through the
frame of reference, while scenes 2, 4, 5, 7, 13, and 25 hold it the plain way — that cube simply
never moves, and everything else happens around it.

## 5. Behaviour and logic

| # | Scene | Randomised per cycle | Fixed scripted route | Collision-safe pathfinding | Proximity reaction | Signal or pulse | State carried across cycles | Repeats forever |
| --: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | Moving World | ● | · | · | ● | · | · | ● |
| 2 | Changing Faces | ● | · | · | · | · | · | ● |
| 3 | Discovery | ◐ | ● | · | ● | · | · | ● |
| 4 | Three Cubes | · | · | · | · | · | · | · |
| 5 | Main Cube | ● | · | ● | · | · | · | ● |
| 6 | Forming a Group | ● | · | ● | · | · | · | ● |
| 7 | VLL Cube | ● | · | · | · | · | ◐ | ● |
| 8 | Random Structure | ● | · | ● | · | · | ◐ | ● |
| 9 | Continuous Queue | ◐ | ● | ● | · | · | · | ● |
| 10 | Crossing Flows | ● | · | ● | ● | · | ◐ | ● |
| 11 | Learned Detour | · | ● | ● | · | · | ● | ● |
| 12 | Memory Replay | · | ● | ● | · | · | ● | ● |
| 13 | Boundary Repair | ● | · | ● | · | · | ◐ | ● |
| 14 | Reuniting Pair | · | ● | ● | · | · | ● | ● |
| 15 | Repeated Preference | ◐ | ● | ● | · | · | ● | ● |
| 16 | Predicted Paths | · | ● | ● | · | · | ● | ● |
| 17 | Learned Rhythm | · | ● | ● | ● | · | ● | ● |
| 18 | Valence Field | · | ● | ● | ● | · | ● | ● |
| 19 | Moving Bridge | · | ● | ● | · | · | ● | ● |
| 20 | Becoming a Sign | ● | · | ● | · | · | ● | ● |
| 21 | Signal Relay | · | ● | ● | · | ● | · | ● |
| 22 | Collective Current | ● | · | ● | · | ● | ● | ● |
| 23 | Shared Load | · | ● | ● | · | · | ● | ● |
| 24 | Phase Change | ● | · | ● | · | · | ● | ● |
| 25 | Dynamic Balance | ● | · | ● | · | · | ● | ● |

`State carried across cycles` means the next cycle differs because of what happened in the previous
one: a learned route, a remembered journey, a symbol or direction that must not repeat, a swapped
pair of destinations, or a rotated position of the free cell.

## 6. Camera, grid, and interaction

| # | Scene | Grid cells | Cell size | Camera azimuth | Grid fade inner / outer | Animated camera zoom | Animated grid opacity | Hover scale |
| --: | --- | --: | --: | --: | --- | --- | --- | :-: |
| 1 | Moving World | 13 | 0.085 | 60° | 1 / 7 | · | fixed 1 | · |
| 2 | Changing Faces | 11 | 0.13 | 40° | default | · | · | ● |
| 3 | Discovery | 11 | 0.04 | 30° | off (bounded) | · | · | · |
| 4 | Three Cubes | 9 | 0.1 | 0° | default | · | · | · |
| 5 | Main Cube | 15 | 0.075 | 45° | 2 / 8 | · | · | · |
| 6 | Forming a Group | 23 | 0.027 | 45° | 4 / 12 | · | · | · |
| 7 | VLL Cube | 9 | 0.1 | 45° | default | · | · | ● |
| 8 | Random Structure | 19 | 0.035 | 45° | 3 / 10 | · | · | · |
| 9 | Continuous Queue | 21 | 0.04 | 45° | 3 / 11 | · | · | · |
| 10 | Crossing Flows | 14 | 0.045 | 0° | 2 / 7 | · | · | · |
| 11 | Learned Detour | 17 | 0.05 | 25° | 2.5 / 9 | · | · | · |
| 12 | Memory Replay | 15 | 0.045 | 35° | 2 / 8 | · | · | · |
| 13 | Boundary Repair | 17 | 0.052 | 45° | 2.5 / 9 | · | · | · |
| 14 | Reuniting Pair | 15 | 0.05 | 20° | default | · | · | · |
| 15 | Repeated Preference | 17 | 0.05 | 0° | default | · | · | · |
| 16 | Predicted Paths | 23 | 0.04 | 15° | 3.5–5 / 12 | 0.80 – 1.08 | 0.48 – 0.72 | · |
| 17 | Learned Rhythm | 15 | 0.07 | 0° | 1.5–2.5 / 8 | 0.90 – 1.22 | 0.48 – 0.72 | · |
| 18 | Valence Field | 17 | 0.065 | 0° | 1.5–3 / 9 | 0.84 – 1.16 | 0.36 – 0.62 | · |
| 19 | Moving Bridge | 17 | 0.06 | 45° | 1.5–3 / 9 | 0.94 – 1.18 | 0.46 – 0.70 | · |
| 20 | Becoming a Sign | 23 | 0.047 | 0° | 4–5.5 / 12 | 0.76 – 1.12 | 0.42 – 0.66 | · |
| 21 | Signal Relay | 15 | 0.05 | 25° | 3 / 8 | · | · | · |
| 22 | Collective Current | 19 | 0.038 | 40° | 3.5 / 10 | · | · | · |
| 23 | Shared Load | 17 | 0.05 | 45° | 3 / 9 | · | · | · |
| 24 | Phase Change | 23 | 0.035 | 35° | 4 / 12 | · | · | · |
| 25 | Dynamic Balance | 17 | 0.055 | 45° | 3 / 9 | · | · | · |

Camera elevation is 35° in every scene. The fade columns give the animated range where a scene
changes it; `default` means the wide radii derived from the grid size, and `off (bounded)` means the
radial fade is disabled so the grid stays at full strength up to its border. Pointer hovering highlights a
cube with a pointer cursor in every scene, but only the two face-flip scenes scale the cube in
response.

## 7. Feature totals

Counting every scene where the feature is marked `●` or `◐`.

| Feature | Scenes |
| --- | --: |
| Repeats forever | 24 |
| Cubes move between grid cells | 22 |
| Main cube stays at centre | 9 |
| Ghost / translucent copies | 6 |
| Closed system (constant population) | 20 |
| — of them wrapping through an edge | 7 |
| Open system (cubes created and destroyed) | 5 |
| Frame of reference other than fixed | 3 |
| Collision-safe pathfinding | 20 |
| Waiting or synchronising | 18 |
| Group or collective composition | 18 |
| State carried across cycles | 17 |
| Randomised per cycle | 15 |
| Opacity fades | 15 |
| Assembled shape | 13 |
| Enters / exits through a transparent edge | 12 |
| Fixed scripted route | 12 |
| Proximity reaction | 5 |
| Animated camera zoom and grid opacity | 5 |
| Obstacle or barrier | 4 |
| World (grid) moves under the cube | 3 |
| Lifted above the grid | 3 |
| Cube rotation | 2 |
| Hover scale response | 2 |
| Signal or pulse | 2 |
| Static composition | 1 |
