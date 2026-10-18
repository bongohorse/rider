# Native Automation Bridge

Debug-only automation for native builds. Rules for all automation interfaces: [automation contract](automation.md). Toolchain pins: [TOOLCHAIN_LOCK.md](../TOOLCHAIN_LOCK.md).

**Contents:** [Setup and commands](#setup-and-commands) · [Tested behavior](#tested-behavior) · [Limits and license](#limits-and-license) · [Network boundary](#network-boundary) · [Network test procedure](#network-test-procedure)

## Setup and commands

Pinned release 2.5.0, commit `567c7efb2f72626af71967984bd33dde856f0d36`. `tools/setup_bridge.py` verifies the source ZIP SHA-256, uses the upstream atomic installer and verifies all 28 wrapper files. The managed `automation-bridge-python/` directory is generated and ignored; project scripts stay outside it.

```sh
python tools/setup_bridge.py
bash tools/doctor.sh --require-g2 --json
# Linux with a real display, or Xvfb plus Mesa runtime libraries:
xvfb-run -a -s '-screen 0 1280x720x24' bash tools/verify.sh --suite bridge --output artifacts/g2/bridge
# Interactive native fixture (Windows: ./tools/build.ps1):
bash tools/build.sh --target desktop --configuration debug --fixture bridge --output artifacts/bridge-debug
```

`doctor --require-g2` verifies JDK, Bob hash and wrapper source without launching anything; missing prerequisites are BLOCKED (exit 2). Run the bundled executable and use the engine-service port printed by **that owned process**: add `automation-bridge-python` to `PYTHONPATH`, then `from automation_bridge import engine` and `engine.connect(observed_port, required_capabilities=(...))`. No editor discovery or port scanning. The Editor HTTP API (`.internal/editor.port`) is a different service; no editor session is assumed. No `/eval` route is invoked.

## Tested behavior

The `main/bridge/` fixture publishes run-ID/source/engine-bound state and a title/counter GUI. The Linux graphical smoke:

1. Builds the native **debug** engine against the pinned dependency.
2. Owns the process with a dynamic engine-service port; matches PID, build identity and run ID.
3. Negotiates scene/element/state/input-receipt/screenshot capabilities.
4. Finds `Bridge Smoke`, checks count 0, sends SPACE, waits for the input receipt and count 1.
5. Captures before/after screenshots and requires visible change.
6. Builds/starts **release**, requires a fresh readiness file with absent Lua module, and proves the live process has no TCP listeners.

The CLI emits JSON v1 and JUnit; setup errors, missing results or timeout cannot pass. Timeout cleanup covers owned descendant process groups (Linux PID-namespace regression; Windows `taskkill /T`). Windows runs the physics suite with pinned Mesa software OpenGL (not GPU evidence). HTML5 clears the native dependency through a Bob override.

## Limits and license

| Field in the pinned source | Value |
|---|---|
| GitHub release | 2.5.0 |
| Python package | 3.0.0 |
| Reported native constant | 2.0.0 |
| Actual API version / wrapper range | 2 / 2..2 |
| Upstream health min/max metadata | 1..1 (recorded inconsistency) |

Negotiation and all tests pass despite the legacy metadata; no upstream code was patched. License provenance is **unresolved**: the maintainer explicitly authorized implementation after the missing-license finding. This is not an upstream license grant; do not assign MIT/Defold License or claim the finding resolved. Remove the Bridge from release binaries before Phase B distribution ([release boundary](automation.md#release-boundary)).

## Network boundary

Open security follow-up: [#112](https://github.com/bongohorse/rider/issues/112). Observed on WSL (2026-10-18): the debug engine binds engine/Bridge, redirect (8002), log and profiler services on **0.0.0.0**; release owned no listeners. A same-Wi-Fi phone request timed out, which does not prove LAN isolation.

- The extension registers `/automation-bridge/v2` on the engine web server; it does not create a loopback-only server. Pinned [`EngineService::Init`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine_service.cpp) creates the service and redirect; [`dmHttpServer::Connect`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/dlib/src/dlib/http/http_server.cpp) binds `DM_UNIVERSAL_BIND_ADDRESS_IPV4` with no bind-address parameter.
- The wrapper's `127.0.0.1` destination restricts the client, not the server. Wildcard bind plus local health is insufficient for network acceptance.
- Until #112 is resolved: run only owned, short-lived debug processes; no public forwarding, tunnels or firewall changes without administrator approval; do not patch pinned dependencies.

## Network test procedure

Use only for a coordinated #112 test.

1. Observe WSL mode with `wslinfo --networking-mode`; record unexpected modes verbatim.
2. Run only the owned fixture under Xvfb with `DM_SERVICE_PORT=dynamic`; capture its PID and announced port. Correlate `/proc/<PID>/fd` socket inodes with LISTEN rows in `/proc/<PID>/net/tcp{,6}`; save only matching `ss -ltnp` rows.
3. Connect locally and verify health identity matches the PID. A connection to the host's own LAN address is a self-connect, not off-host evidence.
4. Second device (maintainer, trusted LAN, agreed window): `curl --noproxy '*' --connect-timeout 3 --max-time 5 http://<HOST_LAN_IPV4>:<PORT>/automation-bridge/v2/health`. Health only; no input/eval, port scans, public addresses or tunnels. Record result and timestamp.
5. Stop the fixture, verify PID/socket cleanup, repeat the same request to confirm it no longer answers.
6. For release: delete the readiness file first, require a fresh record and no listeners. Terminate and reap every owned process, including Xvfb.

Read-only Windows inspection: `netsh interface portproxy show all`, `Get-NetFirewallProfile`, `Get-NetFirewallHyperVVMSetting -PolicyStore ActiveStore -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'` and the applicable active rules (default Block alone is no proof). Prefer an upstream-supported loopback bind; otherwise propose an administrator-reviewed firewall restriction covering all debug listeners and both IP families. A failed IPv4 request does not certify IPv6 or internet isolation.
