# ARCHIVE — finished with, kept anyway

Nothing in here is part of the app. Nothing links to it, nothing loads it,
and deleting the whole folder would change nothing on the live site.

It is kept because these were real pieces of work, and "I might want to look
at that again" is a good enough reason. If you ever want one of them back,
say the word — it is one command.

| File | What it was |
|---|---|
| `feed.html` | A prototype of a scrolling "feed" of exercise cards, Aug 4. Never wired to anything. |
| `hero.html` | The opening screen drawn four different ways, side by side, so you could pick one. You picked one; it now lives in `onboarding.html`. |
| `preview.html` | A page showing several app screens at once during the redesign, Aug 3. |
| `mark-compare.html` | Two versions of the dumbbell mark next to each other, so the better one could be chosen. The winner is in `logo/`. |
| `onboarding.v5.bak` | A saved copy of the survey from version 5, before the artwork went in. The current survey is `onboarding.html`. |
| `hero-torso.png` · `.webp` | A photograph used on an early opening screen. Nothing has referenced it since that screen was replaced. Just under 1 MB between them. |
| `site-netlify-copy-2026-08-25/` | The second copy of the app that Netlify used to publish from its own folder. 138 files, 42 MB. See below. |

## `site-netlify-copy-2026-08-25/` — the one you can delete outright

Everything else in here is kept because it was a real piece of work worth
looking at again. This one is not.

Before it was moved, all 138 of its files were checked against the top level
of the project. **Every single one already existed there**, so the folder held
nothing that is not still live somewhere else. It is here because the rule is
archive, never delete - not because there is anything in it.

Two web addresses used to serve two different apps from one project, and every
update went to one of them while the other stood still since 17 August. The
top level is now the only source, and `netlify.toml` at the root says so.

If the disk space is ever wanted back, this is the folder to take. Git holds
its whole history either way.

## Why moving them mattered

The app builds an "offline shell" — the list of files your phone downloads
once so a workout survives a gym with no signal. That list was built from
"every file in the project", so every one of these was being downloaded onto
every client's phone. They are out of it now.
