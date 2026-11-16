# Working on Little Works

## Art changes

Before creating or replacing building or character sprites, read
`docs/SPRITE-STANDARDS.md` and use its acceptance checks. These are the user's
requirements, established after repeated distorted sprites, oversized windows,
wrong frontages and mismatched footprints. A convincing thumbnail is not enough.

Use an accurate geometry guide before generating building art. Inspect all four
views at the same game scale with a pedestrian, footprint and frontage guide.
Fix bad perspective in the source artwork; never conceal it with a stretched or
sheared upright sprite. Keep shared foundation dimensions and material density.
Record prompts, atlas layout, source coordinates and verification with the change.

Preserve correct isometric geometry through later revisions. The chapel regression
on November 16 is the concrete example: a geometry-guided sprite was followed by
a door-height edit that changed its wall/base angles and architectural proportions.
The user objected to losing correct projection, not merely to changing approved
styling. Keep the original geometry guide as an input to every structural art
edit, compare all four source views before/after, and reject projection drift.
Never trade whole-building geometry for one numeric target such as door height.
Use the earlier steep-roof chapel in `public/building-chapel.png`; the later
flattened-roof/raised-wall generation is rejected. See `docs/CHAPEL.md`.

## Delivery

Publish each completed, checked stage to GitHub and the existing Firebase site
before starting the next stage. Keep the user's stable local preview running;
do not expose incomplete source edits through it. Give concise progress updates
about the current stage and the next queued work. Respect the user's latest
priority order; do not let an older task note override newer user steering.
