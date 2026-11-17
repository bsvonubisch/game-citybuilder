# Sawmill animation alignment

The current atlas has 627 × 627 cells. Its visible blade hubs are at (223, 400)
and (402, 412) in the first two cells. `sawmill-motion.ts` records these measured
anchors and the blade planes; `building-art.ts` uses the same anchors.

The blade's horizontal diameter slopes −0.5 in the first view and +0.5 in the
second. Animated highlights follow that projected disc and stay inside its teeth.
Only the half above the sloping bench is visible. Sawdust starts at the cutting
edge and uses the same source-to-world transform, rather than independent screen
offsets. Rear walls hide the machinery; inactive sawmills use the static artwork.

No building sprite, footprint, scale or foundation changed. Checked six animation
phases in each front view, both rear views, stopped production and the production
build. The regression check samples a full cycle against the exposed blade and
bench line so highlights cannot drift onto the wall or through the table.
