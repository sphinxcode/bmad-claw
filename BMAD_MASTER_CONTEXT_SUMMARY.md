# BMAD Master Context Summary for `bmad-claw`

This file is a trimmed, static context brief for implementing `bmad-claw`.

It intentionally summarizes the relevant parts of larger OpenClaw and BMAD user-journey docs so future implementation agents do not need those source documents directly.

## Purpose

`bmad-claw` should make BMAD feel native inside OpenClaw.

That means:

- BMAD personas become persistent OpenClaw agents
- BMAD workflows remain document-driven, not chat-history-driven
- OpenClaw handles plugin install, agent runtime, tools, and session lifecycle
- `bmad-claw` bridges the two systems without re-implementing BMAD internals

## The Two Systems

### OpenClaw provides

- plugin installation and loading
- CLI command registration
- agent runtime and sessions
- tool registration and invocation
- hooks such as `before_prompt_build`
- persistent per-agent workspaces and `openclaw.json` registration

### BMAD provides

- personas
- workflows
- planning/implementation methodology
- artifact progression across phases
- module system:
  - `bmm`
  - `cis`
  - `gds`
  - `bmb`
  - `tea`

## What `bmad-claw` Should Do

`bmad-claw` should sit at the interface layer.

It should:

1. detect BMAD installation
2. read BMAD manifest/config files
3. scaffold OpenClaw agents from BMAD personas
4. expose BMAD workflows through an OpenClaw tool
5. inject light BMAD context into bound agent sessions
6. degrade gracefully to fallback personas when BMAD is missing

It should not:

- clone BMAD into plugin folders as the primary UX
- depend on BMAD chat history
- parse deep internal workflow implementation files unless absolutely necessary
- turn OpenClaw into a custom BMAD runtime fork

## BMAD User Intent Model

The plugin should respect BMAD's real user tracks.

### Main BMAD tracks relevant to `bmad-claw`

- Quick Flow
  - fast path for smaller tasks
  - mostly Barry-centered
  - `QS -> QD`

- Full BMAD Method
  - 4-phase planning-to-implementation path
  - multiple specialist agents

- Brownfield
  - existing codebase documentation and project-context generation
  - especially relevant for OpenClaw users attaching BMAD to an existing repo

- Optional modules
  - `cis` for creativity
  - `gds` for game development
  - `tea` for test architecture
  - `bmb` for builder/meta workflows

## Core BMAD Workflow Reality

The most important BMAD behavior for `bmad-claw` is this:

- BMAD passes context primarily through documents, not long-running chats
- major workflows should usually start in a fresh chat/session
- artifacts are the continuity layer

This matters because OpenClaw encourages persistent agents and sessions, while BMAD expects document-based transitions.

So `bmad-claw` should support both truths:

- persistent agent identity in OpenClaw
- document-first workflow progression in BMAD

## Artifact Chain That Matters

The most relevant BMAD artifact chain is:

1. research or brainstorming
2. `product-brief.md`
3. `prd.md`
4. `ux-design-specification.md` if needed
5. `architecture.md`
6. `epics.md`
7. sprint/story artifacts
8. implementation and tests

For brownfield work, the important artifacts are:

- project documentation
- `project-context.md`

For `bmad-claw`, this means workflow tools and prompts should reinforce artifact continuity, not pretend chat continuity is enough.

## Agent Mapping That Matters

These are the most important BMAD personas to preserve clearly in OpenClaw:

- Mary
  - analysis, research, brief creation, brownfield documentation
- John
  - PRD and epics
- Sally
  - UX
- Winston
  - architecture and readiness
- Bob
  - sprint/status/story coordination
- Amelia
  - implementation
- Quinn
  - QA automation/testing
- Barry
  - Quick Flow / fast execution
- Paige
  - documentation support

The plugin does not need to reproduce the full BMAD CLI experience inside each persona.
It does need to preserve:

- who each persona is
- what kind of work they own
- how to route into the right workflow

## OpenClaw Runtime Behaviors Relevant to `bmad-claw`

From the OpenClaw side, these flows matter most:

### Plugin install

Users should install the plugin with native OpenClaw plugin mechanisms:

- published package / marketplace install
- local linked path for development

Not by manually cloning into `.openclaw/extensions` as the main story.

### Agent turn execution

OpenClaw agents:

- run through session-based execution
- can use tools
- can receive prompt context through hooks
- can persist identity and workspace files

This is why `bmad-claw` should:

- scaffold `SOUL.md` and `AGENTS.md`
- bind only selected BMAD personas
- keep hook context lightweight

### Skill and workflow triggering

OpenClaw already has a skill/tool model.

So `bmad-claw` should not hardwire giant workflow menus into persona prompts.
Instead, it should:

- let personas stay persona-first
- expose workflow invocation through a tool like `bmad_workflow`
- let workflow use remain explicit and intentional

## Product Direction for BMAD Installation

The preferred product model for `bmad-claw` is hybrid:

### Shared BMAD

Good for:

- easy onboarding
- one-time setup
- users who want BMAD available across projects

Default shared location should be OpenClaw-scoped, such as:

- `~/.openclaw/_bmad`

### Project-local BMAD

Good for:

- reproducibility
- pinned project-specific versions
- teams with repo-level BMAD discipline

Project-local BMAD should live at:

- `./_bmad`

### Resolution rule

At runtime:

1. project-local `./_bmad` should win
2. shared BMAD should be fallback
3. fallback snapshot/persona-only mode should remain available

## UX Principle for `bmad-claw`

The plugin should feel simple for casual users and correct for advanced users.

That means:

- easy shared setup by default
- explicit option for project-local install
- clear `status` diagnostics explaining which BMAD source is active
- no ambiguity between plugin install and BMAD install

## Constraints For Implementers

When changing `bmad-claw`, preserve these principles:

1. Keep the manifest boundary.
   Read BMAD config/manifest interfaces, not deep internals, unless unavoidable.

2. Keep fallback mode robust.
   If live BMAD is missing or schema parsing degrades, personas should still work in a limited mode.

3. Preserve OpenClaw-native UX.
   Use OpenClaw plugin install/link flows instead of manual repo-clone instructions as the main path.

4. Preserve persona-first behavior.
   Agents should feel like real OpenClaw personas first, with workflow access on demand.

5. Respect BMAD's document-first progression.
   Persistent OpenClaw sessions should not encourage anti-patterns like trying to run the whole BMAD pipeline as one giant conversation.

## Short Guidance To Reuse In Future Prompts

If another AI is implementing `bmad-claw`, the most important framing is:

"Build `bmad-claw` as an OpenClaw-native bridge to BMAD. Keep BMAD installation hybrid, keep workflow context document-driven, keep personas persistent and lightweight, and avoid turning plugin installation or workflow invocation into a manual or over-coupled experience."
