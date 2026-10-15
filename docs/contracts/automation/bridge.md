# Native Automation Bridge

[Documentation index](../../README.md) · [G2 evidence](../../history/G2_ACCEPTANCE.md) · [Toolchain lock](../../TOOLCHAIN_LOCK.md)

The immutable release-2.5.0 source commit is `567c7efb2f72626af71967984bd33dde856f0d36`. `tools/setup_bridge.py` verifies the source ZIP SHA-256, uses the upstream atomic installer, and verifies all 28 installed wrapper files against that archive. The complete managed `automation-bridge-python/` directory is generated and ignored. Project scripts stay outside it. No Latest update is invoked.

```sh
python tools/setup_bridge.py
bash tools/doctor.sh --require-g2 --json
# Linux with a real display, or Xvfb plus Mesa runtime libraries:
xvfb-run -a -s '-screen 0 1280x720x24' bash tools/verify.sh --suite bridge --output artifacts/g2/bridge
```

`doctor --require-g2` verifies the exact approved JDK, Bob hash and matching wrapper source without launching anything or probing existing sessions. Missing/mismatched prerequisites give BLOCKED and exit 2. Runtime capability evidence remains separate.

For a native interactive fixture on Windows or Linux, after installing the wrapper:

```sh
bash tools/build.sh --target desktop --configuration debug --fixture bridge --output artifacts/bridge-debug
```

Use `./tools/build.ps1` and `./tools/doctor.ps1` on Windows. Run the bundled executable, then use the engine-service port printed by **that owned process**. In Python add `automation-bridge-python` to `PYTHONPATH` and use `from automation_bridge import engine`; connect through `engine.connect(observed_port, required_capabilities=(...))`. No editor discovery or default-port scanning is needed for this mode. Clients in the smoke use 127.0.0.1; no tunnel or externally published service is created. Keep upstream engine-service exposure within the trusted development host/network; the client address is not a claim that the upstream server binds loopback only.

The Editor HTTP API is a different service discovered through `.internal/editor.port`. It is not the runtime port. The official wrapper also supports the editor workflow, but no editor session is assumed or claimed by our Bob/owned-process smoke. Community MCP remains optional DEFERRED. No `/eval` route is invoked.

## Tested behavior

The dedicated `main/bridge/` fixture publishes a run-ID/source/engine-bound state and exposes a title/counter GUI. The Linux graphical smoke:

1. Builds the native **debug** engine against the pinned dependency and app manifest.
2. Starts and owns the process with a dynamic engine-service port; matches native PID, project/build identity and run ID.
3. Negotiates required scene/element/state/input-receipt/screenshot capabilities with the exact wrapper source.
4. Finds `Bridge Smoke`, checks count 0, sends SPACE, waits for the released input receipt and a newer state count of 1.
5. Captures completed screenshots before/after and requires visible image change.
6. Builds/starts **release**, requires a new atomic readiness file with the current run ID and absent Lua module, and proves the live process has no TCP listeners (or an actual engine-service route returns 404). Quiet release logging is not a missing-start success.

The common CLI emits JSON v1 and JUnit for both mandatory cases; setup errors, missing results or timeout cannot pass. Timeout cleanup covers owned descendant process groups, including nested tools that create their own sessions. A regression verifies this inside Linux PID namespaces; Windows uses taskkill /T. Actual logs, settings, health, wrapper provenance, screenshots and readiness files are CI artifacts.

## Distinct version fields and limits

| Field in the pinned source | Value |
|---|---|
| GitHub release | 2.5.0 |
| Python package | 3.0.0 |
| Reported native constant | 2.0.0 |
| Actual API version | 2 |
| Wrapper accepted API range | 2..2 |
| Upstream health min/max metadata | 1..1 (recorded inconsistency) |

The real wrapper negotiation, required capabilities and input/screenshot/release tests pass despite that legacy min/max metadata. No upstream code was patched to invent matching versions.

The capability smoke is validated on Linux native debug with Xvfb/Mesa. Windows runs the ordinary debug engine's full physics suite with pinned Mesa 26.2.4 software OpenGL in disposable per-process copies; stock bundle artifacts do not include Mesa DLLs. This is not hardware/GPU performance evidence. HTML5 clears the native dependency through a verified Bob array override and retains its independent browser physics test. Android APK building, signature and manifest validation do not prove real device input/lifecycle behavior.

License provenance remains unresolved: the user explicitly authorized implementation after the missing-license finding. This instruction is recorded, not presented as an upstream license grant. Do not assign MIT/Defold License or claim the finding resolved.
