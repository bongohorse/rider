# Passages, connection constraints and controlled variants

**Status:** worked-out concept; **not approved for implementation**. Historical source: [Issue #230](https://github.com/bongohorse/rider/issues/230) (backlog, needs GO). Current issues/child tasks and code contracts take precedence.

A validated authored-passage library is the foundation. Ensure deterministic replacement and safe transitions.

## Group 1 — Passage library and connection rules

**Purpose:** make a small set of authored driving situations reusable without assuming every geometrically connected combination is playable.

| Building block | Driving role | Useful metadata |
|---|---|---|
| Start / run-in | Safe spawn and preparation | Start clearance, allowed initial speed, approach length |
| Acceleration / braking section | Reach or shed speed | Length, slope, intended entry/exit speed range |
| Wave / rolling terrain | Flow and suspension rhythm | Wavelength, amplitude, transition limits, vehicle assumptions |
| Ramp and landing pair | Controlled jump | Takeoff shape, expected approach range, landing area and recovery space |
| Step / precision section | Controlled wheel placement | Step dimensions, clearance and intended approach |
| Recovery / rest section | Regain control after difficulty | Safe width/length, grade and exit conditions |
| Finish section | Readable end to the course | Approach, stop/run-out space and finish direction |

Candidate connection rules:

- Endpoint position, height and slope/tangent; supported terrain representation and continuity.
- Approach distance, expected speed envelope, clearance and vehicle dimensions.
- Takeoff, landing and safe recovery space; avoid blind landings and unavoidable hazards.
- Explicit allowed predecessors/successors where rules are easier to author than infer.
- Repetition tags, challenge type, approximate duration and supported difficulty range.
- Versioned module identity and known drive-test evidence.

A speed envelope is an authored or measured assumption, not proof that every player arrives at that speed. Do not require a full vehicle trajectory solver to connect the first few modules.

## Group 2 — Selected-passage generation

**Purpose:** help authors improve one section without replacing a complete handmade course.

| Feature | Behaviour |
|---|---|
| Generate between anchors | Suggest a bounded section while preserving its external connection conditions |
| Parametric alternatives | Vary supported wave/ramp/transition parameters within approved ranges |
| Candidate preview | Offer a small bounded set of alternatives with clear differences |
| Lock manual content | Preserve selected geometry, START/FINISH and protected objects |
| Replace with Undo | Commit the selected candidate as one coherent document operation |
| Explain rejection | State why anchors, bounds or budgets prevent a valid candidate |
| Retry with a seed | Reproduce candidate generation using the same versions and configuration |

Start with a short supported terrain section and a few meaningful parameters. Complex jump replacement and interactive objects can come later.

Preserve external references and stable object identities according to the chosen replacement policy. Do not silently remove manually wired objects or strand connections.

