# EXERCISE LIBRARY — your artwork

**This folder is yours.** Drop finished exercise artwork in here, full size,
transparent background. That is the whole job.

Nothing here is used by the app directly. I run a tool, and the tool crops,
shrinks and renames each picture into the shape the app needs:

| Your artwork here | becomes | via |
|---|---|---|
| exercise pictures | `images/exercises/*.png` | `tools/build-exercise-images.mjs` |
| exercise pictures | the cards inside the survey | `tools/build-deck-art.mjs` |
| the `Body Shape/` sheets | the body figures inside the survey | `tools/build-avatars.mjs` |

`FOR NICOLAS/IMAGES TO MAKE.md` is the list of what is still missing, most
useful first, with the exact filename to save each one as. It is regenerated
every time the tool runs, so it is never out of date.

The leading space in this folder's name is deliberate — it sorts your folders
to the top in Finder. Do not remove it; some of the tools look for it.
