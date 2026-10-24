<a id="gameplay-evidence"></a>
## Gameplay, vehicles and tuning

### What the original text establishes

The original [German PO catalog](../decompiled/unpacked/base.apk/assets/Common/translations/german.po) retains English `msgid` strings. Those strings provide better evidence of intended player-facing mechanics than the reconstructed C++ does. They establish shipped descriptions and tutorial instructions, not observed execution or verified physical equations.

**Confirmed — shipped air-control instruction.** Lines1529–1533 say “Hold the brake pedal to rotate forward” and “Hold the throttle to rotate backward.” This supports a two-pedal rotational-control design. It does not establish whether code applies chassis torque, wheel reaction torque, angular-velocity control or a mixture; nor whether an airborne check gates the effect. [G01](#claim-g01)

**Confirmed — shipped upgrade semantics.** In the ATV-related text block, `ENGINE` describes speed and turbo, `SUSPENSION` describes a lower weight point and shock absorption, and fuel-tank text describes longer time without refueling. A grappling hook exposes rope length and pull-motor power; related text permits up to three uses after fuel exhaustion and unlocking a fourth tuning-part slot. These are content descriptions, with local textual association, not parsed numeric configurations. [G05](#claim-g05), PO lines8011–8056. Consequently, the old universal “three slots” description is too strong even at the content level.

| Shipped description / intended effect | Established connection | Unrecovered implementation detail |
|---|---|---|
| Faster turning in air | Air-control upgrade → rotation behavior | Torque magnitude, angular-speed cap, grounding logic |
| Coin/fuel boost, low-fuel boost | Pickup/resource event → power effect | Stacking, duration, engine parameter modified |
| Flip/wheelie/landing/start boost | Driving achievement → temporary effect | Angle accumulation, contact stability, time windows, thresholds |
| Jump shocks: tap both pedals | Combined input gesture → jump | Charge rules, impulse vector, cooldown and contact requirements |
| Coin/fuel magnet | Upgrade → wider pickup radius | Shape, spatial-query structure, attraction versus direct collection |
| Wings: glide | Equipment → airborne behavior | Lift/drag law, force application point, damping |
| Heavyweight: damage to breakables | Equipment → obstacle interaction | Impulse/energy criterion, health model, fracture implementation |
| Rollcage: protect driver | Equipment → crash protection | Fixture topology, sensor rules, detachment sequence |
| Spoiler: effect lost on detachment | Attachment lifecycle → handling effect | Downforce direction/speed law and break threshold |
| Winter tires: snow/ice grip bonus | Surface category → handling modifier | Friction mixing and material tagging |

Evidence: [G02–G04](#claim-g02), PO lines6208–6335. These descriptions justify investigating event-driven components; they do not justify the old numerical tuning tables. Names appearing in a texture or configuration filename establish content identifiers at most, not an exhaustive playable roster or a drivetrain classification.

### Component responsibilities and likely data flow

**Supported inference — design decomposition, not recovered update order.** Taken together, the text implies connections between input, resource pickups, driving-event detection, equipment state and vehicle handling. A system must associate a boost with its trigger and a detachable spoiler's state with its effect if it implements those descriptions. The exact components, data structures and execution order are unknown. Do not promote an explanatory `VehicleAssembly`, `UpgradeManager` or `ContactListener` name to an original symbol.

A useful *independent Rider design* would separate:

```text
input snapshot → vehicle controller → physics bodies/joints
                         ↑
fixed-step events → equipment/effect state → bounded modifiers
       ↓
race state, rewards, HUD, audio and particles
```

This diagram is our proposal. In particular, visual assets such as wingsuit shaders do not prove an aerodynamic force formula; a snow shader does not prove a contact-friction override; a driver model does not prove that its head is a sensor fixture.

### Vehicle dynamics: what is still unknown

The native chapter distinguishes Box2D capability from identified game integration. This research has not established per-vehicle body masses, center-of-mass coordinates, fixture categories, wheel counts, joint choices, motor splits, spring parameters or world-unit scale. Nor has it recovered whether suspension upgrades modify stiffness, damping, travel, geometry or several values. General spring physics remains useful engineering knowledge, but the old `3–8 Hz`, `0.5–0.9`, tire friction `1.2–2.8`, Jeep `850 kg` and “AWD 40:60” numbers must not be represented as HCR2 findings. [P03](#claim-p03)

Driver-down, neck-flip and protective-part text supports intended crash-related gameplay. It does not establish a universal head-to-terrain sensor rule, a neck-impulse threshold, which body detaches first, or whether the driver's physics remains active after the race ends. The prototype's head-distance test is a separate implementation. A verified RUBE reader and decoded configuration or actual native contact-handler path would be needed to resolve this.

### Obstacles and environment interactions

**Confirmed — described interactions.** Original text includes damage to breakable objects, detachable handling parts, cargo-delivery time bonuses and a hook capable of destroying breakables. [G04–G05](#claim-g04), [G09](#claim-g09). The graphical assets chapter independently documents actual model and shader structures.

**Unknown.** Whether a particular bridge uses dynamic joints, a waterwheel is motorized, scenery is kinematic, a crate fractures at an impulse threshold, or a launch object adds a specific velocity remains unproved. An OBJ mesh cannot establish its collision geometry, mass or scripted behavior. The previous obstacle formulas and biome gravity/friction tables have no accepted primary-code/configuration mapping in this reference. They are hypotheses requiring a reader/call-site trace, not reusable tuning specifications.

<a id="race-systems"></a>
## Timing, progress, modes, replay and persistence

### Timers, checkpoints, finish and resources

**Confirmed — content-level features.** The PO catalog contains `Checkpoint not reached in time!`(line 733), `DID NOT FINISH`(928), cup reward text(1249), `Finish the track as fast as you can`(1337), `NEW RECORD!`(1932), `NO GHOSTS`(1974), `Out of fuel!`(2130) and fuel-canister tasks(4613–4616). [G06](#claim-g06). Cargo time bonuses, airtime penalties, collection trials and stunt feedback appear at6115–6175. [G09](#claim-g09).

The bounded conclusion is that the shipped content describes these concepts. The following are **unknown**: simulation clock versus wall clock; pause/resume accounting; start-line activation; substep finish crossing; checkpoint timeout logic; distance measured along the curve versus world X; fuel consumption law; collection radius; coin value schedule; medal cutoffs; reward authority and anti-duplication rules. The research has not established a medal implementation from the inspected primary artifacts.

The prototype instead floors the chassis X coordinate, fabricates cup times using `24.5 + Math.random() * 2.5`, and applies local resource rules. Its standings and tests cannot establish HCR2's race timing or reward correctness. [P05](#claim-p05), [GameEngine.js](../src/game/GameEngine.js), `update`; [CupTournament.js](../src/game/CupTournament.js), `recordHeatResults`/`finishTournament`.

### Modes, records, ghosts and networking

Cup/adventure, records and replay concepts are supported by original content and UI material, but their entire mode graph is not recovered. Generic HTTP/authentication/analytics code in Java is not evidence of a particular race synchronization protocol. There is no live network capture here. This report therefore does not establish real-time versus asynchronous transport for every mode, server-authoritative simulation, input determinism, matchmaking, replay authenticity, sample frequency or opponent selection.

**Important format correction.** Some `.dat` contents admit complete Protobuf-compatible wire parsing, others do not; wire types do not assign field meanings. The older `GhostRecording` schema, telemetry field 15, 16-byte records, centimetres/milliradians and 30/60 Hz sampling are unverified. The prototype even chooses field 12 for its assumed keyframe stream and synthesizes missing samples. That contradiction is retained explicitly rather than choosing either interpretation. [P04](#claim-p04); [old proposed schema](../specs/GHOST_TELEMETRY_AND_CUPS.md), lines 63–90; asset-format evidence below.

A correct recovery would follow an actual reader's tag switch, length handling, decompression, units and playback code, then validate several complete payloads. A UUID-like string and plausible float are insufficient. For Rider, a simple independently specified pose replay is a practical later experiment; HCR2's record format is unnecessary.

### Editor, assembly and compatibility

**Confirmed — shipped editor messages.** `Cannot save track with overlapping objects!`(706), editor-theme strings(1084–1090), `TRACK EDITOR`(2860), a newer-game requirement for a track(3028), and `You must drive and finish the track before publishing!`(3458) occur in the original catalog. [G07](#claim-g07). They support authored content, validation feedback and a publish-validation concept. They do not establish Catmull–Rom, a block-selection algorithm, server-enforced completion or a particular object-overlap test.

**Confirmed — compatibility/error messages.** Original text distinguishes local career and cloud synchronization; warns about overwriting; reports save corruption; and rejects newer-client saves/replays. [G08](#claim-g08), PO748–754,862,1310,1758,2292,2518,2539. The actual save serialization, migration policy, encryption, transactional write sequence and server ownership remain unknown. APK signing and native-loader protection are separate from save integrity. SDK AES routines do not establish that a game save or opaque asset uses that same cipher.

### Simulation/render timing

**Unknown — original game parameters.** A Cocos render callback is not proof of a 60 Hz fixed Box2D step. Neither `CC_Time` in a shader nor Java's render pacing establishes physics accumulation, solver iteration counts, catch-up caps or interpolation. The prototype's four substeps establish only its own solver behavior. [P03](#claim-p03); [PhysicsWorld.js](../src/physics/PhysicsWorld.js), `step`.

The smallest useful next trace is native renderer callback → director/scheduler → actual physics world stepping call, with the argument construction and accumulator branches. Until that exists, report rendering cadence and physics cadence separately. Rider's timing experiment below is based on Defold documentation and its own measurements, not an attributed HCR2 algorithm.

