# before_prompt_build

Injects a BMAD module banner into the system context at session start.

## Trigger

`before_prompt_build` — fires before each prompt is built for a bound agent.

## Behavior

- Only runs for agents listed in `boundAgents` (plugin config).
- Resolves the active BMAD install using the full candidate chain:
  `cwd/_bmad` → configured `sharedBmadHome` → `~/.openclaw/_bmad`
- If a valid BMAD install is found, prepends a one-line module version
  banner to the system context (e.g. `BMAD active (bmad-method 6.3.0): bmm@6.3.0 tea@6.3.0`).
- Returns `{}` (no-op) if the agent is not bound, BMAD is not found, or
  any error occurs — never throws, never crashes the session.

## Output

```ts
{ prependSystemContext: string }
// or
{}
```
