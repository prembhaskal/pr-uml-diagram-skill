---
name: pr-uml-diagram
description: Builds an interactive, zoomable UML-style component diagram from one or more GitHub PRs, showing which blocks (modules, files, classes) and links were added, changed, or removed per PR, with click-for-details. Outputs a Cursor canvas and/or a standalone browser HTML file. Use when the user asks for a UML, architecture, or component diagram of a PR, a PR stack, or a set of PRs.
---

# PR → UML diagram

The agent only authors a `data.json`. Scripts extract the diff facts and render both outputs from shared templates, so the rendering code never needs to be regenerated.

## Workflow

```
- [ ] 1. Extract PR facts
- [ ] 2. Model blocks, lanes, links → data.json
- [ ] 3. Build + validate
- [ ] 4. Report
```

### 1. Extract PR facts

Run the script (`SKILL_DIR` = this skill's directory). PR args can be numbers (when run inside the repo) or full PR URLs:

```bash
SKILL_DIR/scripts/extract_pr_symbols.sh <repo-dir> <pr> [<pr> ...]
```

It prints title/state/base, per-file `+/-`, and added (`+`) / removed (`-`) declarations from non-test files. If you need more context for a specific file, run `gh pr diff <pr> | awk` scoped to that file rather than reading the full diff. For each PR, also read the PR body summary (`gh pr view <pr> --json body`) to learn the intent.

**Order PRs** in the order they stack or merge (base first). For stacked PRs, a PR whose base is another PR's head branch comes after it.

### 2. Model the diagram

Write `data.json` to `.work/pr-uml/<name>.json` in the workspace, or to `/tmp` if there is no workspace. Schema:

```json
{
  "title": "…", "subtitle": "repo · path prefix · source",
  "prs":   [{ "n": 776, "title": "…", "state": "MERGED", "base": "master", "files": 22, "add": 2267, "del": 49, "url": "https://…/pull/776" }],
  "lanes": ["core", "policies", "request path", "library", "external"],
  "nodes": [{ "id": "provider", "label": "cors_provider", "file": "policies/cors/cors_provider.go",
              "lane": 2, "external": false,
              "prs": { "780": "A", "804": "C" },
              "summary": "One or two sentences on what it does and what changed.",
              "members": [{ "name": "processPreflight(pc)", "change": "A", "pr": 780 }] }],
  "edges": [{ "from": "flow", "to": "provider", "label": "processCorsRequest", "pr": 804, "change": "A" }],
  "notes": [{ "tone": "warning", "title": "…", "text": "…" }]
}
```

Modeling rules:
- **Block** is one cohesive unit: a file, or a type/class when one file holds a main type. Collapse helpers such as log, constants, and mocks into one block, or omit them. Aim for 10–30 blocks.
- **`prs` map**: `A` when the PR created it, `C` when the PR modified it, `R` when the PR deleted the whole file or type. Blocks that already existed and were untouched but are needed for context get `{}`.
- **Members**: added, changed, or removed functions, types, and consts, each with the PR number. Group trivial ones into one line.
- **Edges**: calls, registration, implements, injection, or network. Use `pr: 0` for context links that already existed. Use `R` for links a PR broke, such as a removed call or guard. Labels should be short and name the function.
- **Lanes**: 3–6 columns, ordered by layer, for example entry/registry, then policies, then logic, then library, then external. `external: true` gives a dashed pill for other services and third-party libraries.
- Nodes auto-stack in array order within a lane. Order them so connected blocks sit at similar heights. An optional `"y"` in px overrides the position (rows start at 50 and are 90 apart).
- **Notes**: discrepancies worth flagging, such as a PR description that contradicts the code, a risky removal, or a missing test.

### 3. Build

```bash
python3 SKILL_DIR/scripts/build.py <data.json> \
  --canvas ~/.cursor/projects/<workspace>/canvases/<name>.canvas.tsx \
  --html   ~/Downloads/<name>.html
```

- Both flags are optional, but pass at least one. The default is both, unless the user asked for only one.
- The script validates node ids, lanes, and change codes, and exits non-zero with the errors. Fix `data.json` and rerun.
- The canvas must be written directly under the workspace `canvases/` directory. Follow the `canvas` skill's path rules.

### 4. Report

Keep it brief. Include a link to the canvas `.canvas.tsx`, the HTML path (`open <path>` shows it in a browser), and 1–3 notable findings.

## Outputs

| Output | Opens in | Notes |
|---|---|---|
| `.canvas.tsx` | Cursor only, beside chat | Uses host theme. Not viewable in a browser. |
| `.html` | Any browser, offline | Self-contained with no dependencies. Follows OS light/dark. Shareable by Slack or Drive. |

Both support scroll to zoom, drag to pan, a filter to one PR's delta, hover to highlight links, and click for block details.

## Resources

- Renderers (do not edit per run): `templates/diagram.canvas.tsx`, `templates/diagram.html`
