---
status: draft
title: Hybrid BMAD Resolution and Install UX
owner: Codex
date: 2026-04-16
---

# Goal

Add a hybrid BMAD install strategy so `bmad-claw` can use a shared OpenClaw-managed BMAD home by default, while still preferring a project-local `./_bmad` when one exists.

This keeps first-run setup simple for casual users and preserves per-project isolation for teams that intentionally pin BMAD per repository.

# Problem

The current plugin already resolves BMAD in this order:

1. configured `bmadHome`
2. `cwd/_bmad`
3. `~/.openclaw/_bmad`

That is directionally good, but the product story is still fuzzy:

- `install-bmad` defaults to installing into `process.cwd()`, which nudges users toward per-project installs even when they just want a shared setup.
- config only stores `bmadHome`, so there is no explicit install preference or source intent.
- `status` reports the active source, but not the fallback chain or whether a project-local override is currently winning.
- docs currently imply a one-step plugin install without clearly separating local-dev, shared BMAD, and project-local BMAD flows.

# User-Facing Outcome

After this change, a user can install the plugin and choose one clear strategy:

- Shared BMAD for all projects
- Local BMAD for the current project

Runtime behavior is predictable:

- If a project contains `./_bmad`, that project-local install wins.
- Otherwise the plugin uses the configured shared BMAD home.
- If neither exists, the plugin falls back to persona-only mode.

# Acceptance Criteria

1. Given a configured shared BMAD path and no project `_bmad`, when `detectBmad()` runs, then it resolves the shared install and reports its source clearly.
2. Given both a configured shared BMAD path and a valid `cwd/_bmad`, when `detectBmad()` runs, then the project-local install wins.
3. Given no valid shared BMAD path and no valid `cwd/_bmad`, when `detectBmad()` runs, then the plugin enters `persona-only` mode using the fallback catalog.
4. Given the user runs `openclaw bmad install-bmad` with no explicit directory, when prompted for install location, then they can choose shared or project-local BMAD.
5. Given the user selects shared BMAD install, when install completes successfully, then plugin config persists the shared BMAD home and future status output reflects that choice.
6. Given the user selects project-local install, when install completes successfully, then the project `_bmad` is used for that workspace while shared BMAD remains available for other projects.
7. Given the user runs `openclaw bmad status`, when BMAD is detected, then output shows the active BMAD path, active source, and whether another lower-priority candidate also exists.
8. Given a new user reads the README, when choosing an install method, then the docs distinguish published install, linked local dev install, shared BMAD, and project-local BMAD.

# Implementation Plan

1. Expand plugin config in `src/config/schema.ts`.
   Add explicit fields for install preference, such as `installMode: "shared" | "project-local"` and optionally `sharedBmadHome`.

2. Refactor path resolution in `src/lib/bmad-paths.ts`.
   Separate candidate discovery from winner selection so status can report:
   - configured shared path
   - project-local path
   - default home path
   - active winner

3. Update BMAD detection in `src/discovery/bmad-detect.ts`.
   Keep the current winning behavior but return richer metadata for status and future prompts.

4. Improve installer UX in `src/commands/install-bmad.ts`.
   Replace the implicit `process.cwd()` default with an explicit prompt:
   - `Shared BMAD for all projects`
   - `Project-local BMAD for this project`
   Resolve the target directory from that choice before calling `npx bmad-method@latest install`.

5. Upgrade diagnostics in `src/commands/status.ts`.
   Show both the active source and any shadowed candidates, for example:
   - active: `cwd`
   - fallback available: `config`

6. Rewrite install docs in `README.md`.
   Document two separate flows:
   - users installing the plugin
   - developers linking a local checkout
   Then explain shared versus project-local BMAD in plain language.

# File Map

- `src/config/schema.ts`
- `src/lib/bmad-paths.ts`
- `src/discovery/bmad-detect.ts`
- `src/commands/install-bmad.ts`
- `src/commands/status.ts`
- `README.md`

# Risks

- Changing detection metadata may ripple into tests and any code that assumes a single `BmadDetection | null`.
- Interactive install prompts must stay simple; too many choices will recreate the UX friction we are trying to remove.
- Shared and project-local wording must be consistent across CLI output and docs, or users will still be unsure which model they are using.

# Test Notes

- Unit-test candidate resolution for config-only, cwd-only, home-only, and mixed-source cases.
- Test installer target selection without shell quoting regressions on Windows paths with spaces.
- Test status output snapshots for shared, local, and persona-only modes.
