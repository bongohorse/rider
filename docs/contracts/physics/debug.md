# Pause, slow motion and live tuning

Pause/resume must follow the real engine lifecycle with no hidden simulation. A20 uses the documented collection-proxy `set_time_step` mechanism; prove its effect on physics and rendering before relying on it. The gym must remain compatible with this world arrangement when its boot collection is introduced.

Single-step is optional and not required by the revised plan. If later implemented, prove exactly one physical tick; do not fake it in the UI when unsupported. Record unsupported behavior and alternatives explicitly.

A8 exposes 5–8 feel parameters. Classify each change as LIVE, NEXT_RESET or REBUILD, validate finite values/ranges/units, version configurations and apply changes atomically at a defined tick boundary. Do not promise arbitrary collision geometry or motor changes are live without evidence.
