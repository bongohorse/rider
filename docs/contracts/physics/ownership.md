# Ownership, reset and session validity

Defold game objects/collision-object components own bodies and worlds. Create them through supported resource/factory/collection paths. `b2d.get_body` returns a borrowed handle; deleting its component/object invalidates it. Do not invent independent body ownership. [G1_CONTRACT.md](G1_CONTRACT.md) documents the tested lifecycle.

Record owner/create/destroy/reset/validity/error handling for game objects/collision objects, bodies/shapes/chains/joints, contacts/listeners, timers, input/touch IDs, GUI, camera, Lua modules, subscriptions, messages and test state as each is introduced. Keep vehicle and terrain in the same proxy physics world; overlapping separate top-level worlds do not interact.

Know when bodies become available, how joints are registered and invalidated, which joints are removed automatically, and which require explicit destruction. Query documented validity or clear lifecycle references safely; never double-destroy or dereference invalid handles. Test explicit joint cleanup and deletion of a body/collection with attached joints. Old handles must not reach new objects after confirmed cleanup; engine cleanup and Lua reference cleanup are separate evidence.

Defold 1.14.0 uses shared Lua state. Session state belongs to explicit instances, not globals or persistent module singletons; immutable module definitions may be shared. Reset/unload must clear or generation-guard caches, listeners, timers and references. Unloading a collection alone does not clear Lua state.

D9 selects in-world retry, measured in A3; proxy reload is for track switches. G1's existing reload test remains a baseline, not the gameplay retry design. Safe retained bodies may be reused only with proven valid handles and fully restored canonical state; invalidate replaced resources. New script-created chains/shapes and their reset lifecycle require their own evidence.

Reset sequence:
1. Block input and clear touch assignments.
2. Stop pending actions and drain/cancel deferred mutations safely.
3. Restore/rebuild objects and joints in a safe window; reload a collection only for switching tracks or explicit recovery.
4. Reset UI, camera, timer, listeners, subscriptions and session state as applicable.
5. Invalidate replaced handles and reject stale generations.
6. Restore canonical configuration, positions and velocities; verify READY/start state.
7. Re-enable input; old touches must not apply a new command.

Serialize reset/switch requests; reject or coalesce duplicates explicitly. New sessions have a generation checked by pending timers/callbacks/commands/messages. Confirm actual unload/load/init completion events rather than fixed sleeps. Async reloads follow RUNNING → STOPPING → UNLOADING → LOADING → INITIALIZING → READY → RUNNING, with ERROR on timeout/failure. In-world reset uses only necessary states but the same completion conditions. Each transition needs a timeout/error path; ERROR stays safely paused with diagnostics and an explicit recovery that creates a new generation and confirms READY.

As switching and async features are added, test A → B → A with changed settings/listeners/input and interrupted reset/switch (pending timers, contacts, loads, rapid reset requests). Both scenarios must regain canonical start state; only explicitly documented persistent user preferences survive. Stale generations must never mutate the world. Failed cleanup is a hard test failure.
