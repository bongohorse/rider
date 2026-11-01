# Rider

Rider is a 2D mobile buggy-driving game built with **Defold 1.14.0** and integrated **Box2D 3**. It combines precision driving, authored obstacle courses, a playable level editor and a Driving Gym for physics experiments.

[Play the latest deployed HTML5 build](https://bongohorse.github.io/rider/) · [Project status](STATUS.md) · [Development plan](docs/PLAN.md) · [Documentation index](docs/README.md)

## Play and test

- **Levels:** select a course, drive from START to FINISH, collect coins and Wonder Gems, manage fuel, then see your time, medals, rewards and saved progress. Retry and Next Level use the same run lifecycle.
- **Editor:** create and modify courses, position START/FINISH and pickups, edit terrain and Terrain Look, save/reopen designs and switch between Edit and Play. The [level-editor contract](docs/contracts/level-editor.md) documents supported operations and limits.
- **Driving Gym:** use the practice stations for ramps, gaps, jumps, seams, suspension, air control, balance and repeatable tests. This is a developer/test area, not the regular level-selection flow.

**Desktop Gym controls:** W / Up = throttle; S / Down = brake/reverse; A/D = pitch; R = Retry. H opens in-game help for context-sensitive controls; touch controls are available on mobile, with tilt opt-in. Station/preset examples: `?station=air` and `?preset=a`. See [Gym notes](main/gym/README.md) for the current command set.

The deployed build may lag behind an unmerged PR. Check the site's [build.json](https://bongohorse.github.io/rider/build.json) for the deployed source SHA. A local preview is not evidence of a deployed or physical-device release.

## Development

**Local first:** T3 Code or VS Code on Windows/WSL2, a pinned Bob/Defold toolchain, optional local loopback Extender, focused checks and GitHub `required` CI for final verification. Follow the [local T3 setup](docs/LOCAL_T3_SETUP.md), [tooling guide](docs/TOOLING.md), [toolchain lock](docs/TOOLCHAIN_LOCK.md) and [agent rules](AGENTS.md). Only approved issues/PRs authorize changes.

**Targets:** HTML5 preview today; Android is the first planned app-store release, iOS later. Playwright desktop/touch emulation does **not** replace real phone performance, touch and installation tests. Known gaps are tracked in [STATUS.md](STATUS.md) and the [platform matrix](docs/PLATFORM_MATRIX.md).

## Licensing

No project-wide redistribution license has been selected. Public visibility does not grant a software license. Third-party dependencies retain their terms; the [Bridge license finding](docs/contracts/bridge.md#limits-and-license) remains unresolved under the maintainer's implementation authorization.
