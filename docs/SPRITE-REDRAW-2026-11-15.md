# Building source redraw, November 15

Eight additional source atlases were redrawn: warehouse, hunter lodge, forester,
cottage, sawmill, copper workshop, church and brickworks. Together with the
previous butcher and tavern replacements, ten building types now have replacement
source art. Other types retain their existing source art and the earlier shared
ground-contact and rotation-scale corrections.

The generation specifications and final edit prompts are in
`sprite-redraw-prompts.json`; the projection blockouts are in `art-guides/`.
The built-in image generator produced these assets. The first warehouse/hunter
generation entries preserve their specifications; later entries preserve the
verbatim prompts. All accepted images live under `public/building-*.png`.

All new atlases have four equal cells in SW, SE, NE, NW order. Most use 627×627
cells. The forester uses 887×443 cells; that rectangular aspect is preserved.
`src/building-art.ts` records ground references and updated chimney/mechanism
anchors. The engine still supplies the same four-pixel stone foundation, and
does not stretch or shear upright art. No gameplay footprint or save-data change.

The hunter and forester received a second detail pass to reduce oversized doors
and windows. The cottage chimney was moved to the centre of the hip roof for a
consistent position in all rotations. Rear sawmill walls now hide the saw effect;
workshop sparks remain at the visible forge instead of following the old conveyor.

Verification uses the production plot renderer, all 88 building/tier views at a
common 1.8 scale, and a trimmed 22-pixel-tall pedestrian. The browser footprint
gallery now trims the person too, so transparent atlas padding cannot make the
comparison character misleadingly small. Source art and rendered views are
visually reviewed in addition to crop, scale and footprint regression tests.
This review is visual acceptance, not a claim that pixel-art perspective can be
certified by an automated test.

Release checks: 166 tests passed; production build passed; all 20 build-menu
previews loaded without browser errors; all 32 rotations of the eight replacement
types loaded in the live placement flow. The desktop town and mobile-sized dusk
view rendered successfully. This is not testing on physical mobile hardware.
