# Gym implementation notes

A1 boots `/main/gym/boot.collection`, whose proxy owns the `gym` world. The controller is the sole gym physics owner. G1 remains `/main/main.collection` and is selected explicitly by the physics runner / `build --fixture physics`.

All geometry/camera lengths are engine units; at the existing `physics.scale=0.01`, 100 units correspond to one metre. The pinned chain binding scales vertices and ghost vertices itself: do not scale twice. The right-to-left flat chain has its front face above the floor. A falling radius-15 probe must rest at y=95 ±2 on y=80 before the A1 smoke passes. A follow-target move is checked separately; this is not a gameplay acceptance.

A collision resource must contain a shape (`resources/box2d/res_collision_object_box2d.cpp`). During the safe initial update the owner removes the sole seed shape at index 1, verifies the borrowed body remains valid, then creates the chain; it asserts that the resulting shape is the chain segment. Shape indices are not stable across creation: a first smoke caught deletion of the chain when index 1 was used after creation. Defold owns the static body/chain lifetime; session references are discarded on finalization. Geometry creation is not performed in contacts.

Sources actually consulted: Defold 1.14.0 / `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, `script_box2d_chain_v3.cpp` (scaled vertices, open ghosts, world-lock checks), `script_box2d_body_v3.cpp` (shape indices/ownership), collision resource loader above, `camera_ddf.proto`, `sprite_ddf.proto`, `atlas_ddf.proto`, collection-proxy and camera manuals. The camera uses orthographic Auto Fit; the proxy is initialized only after `proxy_loaded`. This keeps the world compatible with later proxy time scaling without implementing A20 early.

`python tools/gym/smoke.py --output artifacts/gym/a1 --case a1` builds the HTML5 default gym with a unique run ID/source SHA and requires a complete matching runtime result plus a browser screenshot. Synthetic browser evidence does not prove physical-phone input or performance. Checkerboard pixels are original procedural test art, not production assets.

## A2 vehicle baseline

The controller creates three Defold-owned bodies, waits one update, then creates two wheel joints in the same gym world. Keyboard input only records held actions; the sole fixed owner normalizes throttle/brake commands and applies motors. Brake wins if both are held. Up/W throttle; Down/S brake. Coasting disables the motors. Reverse/air lean and camera feel are M2, not silently included in A2.

Source consulted at the same pinned engine commit: `script_box2d_joint_v3.cpp`, `Joint_CreateWheel`, `Joint_SetMotorSpeed`, `Joint_SetMaxMotorTorque`; `script_box2d_body_v3.cpp`, body position/angle/velocity/contact data. Anchors remain engine units, wheel speed rad/s, spring hertz Hz and damping dimensionless. Torque caps are explicitly named binding-input values (1800 drive / 3000 brake), scaled once by the binding; no claim that the final feel is approved. Body masses are 40 kg / two 4 kg wheels in their resources.

`--case a2` uses actual browser keyboard events after 60 settle ticks: throttle for 180 ticks, then brake while throttle stays held for the first 60 braking ticks. Predeclared checks: forward distance >150 units and speed >100 units/s; max chassis angle <0.6 rad throughout; after 120 braking ticks |vx|<12 units/s; both wheels have actual contacts; camera x follows within 12 units. Input actions go through normal on_input/normalized-command handling, not direct pose writes. The A1 probe remains independently runnable with `--case a1`.
