# Toolchain candidates — source evidence, not runtime approval

Checked 2026-10-15 through official release/tag APIs. Machine-readable source identities and published asset digests are in [toolchain-candidates.json](../tools/toolchain-candidates.json).

| Component | Candidate | Evidence / limitation |
|---|---|---|
| Defold / Bob | 1.14.0, commit a81dbb0478e8b73931dc2d671563204f6ac0ef82 | [Release](https://github.com/defold/defold/releases/tag/1.14.0); exact release SHA-256 digests recorded. Assets not downloaded or independently hashed in G0. |
| JDK | OpenJDK 25 | [Bob manual](https://defold.com/manuals/bob/); vendor/build selected and verified in G1. Local cloud host currently has JDK 17, not candidate readiness. |
| Automation Bridge | 2.5.0, commit 567c7efb2f72626af71967984bd33dde856f0d36 | [Release](https://github.com/defold/extension-automation-bridge/releases/tag/2.5.0), minimum Defold 1.13.1 in release notes. No integration in G0. |
| Python | 3.14.8 for bootstrap CI | Official actions/python-versions manifest confirms Windows/Linux x64 binaries. Local host remains 3.12.14. Tooling only, not game runtime. |
| Node | 24.21.0 for CI; Renovate requires ^24.11.0 | Tooling only; local 24.19.0 meets Renovate requirement. |
| Renovate | 44.161.0 | [Release](https://github.com/renovatebot/renovate/releases/tag/44.161.0); exact dependency and transitive lockfile. |
| PyYAML | 6.0.3 | [Release](https://github.com/yaml/pyyaml/releases/tag/6.0.3); YAML parsing for bootstrap checks. |

Actions use verified release-tag commit SHAs, recorded in the JSON. SHA comments allow Renovate to retain version context. Runners: ubuntu-24.04 and windows-2025; runner labels fix image family, not immutable image contents. CI logs identify the actual runner.

## Licenses

Defold's [LICENSE.txt at 1.14.0](https://github.com/defold/defold/blob/1.14.0/LICENSE.txt) is Defold License 1.0, not a guessed MIT license. Verify bundled third-party terms during integration. PyYAML and Renovate have their own upstream license files retained by development-tool installs.

**Bridge license unresolved:** the recursive 2.5.0 tag tree contains no LICENSE/NOTICE-named file. This is an unresolved permission/distribution question, not a legal conclusion. Resolve against authoritative upstream terms before G2 integration; do not silently substitute a license or vendor the code. Source verification is complete; license readiness for that candidate is not.

## Pin policy

G0 records candidates; G1 approves Engine/Bob/JDK only after required Windows/Linux/HTML5 checks. G2 adds compatible Bridge plus Python wrapper. Pinning is not Android approval. Later platform evidence extends the matrix; version changes require a reviewed update and affected regression. Published digests are provenance, not proof of a local download verification.

## Network / native builds

G1 must verify whether the selected app manifest/backend needs an engine/native build. Do not assume Extender independence. G2 must test the required native Bridge buildserver and matching SDK. Record server, channel, cache identity and one clean build. Missing network/permissions are BLOCKED, not permission to introduce a custom toolchain.
