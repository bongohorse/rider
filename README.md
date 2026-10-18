# Rider

A 2D mobile driving game built with Defold and integrated Box2D 3, combining precise arcade handling with short Trials- and early-TrackMania-inspired obstacle challenges.

[HTML5 preview](https://bongohorse.github.io/rider/) · [Current status](STATUS.md) · [Documentation](docs/README.md)

## Playing the gym

The Driving Gym is unrestricted practice with test stations. Reopen the preview root link to load the newest build; the build commit is shown at the bottom.

- **Keyboard:** W/Up throttle, S/Down brake and reverse, A/D lean, R retry, 1–9 stations, V next section, P cycle preset, T tuning, H help, C crash reset, M mute, F copy feedback.
- **Touch:** on-screen zones with mirrored layouts; tilt lean is opt-in.
- **URL:** `?station=<id>`, `&section=<id>`, `&speed=<m/s>`, `?preset=a|b|c`.

## Development

Android is the first release target; iOS follows the Play Store launch. Setup, build and tests: [TOOLING.md](docs/TOOLING.md). Agent rules: [AGENTS.md](AGENTS.md). UI and documentation are English. No code or assets are imported from the former buggy project.

## Licensing

No project-wide redistribution license has been selected. Public visibility does not grant a software license. Third-party dependencies retain their terms; the [Bridge license finding](docs/contracts/bridge.md#limits-and-license) remains unresolved under the maintainer's explicit implementation authorization.
