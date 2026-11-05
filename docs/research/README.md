# Imported research

These files are a historical static-analysis study of a third-party Android game. They may suggest ideas. They are **not** an implementation input, a Rider contract or a source of code, assets or constants.

- **Not verifiable here:** many of the study's links point at external artifacts that were never in this repository. Files kept here, such as `validation.json`, come from the original workspace and do not make its claims verifiable without the absent originals. In the [classification report](https://github.com/bongohorse/rider/issues/517#issuecomment-6646382653), 191 of the 255 link-checker diagnostics for `HCR2_Technical_Reference_for_Rider.md` are such absent targets; the other 64 are working HTML anchors the checker does not recognize.
- **Recommendations R1–R7 are proposals:** none has a verifiable local source. Engine statements cite live, unpinned documentation, and the document's statement that Rider's source and engine version are unavailable is out of date.
- **Implementing an idea:** use [engine references](../ENGINE_REFERENCES.md) and the [contracts](../contracts/) for the pinned engine, and measure in Rider.
- **Do not recreate** the absent trees, and do not edit historical claims to satisfy the link checker.
- **Removed evidence:** the whole `docs/research/evidence/` folder, including symbol listings derived from the third-party binary and their collection scripts, was deleted by maintainer decision ([#533](https://github.com/bongohorse/rider/issues/533)). The study's links, paths and recorded hashes for that folder no longer resolve, and the PASS in `validation.json` predates the removal. The files remain in Git history.
