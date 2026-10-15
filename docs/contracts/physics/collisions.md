# Collision groups and masks

Document intended interactions when each gym feature is introduced: chassis, wheels, terrain, dynamic obstacles and sensors; decorations have no physics. Record actual groups/masks, wheel/chassis self-collision policy, ghost contacts, start/finish sensors and object limits. Do not assume default filtering. G1's fixture-only group does not establish gameplay filtering.

A7 adds a chassis-attached head sensor and switch: gym default off displays head contact only; enabled triggers reset. Challenges default on. Verify pinned sensor API, overlap timing and script-shape reset lifecycle in A7; no ragdoll is required.
