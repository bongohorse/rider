# G1 progress — PASS — see acceptance and PR #7

G1 started after the documentation split was merged in PR #6. Implementation is isolated in [draft PR #7](https://github.com/bongohorse/rider/pull/7). This is a progress record, not gate approval.

## Candidate provenance

- Defold/Bob 1.14.0: engine commit `a81dbb0478e8b73931dc2d671563204f6ac0ef82`.
- Bob release JAR downloaded and independently SHA-256 verified: `90da834167c21be956af2be5a2a64b2ee1e16ad980dfa99f35a6b26516958d0f`.
- Local Temurin `25.0.4.1+1` Linux archive independently verified: `dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e`.
- CI uses Temurin candidate selector `25.0.4`; exact effective builds must be recorded before toolchain approval. The selector is not a final lock.
- App manifest comes from the official [1.14.0 Box2D 3 fixture](https://github.com/defold/defold/blob/1.14.0/editor/test/resources/test_project/app_manifest/physics_2d_box2dv3.appmanifest). It selects the integrated libraries and requires an Extender engine build already in G1.

## Initial execution evidence

At source `50bdf9af9d822855ebd3fce1dcf831f665cccc5e`, [CI run 38677100495](https://github.com/bongohorse/rider/actions/runs/38677100495) produced a Linux headless bundle successfully. Running that bundle locally reported Defold 1.14.0 and `Created physics context: Box2D v3.1.0`. The scripted backend probe failed because of the executable filename and the removed `sys.get_config` API; subsequent source uses `RiderG1.x86_64` and the verified `sys.get_config_string` API. A log message alone does not complete the backend acceptance case.

The HTML5 build reached Extender and failed. The runner now preserves nested Extender logs so the cause can be reviewed; build success and browser runtime remain separate requirements. Local Bob cannot reach Extender because its HTTP client does not honor the host proxy configuration. Builds therefore run on the authorized GitHub Actions platform matrix.

## API findings to validate empirically

Source: [body binding](https://github.com/defold/defold/blob/1.14.0/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp), [wheel joint binding](https://github.com/defold/defold/blob/1.14.0/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_joint_v3.cpp). These are source observations, not measured unit approval.

| Operation | Binding behavior | PoC consequence |
|---|---|---|
| Body position / linear velocity | Output divided by physics scale | Expose engine coordinates once; avoid a second conversion |
| Transform / linear velocity input | Multiplied by physics scale | Changed-scale probe required |
| Force / linear impulse | Input multiplied by physics scale | Verify physical result before declaring units |
| Body torque / angular impulse | Input not multiplied by physics scale | Do not assume all force-like APIs share a conversion |
| Wheel anchors / travel limits | Input scaled | Check measured body separation |
| Wheel motor torque | Input multiplied by physics scale | Different from body torque; explicit adapter and empirical test needed |
| Motor speed / angular velocity | Angular values in radians per second | UI degree conversion belongs outside physics |
| Joint translation getter | Registered for prismatic, not wheel joint | Measure wheel/chassis positions for the spring case |

## Baseline completion

All required desktop/HTML5 physics runs now pass at `7594e500fafa074b65150dd45a3224369dea5033`, [run 38697533465](https://github.com/bongohorse/rider/actions/runs/38697533465). The unsupported empty `excludeJslibs` manifest key was removed. Proxy handle lookup was moved into its owning collection. Fixed-callback tick zero now resets initial velocity, eliminating a render-dependent startup bias without widening tolerances. Android debug APK building also passed; installation/device tests remain unverified. See [acceptance](G1_ACCEPTANCE.md), [implemented contract](physics/G1_CONTRACT.md) and [toolchain lock](TOOLCHAIN_LOCK.md).

## Original remaining-work list (now implemented, retained as scope history)

1. Finish platform backend probes and diagnose HTML5 Extender output.
2. Add the minimal chassis, wheel, joint and floor fixtures; define tolerances before runs.
3. Implement collision, motor, spring, changed-scale and fixed-tick cases plus 100 cleanup/reset cycles.
4. Add browser runtime and run-ID/completion protocol checks; attempt Android bundling.
5. Fill [G1 acceptance](G1_ACCEPTANCE.md) with exact tested source and artifacts. Approve Engine/Bob/JDK only after the required matrix passes. Stop before G2.
