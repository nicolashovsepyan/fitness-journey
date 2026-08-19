# spine/ — the one shared description of everything

**GENERATED. Do not edit anything in this folder by hand.**

This is the fix for the oldest bug in the project: a push-up existing in four
places under four names, three of them out of date. Now there is one
description, every screen reads it, and no screen keeps its own copy.

Every page fetches these files by name at the moment it opens, so nothing
here can be renamed or moved.

| File | What it is | Rebuilt by |
|---|---|---|
| `catalog.json` | Every movement, its name, its family, its level. | `tools/build-spine.mjs` |
| `art.manifest.json` | Which movements have a picture. | `tools/build-spine.mjs` |
| `benchmarks.json` | The level thresholds, from your CSVs. | `tools/build-spine.mjs` |
| `aliases.json` | Old names pointing at current ones. | `tools/build-spine.mjs` |
| `theme.json` | The colours. | hand-written — the one exception |
| `program.default.json` | The default programme the console opens. | `tools/export-program.mjs` |

Edit one of these directly and your change disappears the next time the tool
runs. Change the source instead — see `tools/README.md`.
