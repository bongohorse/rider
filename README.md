# Rider

A 2D mobile driving game built with Defold and integrated Box2D 3, combining precise arcade handling with short Trials- and early-TrackMania-inspired obstacle challenges.

[HTML5 preview](https://bongohorse.github.io/rider/) · [Current status](STATUS.md) · [Documentation](docs/README.md)

Start with STATUS.md for progress and blockers, then read only the plan or contract needed for the task. Android is the first release target; iOS follows the Play Store launch. The public preview is permanently authorized for automatic deployment on merges to main and manual dispatch; the pipeline builds and checks the release gym before publishing.

The M1 gym is unrestricted practice: **W / Up** throttle, **S / Down** brake, **R** retry at the start. Retry clears held input; release and press again to resume driving. The lower edge shows the build commit. Reopen the preview root link to load the newest build. Phone loading can be checked now; touch driving arrives in A13.

## Development

See [tooling](docs/TOOLING.md) and the [pinned toolchain](docs/TOOLCHAIN_LOCK.md) for setup, build and verification commands. UI and active agent documentation are English. No code or assets are imported from the former buggy project.

## Licensing

No project-wide redistribution license has been selected. Public visibility does not grant a software license. Third-party dependencies retain their terms; the [Bridge provenance finding](docs/contracts/automation/bridge.md) remains unresolved under the user's explicit implementation authorization.
