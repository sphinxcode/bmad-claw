# BMAD Master Implementation Brief

## Objective

Improve `bmad-claw` so BMAD setup feels native inside OpenClaw:

- published installs use the standard OpenClaw plugin flow
- local development uses OpenClaw's local-link flow
- BMAD itself supports a hybrid resolution model:
  - shared OpenClaw-managed BMAD for convenience
  - project-local `./_bmad` override for reproducibility

This brief is meant as a handoff to another AI or engineer so they can implement the change without rediscovering the plugin architecture.

Use alongside:

- [BMAD_MASTER_CONTEXT_SUMMARY.md](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/BMAD_MASTER_CONTEXT_SUMMARY.md:1)

That summary is the trimmed static context for BMAD/OpenClaw user-flow assumptions relevant to this plugin.

## What `bmad-claw` Is

`bmad-claw` is not BMAD itself.

It is an OpenClaw plugin that:

1. detects a BMAD installation or falls back to bundled persona snapshots
2. reads BMAD's published manifest interface
3. generates OpenClaw-facing identity files for BMAD personas
4. registers those personas as persistent OpenClaw agents
5. exposes BMAD workflows through an OpenClaw tool
6. injects thin BMAD session context through an OpenClaw hook

It does not execute BMAD's internal workflow files directly. It stays at the manifest/interface layer.

## Current Architecture

### Plugin entry and registration

- [index.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/index.ts:1)
- [src/register.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/register.ts:1)

The plugin registers:

- tools:
  - `bmad_status`
  - `bmad_install_guide`
  - `bmad_workflow`
- hook:
  - `before_prompt_build`
- CLI tree:
  - `openclaw bmad ...`

### CLI surface

- [src/cli/register.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/cli/register.ts:1)

Current commands:

- `openclaw bmad install`
- `openclaw bmad install-bmad`
- `openclaw bmad sync`
- `openclaw bmad status`
- `openclaw bmad config set-home`

### Detection and resolution

- [src/lib/bmad-paths.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/lib/bmad-paths.ts:1)
- [src/discovery/bmad-detect.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/discovery/bmad-detect.ts:1)

Current resolution order:

1. configured `bmadHome`
2. `cwd/_bmad`
3. `~/.openclaw/_bmad`

This is already close to the desired hybrid behavior, but the product UX does not explain it clearly and the config model is too narrow.

### BMAD interface boundary

- [src/discovery/manifest-reader.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/discovery/manifest-reader.ts:1)
- [src/discovery/fallback-catalog.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/discovery/fallback-catalog.ts:1)

The plugin intentionally reads only BMAD's published/config-layer files:

- `_bmad/_config/agent-manifest.csv`
- `_bmad/_config/manifest.yaml`
- `module-help.csv`

If live manifest parsing fails or BMAD is missing, the plugin falls back to committed snapshot assets in `assets/fallback/`.

### Identity generation and OpenClaw integration

- [src/identity/generator.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/identity/generator.ts:1)
- [src/identity/syncer.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/identity/syncer.ts:1)
- [src/config/writer.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/config/writer.ts:1)

Current flow:

1. detect BMAD context
2. generate `SOUL.md` and `AGENTS.md` per persona
3. write source-of-truth identity files into:
   - `~/.openclaw/identity/bmad/<agentId>/`
4. seed session workspace files into:
   - `~/.openclaw/workspace-<agentId>/`
5. register agents in `~/.openclaw/openclaw.json`
6. store plugin config under `plugins.entries["bmad-claw"].config`

### Hook and workflow tool behavior

- [src/hooks/before-prompt-build.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/hooks/before-prompt-build.ts:1)
- [src/tools/bmad-workflow.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/tools/bmad-workflow.ts:1)

Important behavior:

- only bound BMAD agents get the hook context injection
- the hook injects a thin module/version banner
- `bmad_workflow` resolves a workflow by menu code, skill name, or fuzzy name/description
- if BMAD is not installed, the tool tells the user to install BMAD or use the install guide

## Current Product Gaps

### 1. Install identity mismatch

- [package.json](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/package.json:2)
- [package.json](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/package.json:11)
- [README.md](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/README.md:41)

Current metadata and docs are inconsistent:

- package name is `@sphinx/bmad-claw`
- repo URL still points at `sphinx-codes`
- the actual GitHub repo the user referenced is `sphinxcode/bmad-claw`
- docs and install commands must be aligned to one canonical package identity

### 2. BMAD install UX is under-specified

- [src/commands/install-bmad.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/commands/install-bmad.ts:1)

Current behavior defaults BMAD install target to `process.cwd()`.

That makes per-project install the silent default, even though one of the strongest product advantages would be a shared OpenClaw-managed BMAD home for casual users.

### 3. Config schema is too thin

- [src/config/schema.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/config/schema.ts:1)
- [openclaw.plugin.json](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/openclaw.plugin.json:1)

Current config only stores:

- `bmadHome`
- `boundAgents`
- `defaultMode`

That is not enough to clearly express:

- shared install path
- install preference
- whether current runtime is using a project override or shared path

### 4. Status output is not explanatory enough

- [src/commands/status.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/commands/status.ts:1)

It prints the active source, but not the candidate resolution chain or whether a lower-priority BMAD install is also available.

### 5. README over-promises today

- [README.md](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/README.md:1)

Current docs:

- mix published install and local development mentally
- imply a one-step install story that is not fully real yet
- contain visible encoding corruption

## Target Product Model

Adopt a hybrid BMAD resolution model.

### Intended behavior

1. `bmad-claw` plugin install is separate from BMAD install.
2. Plugin users choose a BMAD strategy explicitly.
3. Shared BMAD is the convenience default.
4. Project-local `./_bmad` overrides shared BMAD automatically.
5. If neither exists, persona-only mode remains available.

### Resolution rule

At runtime, the active BMAD source should resolve like this:

1. project-local `cwd/_bmad`
2. configured shared BMAD home
3. default OpenClaw shared BMAD home such as `~/.openclaw/_bmad`
4. fallback snapshot / persona-only mode

### Important product judgment

Do not copy `BMAD_Openclaw`'s manual clone-into-extensions install flow as the primary UX.

Borrow this idea from it:

- a shared OpenClaw-scoped BMAD install is convenient and valid

Do not borrow this as the primary install surface:

- `git clone` into `.openclaw/extensions/...`
- `npm install` manually

For `bmad-claw`, the native install surfaces should be:

- published:
  - `openclaw plugins install <package-or-clawhub-spec>`
- local development:
  - `openclaw plugins install -l <path-to-local-plugin>`

## Implementation Plan

## Phase 1: Normalize package and documentation identity

### Goal

Make install/distribution naming consistent before improving UX further.

### Changes

1. Update [package.json](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/package.json:1)
   - choose one canonical package name
   - update repository URL to the actual GitHub repo
   - ensure README badges match the final package identity

2. Update [README.md](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/README.md:1)
   - separate:
     - published install
     - local development link/install
   - remove any outdated package scope references
   - fix text encoding corruption

### Acceptance criteria

- package name, repo URL, badge URLs, and docs all refer to the same canonical plugin identity
- README clearly documents local path linking for development

## Phase 2: Upgrade config model for hybrid BMAD sourcing

### Goal

Represent shared BMAD and install preference explicitly instead of overloading one `bmadHome` field.

### Changes

1. Extend [src/config/schema.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/config/schema.ts:1)
   Add fields such as:
   - `sharedBmadHome: string | null`
   - `installMode: "shared" | "project-local" | null`
   - keep `boundAgents`
   - keep `defaultMode`

2. Extend [openclaw.plugin.json](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/openclaw.plugin.json:1)
   Mirror the new config schema fields so OpenClaw sees accurate plugin config metadata.

3. Update [src/config/writer.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/config/writer.ts:1)
   - `writePluginConfig()` should support the new fields
   - `readPluginConfig()` consumers should migrate gracefully if old config only contains `bmadHome`
   - preserve backwards compatibility by treating legacy `bmadHome` as `sharedBmadHome` during reads if needed

### Acceptance criteria

- old config still works
- new config can represent shared BMAD separately from project-local override behavior

## Phase 3: Refactor BMAD candidate discovery and selection

### Goal

Make path resolution explainable, testable, and status-friendly.

### Changes

1. Refactor [src/lib/bmad-paths.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/lib/bmad-paths.ts:1)

   Introduce a richer model, for example:

   - `discoverBmadCandidates(opts)`:
     - project-local candidate
     - configured shared candidate
     - default OpenClaw shared candidate
   - `selectActiveBmadCandidate(candidates)`
   - retain a compatibility wrapper if useful for existing callers

2. Preserve validation behavior:
   - candidate is valid only if `_config/manifest.yaml` exists

3. Clarify source labels:
   - `project`
   - `shared-config`
   - `shared-default`

### Acceptance criteria

- code can report both:
  - active BMAD source
  - lower-priority available sources

## Phase 4: Upgrade BMAD detection layer

### Goal

Return richer detection metadata without breaking persona-only fallback.

### Changes

1. Update [src/discovery/bmad-detect.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/discovery/bmad-detect.ts:1)

   `detectBmad()` should return:

   - current mode
   - active detection
   - candidate list or candidate summary
   - live agents/workflows/versions if active BMAD exists
   - fallback snapshot metadata if no BMAD exists or parsing degraded

2. Keep current manifest-degradation behavior:
   - if a BMAD install exists but agent manifest parsing fails, keep `mode: "full"` and fall back only for persona/workflow catalog data

### Acceptance criteria

- fallback behavior remains robust
- hook/status/install flows can consume richer detection info without reimplementing path logic

## Phase 5: Improve `install-bmad` UX

### Goal

Let users intentionally choose shared or project-local BMAD instead of silently defaulting to `cwd`.

### Changes

1. Update [src/commands/install-bmad.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/commands/install-bmad.ts:1)

   Replace the implicit target logic with:

   - if user passes an explicit directory argument:
     - honor it
   - otherwise prompt:
     - `Install shared BMAD for all projects`
     - `Install BMAD for this project only`

2. Target resolution:

   - shared install:
     - default target should be `~/.openclaw`
     - BMAD then lives at `~/.openclaw/_bmad`
   - project-local install:
     - target should be `process.cwd()`
     - BMAD then lives at `./_bmad`

3. After successful install:
   - shared install updates `sharedBmadHome`
   - project-local install does not overwrite shared config incorrectly
   - `defaultMode` becomes `full`

4. Update CLI description in [src/cli/register.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/cli/register.ts:1)
   - describe the new shared/project-local behavior accurately

### Acceptance criteria

- no-arg install flow is explicit and easy to understand
- shared install becomes the easiest path for new users
- project-local install remains available for disciplined repo-specific setups

## Phase 6: Improve `status` diagnostics

### Goal

Make `openclaw bmad status` explain active behavior and resolution chain.

### Changes

1. Update [src/commands/status.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/commands/status.ts:1)
   Show:
   - mode
   - active BMAD source
   - active BMAD path
   - configured shared BMAD path
   - whether project-local BMAD is present
   - whether a lower-priority shared install is shadowed by project-local BMAD
   - bound agents
   - snapshot/fallback version if persona-only

2. Suggested output style:
   - concise human-readable diagnostics
   - no excessive JSON dump

### Acceptance criteria

- a user can immediately tell why a given BMAD source was selected
- shadowed shared installs are visible

## Phase 7: Keep hook and workflow behavior aligned

### Goal

Ensure runtime behavior follows the new detection rules automatically.

### Changes

1. Update [src/hooks/before-prompt-build.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/hooks/before-prompt-build.ts:1)
   - use the refactored detection layer
   - keep the rule:
     - only bound agents get BMAD context
   - ensure project-local BMAD wins over shared BMAD when both exist

2. Update [src/tools/bmad-workflow.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/src/tools/bmad-workflow.ts:1)
   - use the refactored detection layer
   - preserve current behavior when BMAD is unavailable

### Acceptance criteria

- no duplicate resolution logic
- runtime behavior matches status output

## Phase 8: Test coverage updates

### Existing test surface

- [test/discovery.test.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/test/discovery.test.ts:1)
- [test/install.test.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/test/install.test.ts:1)
- [test/hook.test.ts](E:/AI-Terminal/sphinxcode/open-source/bmad-claw/test/hook.test.ts:1)

### Required test changes

1. Expand `test/discovery.test.ts`
   Add cases for:
   - shared configured only
   - project-local only
   - both shared and project-local present
   - project-local wins when both are valid
   - no valid candidates

2. Expand or rewrite `test/install.test.ts`
   Add cases for:
   - shared install target selection
   - project-local install target selection
   - config migration from legacy `bmadHome`
   - shared config preserved after project-local install

3. Expand `test/hook.test.ts`
   Add cases proving:
   - hook uses project-local BMAD when both sources exist
   - hook remains no-op for non-bound agents

4. Add status tests if missing
   Suggested new file:
   - `test/status.test.ts`

### Acceptance criteria

- tests cover resolution precedence, config migration, and status messaging

## Non-Goals

These should not be mixed into this change unless separately requested:

- redesigning persona templates
- changing BMAD manifest schema
- directly executing BMAD internal step files
- solving OpenClaw's Windows CLI respawn bug
- redesigning OpenClaw plugin installation itself

## Migration Notes

Legacy installs may already store:

- `plugins.entries["bmad-claw"].config.bmadHome`

The implementation should migrate gracefully:

- if `sharedBmadHome` is absent but legacy `bmadHome` exists, treat it as the shared path
- do not break existing users who already rely on the current config field

## Recommended Edit Order

Use this sequence to reduce churn:

1. normalize package metadata and docs wording
2. expand schema and config writer compatibility
3. refactor candidate discovery in `bmad-paths.ts`
4. update `detectBmad()`
5. update `install-bmad`
6. update `status`
7. update hook and workflow tool consumers
8. update tests

## Done Definition

This work is done when:

- package/install identity is consistent
- README clearly distinguishes published install, local dev install, shared BMAD, and project-local BMAD
- shared BMAD can be installed intentionally into OpenClaw home
- project-local `./_bmad` overrides shared BMAD automatically
- status explains active and shadowed BMAD sources
- hook and workflow tool follow the same resolution logic
- legacy config still works
- tests cover precedence and migration

## Suggested Prompt For The Implementing AI

Implement the hybrid BMAD resolution upgrade for `bmad-claw` using the repo-local brief in `BMAD_MASTER_IMPLEMENTATION_BRIEF.md`.

Constraints:

- preserve existing fallback snapshot behavior
- maintain backward compatibility with legacy `bmadHome`
- prefer shared OpenClaw-managed BMAD as the guided install default
- ensure project-local `./_bmad` overrides shared BMAD at runtime
- update docs and package metadata to one canonical package identity
- add or update tests for resolution precedence, install target selection, and status diagnostics

Do not redesign personas or workflow semantics. Keep the change scoped to install UX, path resolution, config, docs, and diagnostics.
