# Wayside chapel

One occupied tile in all four rotations. Costs 160 gold, 5 planks, 10 stone and
2 metal; construction takes 140 worker-seconds after materials arrive. One
worker serves 32 nearby residents within 16 road tiles. Open 24 hours, including
the night shift; faith improves on actual arrival. Upgrades raise capacity to
64 and 96 without enlarging the footprint. The town needs display, placement
coverage, inspection, guidance, bell sound and warm night lighting include it.

The build menu lists it under Town. Fresh towns include one on the previously
empty roadside tile (19,26), facing northeast. Existing saves are not modified.

## Source art and geometry

Production asset: `public/building-chapel.png`, 1254×1254, four equal 627×627
cells in southwest, southeast, northeast, northwest entrance order. Source is
the steep-roof version `exec-fbe93f72-9edc-4ccd-895b-9634423ec2bd.png`, copied
unchanged from built-in image generation. Original generated files remain in
the Codex generated-images folder. `docs/art-guides/chapel-guide.png` records the
orthographic 2:1 blockout; `scripts/chapel-guide.mjs` reproduces it using world coordinates.
The lower two guide cells include a 45-source-pixel downward packing offset so
their crosses cannot enter the upper frames. This is packing, not deformation.

Initial generation had faint background haze. A background-removal pass made
empty pixels fully transparent; a second pass moved the rear sprites down within
their own cells. Neither correction calls for changing architectural geometry.
Ground anchors are recorded in `building-art.ts`; production measures actual
alpha ground contacts and uses one shared uniform scale across all four views.
The engine supplies its standard 4-pixel stone foundation, six stones per tile.

### Rejected regression — do not repeat

`exec-7db38fe2-f916-411e-9a39-b3f13bb91879.png` is rejected. An attempt to meet a
door-height target raised the walls and flattened the roof; the regeneration
also changed the base angles and proportions. The user's correction was about
losing correct isometric geometry, not just preference or approval. It is not
enough to prompt a generator to preserve projection and assume it complied.
Keep the original geometry guide through structural revisions, compare all four
source views, and reject the result if the overall projection deteriorates.
Do not alter the steep-roof chapel again to chase the isolated door metric.

## Generation prompt

Use case: sketch-to-render. Create one production transparent 2x2 sprite atlas of a tiny 1x1 village chapel for Little Works. Image 1 is the exact geometry blockout: paint onto its planes, maintain its four quarter-turn views and all silhouette coordinates. Image 2 is a MATERIAL AND PIXEL DETAIL reference only, not geometry. Keep orthographic 2:1 dimetric projection, ground edges exactly +/-0.5 slope, upright walls, no perspective. Same compact square chapel in all four cells: top-left entrance southwest, top-right southeast, bottom-left entrance hidden facing northeast, bottom-right entrance hidden facing northwest. Pale limestone lower walls and corner blocks, warm ivory plaster, dark timber trim, deep forest-green tiled gable roof, small OPEN bellcote near the front with one bronze bell and tiny copper cross. Warm amber narrow arched stained-glass windows, same two on each side and one rear window. One simple centered front arched wooden door, modest copper lantern by it, one shallow doorstep. Keep window and door positions/sizes of guide, ordinary human-scale door, do not enlarge window openings. Charming detailed pixel painting like the cottage reference, tactile small clusters, upper-left lighting. The lower wall contact is the same exact 2:1 diamond in each cell. No raised platform or paving foundation, no grass, no ground shadows, no landscaping, no figures, no smoke, no text or dividing lines. The game supplies the stone foundation. Exact equal 627x627 cell composition on a square transparent atlas; generous clear gutters; no stretching or swapping building forms between views.

Follow-up packing instruction: retain the four exact sprites and their size;
translate both lower sprites down by 45 pixels in the 1254×1254 atlas, retaining
true transparency and keeping each full cross inside its 627×627 cell.

## Verification

248 simulation tests pass, including actual midnight chapel visits, one-worker
staffing, pause, capacity, upgrades, save/load and no insertion into existing
saves. All four views were checked with a 22-pixel pedestrian and a cottage in
the production footprint gallery. The source keeps consistent human-scale
windows; the user's steep-roof source takes precedence over the attempted
door-height redesign. Day/night inspector, build-menu costs, placement preview
and narrow viewport were checked in an isolated browser. The guide, source and
actual game captures are retained for future comparisons.
