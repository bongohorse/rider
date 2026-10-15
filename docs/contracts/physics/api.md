# Physics API and platform compatibility

Use [G1_CONTRACT.md](G1_CONTRACT.md) for measured APIs, signatures, units and verified platform limits. Extend that record only when a gym issue actually uses another operation. For each operation record API/signature, exact source/reference version, backend, native/HTML5/Android evidence, expected semantics, test ID, result and limitation.

The G1 baseline covers actual Box2D 3 identity, dynamic/static bodies, collision, wheel joints with spring/motor, safe creation/destruction and reset handle validity. It does not establish every future sensor/contact/CCD API.

D8 selects `b2d.body.create_chain` terrain from polyline data, with hull collision objects for obstacles. A1 uses a flat chain, A16 establishes the versioned track format and A18 measures chain/hull seams at 5, 15 and 30 m/s before confirming or revising D8. Verify filtering, contact/sensor behavior and high-speed CCD when relevant; never silently add custom Box2D. A missing required API blocks the affected issue and requires evidence and a decision, not a backend substitution.
