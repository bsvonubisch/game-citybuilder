# Matching roads and bridges — November 16

Accepted direction: Woodland Trestle (dirt / timber footpaths), Alpine Stone
(stone roads), Brick & Iron (brick roads). The user approved the actual rendered
road-and-bridge pairs, then requested solid 3D piers and darker water beneath.

## Assets and coordinates

Three original 1254×1254 PNGs are retained, without image retouching:
`public/bridge-woodland-v1.png`, `bridge-alpine-v1.png`, `bridge-iron-v1.png`.
The upper rectangle contains painted decking/paving; the lower rectangle is a
transparent orthographic railing and support profile. The engine projects these
flat material planes on the exact 2:1 grid. It does not skew upright buildings.

Measured crops (x,y,w,h): wood deck (1,1,1252,599); stone/brick deck
(1,1,1252,625). Wood profile x=0..1254, railing y=628..850, supports to1150.
Stone profile x=12..1242, railing y=672..824, supports to1200.
Brick profile x=16..1238, railing y=639..850, supports to1220.
The opaque profile intervals exclude transparent edge margins that had created
vertical gaps. Each arch spans two real grid tiles; phase is resolved against
the authoritative map before applying a camera turn.

Stone and brick roads sample exactly the same material at the same density as
their bridge decks. Dirt uses the existing painted earth with a warmer tint.
The road kinds, costs and speeds are unchanged. Timber stays the footbridge type.

Rails have inner faces and coping. Piers/posts have upright side faces, top caps,
shading and wider stone feet. Abutments close the land/water gap at shore ramps.
Entrance lanterns use the existing copper light artwork on explicit solid posts;
player-placed masonry bridge lights also get a mount. Lanterns join the existing
night illumination system. Occlusion still keeps far rails behind travellers and
near rails in front. Cached water shadows follow connected spans without a dark
stripe per tile. Water is now 12 world pixels below level land, allowing the arch
openings to read; boats, wakes, docks and banks share that same datum.

## Generation record

Built-in image generation, one call for each material. References: matching
`docs/art-guides/bridge-concepts/*.png` accepted concept and corresponding
`*-material-guide.svg` (rendered PNG at generation time). Prompt:

Paint production game textures onto image1, the exact transparent geometry atlas;
image2 is the approved bridge concept and exact material reference. Top half is
a flat seamless deck texture; lower half is orthographic front elevation, not
isometric or perspective. Keep rail at544, deck at688, support feet at928 on the
1024 guide. Preserve transparency and architectural openings. No people, water,
grass, lanterns, labels or ground shadows. Small pixel clusters, tactile grain
and mortar, upper-left lighting. The renderer projects these flat planes 2:1.

Wood: twelve warm planks, nails, dark chestnut rails, iron straps and bolts,
diagonal under-deck braces, stone shoes. Stone: pale limestone ashlar, ivory
coping, broad open arch, radial voussoirs and keystone, moss at feet, slate deck.
Brick: russet running-bond bricks, limestone voussoirs and curb, open green-black
iron railings with loops and balusters. Generation did not retain guide pixel
coordinates exactly; the measured coordinates above are authoritative.

## Verification

Browser captures of all three materials through four quarter-turn views,
real-grid land/bridge joins, raised water edges, matching road surfaces, people
and a delivery vehicle at production scale. Shared arch UVs have regression
tests including reversal and camera turns. Full simulation tests and production
build pass. Comparison captures were rendered by the game, not regenerated
illustrations. The original freeform concept shore scenery is not baked into
any bridge; the game's real terrain and lighting supply its surroundings.

## Current review build

The user requested publication to inspect the bridges in the actual town.
The underside remains a work in progress, not a final art acceptance. The added
block-shaped masonry columns were removed. Continuous inner vault faces now
connect the original side profiles across the road width. Under-deck faces sort
independently and share a water mask so they cannot paint over foreground land.
A native painted stone bridge section is the next art revision; keep the accepted
road materials while reviewing its support geometry.
