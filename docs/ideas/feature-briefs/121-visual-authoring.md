# Visual authoring, decoration and atmosphere

**Source:** [Issue #121](https://github.com/bongohorse/rider/issues/121) · **Issue status on 2026-11-04:** in progress · **Type:** historical planning reference.

> **Reference, not implementation approval.** V1 terrain look and perspective are already delivered; later stages concern materials, decoration and atmosphere. Current GO and scope remain in the live issue. Current GitHub issues, child tasks and active contracts are authoritative.

**At a glance:** Drive the track first, then apply section looks, scenery and atmosphere; preserve editable source, seeds and measured mobile budgets.

**Contents:** [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [Direction](#direction) · [Natural perspective and live tuning (2026-10-26)](#natural-perspective-and-live-tuning-2026-10-26)

Split out of [#118](https://github.com/bongohorse/rider/issues/118) on 2026-10-18 so the editor MVP issue (LE1–LE6) stays a focused implementation contract. Content moved unchanged.

**Delivery status (2026-10-28): V1 Terrain Look is delivered (#278 / PR #294), following #290 / PR #291 and #292 / PR #293.** This epic stays open for **later decoration/population (V2), atmosphere (V3), and real-device art/performance acceptance**. No GO for those future stages. The original editor MVP #118 and Editor A #167 are already completed; gameplay objects/events remain #120.

## Research basis and approved delivery plan

Plan approved by Claudio on 2026-10-24: prioritize **long, visually substantial 2D courses that are fast to author and smooth to play**. Issue creation approves backlog organisation, not runtime implementation or a new milestone. Preserve the existing per-task scope/GO/drive-test process.

Historical idea sources, not implementation inputs ([provenance](https://github.com/bongohorse/rider/blob/main/docs/research/README.md)): [HCR2 technical reference](https://github.com/bongohorse/rider/blob/main/docs/research/HCR2_Technical_Reference_for_Rider.md), [asset/graphics findings](https://github.com/bongohorse/rider/blob/main/docs/research/assets_findings.md), [native findings and limitations](https://github.com/bongohorse/rider/blob/main/docs/research/native_findings.md). Original shader math supports terrain-body extension, depth/UV changes and authored lighting; some original models have depth coordinates. HCR2's full CPU mesh generator, projection, chunk/culling policy, physics laws and numerical tuning are not recovered. Treat our architecture as independent Rider work, using Rider-owned art/code.

### Delivered V1 foundations

- [x] #290 — subtle camera-dependent perspective comparison with live tuning (PR #291 merged; technical owner #263).
- [x] #292 — projection integrated into ordinary Play/Edit with legacy Depth compatibility (PR #293 merged; owner #263).
- [x] #278 — Terrain Look authoring for the selected course/section, live preview and persisted Undo/Save behavior (PR #294 merged).

**Next potential stage (not approved for implementation):** scope a narrow V2 decoration/population experiment only after visual priorities and realistic mobile/render budgets are agreed. V3 environment/atmosphere remains later.

#263 owns the early flat/faux-depth/shallow-mesh comparison (#273), vertex/UV/layer contract, runtime meshes, local rebuilds, active resources and resource budgets. This epic owns choosing/applying a small material/palette/look preset in the editor and preserving it through source edits, Undo and Save/Reload. The preferred direction remains clear 2D toy-style presentation; the depth treatment is selected through the prototype, without distorting 2D vehicle art or changing collision.

Prioritized flow: draw → drive → correct → apply terrain look to a section → place supported objects → drive the complete course. The first task covers edge/top/side/body fill. Decoration population, atmosphere/weather and richer effects stay later, constrained by measured memory/draw/overdraw/particle budgets. Store versioned visual parameters and actual seeds where generation needs them; preserve locked/manual work during regeneration.

Completed #118 and #167 are reused. Long-course previews/local rebuilds belong to #275, resource-specific diagnostics to #277, construction tools to #168 and test workflow/navigation to #169. This is not a second editor implementation.

## Direction

**Claudio's direction (2026-10-18):** first build and drive the level as lines; then press a button to generate its colours/textures; next populate smaller visual objects such as grasses, bushes, stones and debris; later add parallax backgrounds, weather, lighting, day/night, fog and mood. Gameplay objects and their event system are tracked separately in [#120](https://github.com/bongohorse/rider/issues/120); their eventual editor integration follows the respective game mechanics.

**Updated scheduling:** V1 is complete; Editor A #167 is complete. Selected construction and testing tools in #168/#169, the short gameplay loop in #262, and separately approved V2/V3 slices may continue according to the current product priority. These future packages are planning only until explicit GO; variants remain in #180 and longer-term authoring in #170.

### Staged authoring workflow

| Stage | Author action | Generated / edited output | Simulation effect |
|---|---|---|---|
| **V1 Terrain Look / Generate Look** | Choose an environment/art preset, palette, texture scale and seed; generate the course or selected section | Ground fill below the source terrain, surface-edge treatment, colours/textures and transitions; visual mesh/asset strategy verified against the pinned engine | Visual only; no geometry/collision/tuning changes |
| **V2 Populate / decoration** | Set density, size/variant ranges, allowed regions and seed; populate selected areas | Grass, bushes, small stones, debris and other small authored visual assets, placed using slope/clearance rules | Visual only; no bodies/colliders |
| **V3 Environment / atmosphere** | Choose a coherent preset, then adjust individual values | Parallax background layers; time of day, light colour/intensity, fog, weather and overall mood | Visual only initially; physical grip/forces are separately authored mechanics |
| **Later gameplay integration ([#120](https://github.com/bongohorse/rider/issues/120))** | Place supported game objects and expose their parameters/connections | Gameplay runtime and object catalogue owned by #120 | Outside editor MVP; follows each supported mechanic |

Example environments: toy garden, forest, desert, snow or workshop. Keep **one coherent chosen 2D art style** across environments; these examples do not replace concrete art/depth approval. For example, all environments could share the chosen plastic-toy treatment rather than each using unrelated art.

Typical workflow: **build line course → drive-test → Generate Look → Populate → set Environment → adjust selected results → save → drive again**.

### Generator and data rules

1. **Terrain sources remain authoritative.** Generated visuals attach to stable source objects/regions and never rewrite physics chains, add collision seams or change vehicle tuning. Terrain rendering optimisation and cosmetic generation are separate concerns.
2. **Deterministic generation.** Save the generator version, preset/asset references, parameters and seeds needed to reproduce the appearance. Same supported inputs produce the same result. Define migration/regeneration policy before changing a generator or preset; an update must not silently restyle existing courses. Normal generation uses reusable authored assets and procedural placement suitable for offline use.
3. **Separate authoring layers.** Keep physics, generated visual content, manual decoration and atmosphere settings distinguishable. A decorative rock has no collision; a solid or moving rock/ball is a separately placed gameplay object.
4. **Non-destructive regeneration.** Generate the whole level or only a selected section. Preserve manual edits, locked placements and excluded regions. Show the generation scope/result before committing where needed; Generate/Populate/Re-generate is a coherent Undo action. Whole-level regenerate must not discard protected work.
5. **Controlled population.** Expose useful density/scale/variation controls and keep placement within allowed areas. Apply slope/spacing/clearance rules, exclusions around START/FINISH and readable approach/landing edges. Decorations do not obstruct the vehicle, gaps, goal or camera readability.
6. **Terrain changes invalidate the right visuals.** Decide how moved/reshaped terrain updates attached visuals and what happens to manually adjusted placements. Mark affected regions stale or regenerate them deliberately; do not leave floating grass or silently delete hand work.
7. **Environment presets remain editable.** A preset can combine sky/far/near parallax layers, palette, daylight/morning/evening/night, light, fog colour/strength and clear/rain/snow weather. Store parameters; changing mood does not alter the course. Visual rain and a physically slippery surface are independent settings. A real changing day/night cycle or physical weather is a later mechanic, not implied by a static time-of-day preset.
8. **Performance and quality tiers.** Measure visible elements, draw calls/batching, texture memory, overdraw/transparency, particles and generation cost on the reference phone. Reduce decoration/effect density by quality tier without changing gameplay or the authored track. Visual asset tiling/UV scale and clipping at terrain joins need explicit checks. No promise of unlimited detail or a specific mesh/lighting API before engine verification.
9. **Usability.** Show which objects are generated, manual or locked; allow selecting/removing individual generated results, changing a seed and rerunning only the intended stage. Hide/lock visual layers while editing terrain; previews may simplify expensive effects.
10. **Prepare boundaries, not unused systems.** LE1–LE6 need stable IDs, versioned source documents and separation from runtime state. Do not implement generator schemas, asset pipelines, atmosphere controls or event frameworks prematurely just to reserve them.

### Later editor integration of gameplay objects

The complete gameplay-object catalogue, events, examples and runtime/reset/performance requirements have moved to **[Gameplay epic #120](https://github.com/bongohorse/rider/issues/120)**. They are outside LE1–LE6 and are not a dependency for the editor MVP. This issue keeps only the later integration boundary: expose placement, parameters, safe previews and wiring once each actual game mechanic is supported. Cosmetic generation does not create colliders or gameplay behaviour.

### Acceptance direction for the later visual stages

- Generating or changing visual quality leaves compiled collision geometry and vehicle settings unchanged.
- Save/reload reproduces the same supported look; generator updates cannot silently destroy/rebuild locked/manual decoration.
- Moving terrain has a defined, visible consequence for attached decoration.
- A dense decorated test course remains readable and is measured on the reference phone.
- Decorative instances remain non-colliding; gameplay-object reset/activation acceptance belongs to [#120](https://github.com/bongohorse/rider/issues/120).

## Natural perspective and live tuning (2026-10-26)

Claudio wants apparent perspective to vary naturally as the camera moves past **stable world geometry**, subtly, with no swelling, breathing, bending or arbitrary direction/speed-driven stretching. The earlier generated concept image does not override this requirement. The driving edge and physics remain 2D and aligned.

**Delivered sequence:** #277 → #290 / PR #291 → #292 / PR #293 → #278 / PR #294. The same width, perspective, angle, depth and shading contract is reused in the live Terrain Look UI, with the driving edge fixed and legacy compatibility retained. Next design work is V2 decoration/population and later V3 atmosphere, **not** another shader/control framework; each needs separate GO, art checks and measured mobile budgets.
