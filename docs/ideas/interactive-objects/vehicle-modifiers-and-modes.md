# Vehicle modifiers and alternative vehicle modes

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Gameplay pickups may eventually request preset vehicle modifications. Validated vehicle architecture and construction belong to [#198](https://github.com/bongohorse/rider/issues/198) and [vehicle-builder](../vehicle-builder.md).

**Contents:** [H. Vehicle modifiers, temporary transformations and tyres](#h-vehicle-modifiers-temporary-transformations-and-tyres) · [I. Alternative vehicles and movement modes (vehicle epic, not new #120 objects)](#i-alternative-vehicles-and-movement-modes-vehicle-epic-not-new-120-objects)

## H. Vehicle modifiers, temporary transformations and tyres

These are future *vehicle modifiers*, not permission to mutate Box2D bodies or shapes during a collision. Reuse the validated vehicle definitions and car-editor architecture in [#198](https://github.com/bongohorse/rider/issues/198); course items/events in #120 should request only approved presets. Every modifier needs a source, clear on-screen feedback, duration, stacking/conflict rule and Retry restoration.

| Modifier | Gameplay effect | First safe design rule / concern |
|---|---|---|
| Grow / shrink whole buggy | Huge car pushes barriers; tiny car fits into narrow tunnels | Switch between tested complete vehicle presets at a collision-free pose; handle chassis/wheels, mass/inertia, geometry, momentum, camera, joint and reset coherently |
| Bigger / smaller wheels | Climb taller blocks or squeeze through smaller gaps | Tested wheel radius, clearance and suspension presets; resizing the visual sprite alone is insufficient |
| Different wheel sets | Swap between road, off-road, balloon, heavy and other tyres | Separate cosmetic appearance from physical parameters |
| Spiked wheels | Grip tagged surfaces and possibly engage designated breakables | Start with a traction/interaction preset; physical spikes with many collision shapes need a separate cost test |
| Slippery wheels | Intentionally low grip; drift and hard braking | Wheel friction preset, explicit length of effect and recovery |
| Soft wheels | Absorb shocks, bounce or deform visually | First test compliant suspension/response plus cosmetic squash; not full soft-body tyres |
| Sticky wheels | Very high traction on difficult climbs | Clamp traction/forces; wall and ceiling driving need an additional gravity/contact experiment |
| Change suspension height | Duck through a low passage or climb over rough ground | Validate physical clearance and contact transitions; do not clip terrain |
| Light/heavy vehicle | Different jumps, inertia and load-based puzzles | Explicit validated mass preset; an occupancy plate is not a mass sensor |
| Magnetic wheels | Stick to tagged metal strips | Bounded tagged force; separate feasibility prototype |
| Temporary hover mode | Glide above short hazards | Distinct validated controller preset and safe re-landing; not mere visual lift |
| Shield / invulnerable state | Survive one declared hazard | Only after the crash/damage policy is specified; not a substitute for collisions |

**Transitions:** when a new wheel size, body scale or archetype is activated, ensure there is physical space and a valid state. Rebuild/swap the complete validated vehicle at a controlled boundary, or defer/reject the transformation; define whether linear/angular momentum is preserved. Start with friction-only tyre swaps rather than live body rescaling.

## I. Alternative vehicles and movement modes (vehicle epic, not new #120 objects)

| Archetype | Distinct player experience | Main feasibility risk |
|---|---|---|
| Unicycle (1 wheel) | Balance with torque, wheelies and precise jumps | One-point support and body stability |
| Existing buggy (2 wheels) | Baseline | Preserve handling and tests |
| Tricycle / 3-wheel buggy | Different balance and obstacle response | Additional suspension/wheel setup |
| Tracked vehicle / tank | Slow powerful climbing over uneven terrain | Expensive individual links; consider affordable contact approximation |
| Soft-wheel buggy | Cushioned landings and rebound | Controlled compliance without full soft-body physics |
| Sticky-wheel climber | Steep climbs | Adhesion forces and contact transitions |
| Hover vehicle | Gliding above surfaces | New hover force and camera model |
| Pogo-stick vehicle | Repeated spring hops | Balance, grounded timing and impulse bounds |
| Stilts / walker | Step over short gaps | Many constraints and contact instability |
| Trials-style crossbike | Weight transfer, balance and flips | New geometry, rider pose and tuned input |
| Airplane / glider | Launch, glide and land | Lift/drag forces and ground-to-air transitions |
| UFO | Hover and steer through airborne obstacles | Different flight controls |
| Flappy-style craft | Repeated tap to stay aloft | Touch control timing and level pacing |
| Train engine + wagons | Pull connected cargo over rolling hills | Couplers, joints, turning and camera length |
| Rocket craft | Directional thrust and landing | Thrust/torque, fuel/heat and safe impacts |
| Witch on a broom | Playful flying special vehicle | Flight physics, controls and animation |

**Ownership:** car construction and archetypes belong to #198 or separately approved movement experiments. #120 may eventually host a level object that activates an *already implemented* mode. Avoid building all vehicles at once: choose a single prototype and retain the stock buggy as comparison.
