# Scenario and result data

Grow schemas only when required by the gym. Versioned scenario/replay records include scenario ID/version, schema version, RNG seed when used, platform/build SHA/engine/backend, canonical configuration and hash, commands indexed by physics tick, input policy, measured checkpoints/tolerances, result/error, test ID and relative artifacts.

Reject NaN/Inf, missing fields, unsupported versions, out-of-range values and corrupt saves with an understandable error or documented fallback. No silent corruption. Cross-platform comparisons are tolerance-based, not bit-exact. A16 defines versioned JSON polylines; A21 adds recording/ghost data and A22 locks approved regression traces.
