# Cargo delivery vehicles

Eight cargo families replace the randomly chosen delivery truck. Passenger cars
keep their existing art. Every resource is explicitly mapped in
`src/delivery-vehicles.ts`; related food products share a refrigerated-style van.
The inspector names the vehicle and still shows the actual cargo and 12-unit load.
Appearance derives from cargo, so saves, shipments, recovery, and collision bodies
need no migration.

| Sheet | Row | Cargo |
| --- | --- | --- |
| `public/delivery-industrial-v1.png` | 0 | Wood, planks |
| same | 1 | Stone |
| same | 2 | Metal |
| same | 3 | Bricks |
| `public/delivery-town-v1.png` | 0 | Grain, flour, potatoes, carrots |
| same | 1 | Bread, fish, meat, sausages, steaks, roasts |
| same | 2 | Milk, eggs |
| same | 3 | Tools |

Both source sheets are 1774 by 887 RGBA pixels, eight columns by four rows.
Columns are SE, S, SW, W, NW, N, NE, E, matching `travelFacing` directly. Cells
are measured using the production `trimAtlas` alpha bounds. All 64 frames share
one uniform scale: 29 world pixels divided by the mean width of the timber
truck's four diagonal frames. Front and rear silhouettes remain naturally
narrower. Image origin is (0.5, 0.8), consistent with the previous vehicles.
The artwork is never stretched, skewed, flipped, or screen-rotated.

References: existing `vehicles-directions.png` and `vehicles-turns.png` provide
the established compact vehicle scale and all eight yaw directions. The second
new sheet uses the first new sheet as its alignment reference.

Generated with the built-in image tool. Originals are preserved; these are new
versioned project assets. Source alpha was checked: approximately 52% and 51%
fully transparent pixels, respectively. Source atlases and the 64-frame gallery
were inspected at one common scale. Browser checks verify every resource's
texture/frame through all four town rotations, the selected shipment's load,
normal town rendering, and a 390-pixel mobile viewport with no page errors.
The production build passes. Traffic and shipment logic were separately covered
by all 228 tests before this art-only integration.

## Industrial atlas prompt

Use case: stylized-concept. Asset type: production sprite atlas for the cozy Little Works browser city builder. Create a NEW transparent RGBA sprite sheet, wide 2:1 composition, EXACTLY 8 equal-width columns and 4 equal-height rows (32 isolated small delivery trucks). Use the attached atlases ONLY as style, compact vintage 1930s truck proportions, amber lamps, green/copper cozy pixel-art texture, fixed camera/elevation references. No passenger cars. All truck chassis share identical physical dimensions, tires and cabin scale. Orthographic dimetric 2:1 ground projection (diagonal ground axes have screen slopes +/-0.5); parallel lines, vertical upright cabs, no perspective convergence. ROW 1: rust-red timber truck with stacked logs and sawn planks restrained in an open low timber-sided bed. ROW 2: slate-blue stone hauler with gray cut stone blocks in low reinforced bed. ROW 3: dark copper-brown ore hauler with a compact mound of dark iron rocks in a metal-sided bed. ROW 4: burnt-orange brick flatbed with neatly stacked red bricks. Within EVERY row exactly these 8 yaw views LEFT TO RIGHT: 1 front pointing screen LOWER RIGHT (SE), 2 straight FRONT toward viewer screen DOWN (S), 3 front pointing LOWER LEFT (SW), 4 pure side front pointing LEFT (W), 5 rear three-quarter with front pointing UPPER LEFT (NW), 6 straight REAR with front pointing UP (N), 7 rear three-quarter with front pointing UPPER RIGHT (NE), 8 pure side front pointing RIGHT (E). Consistent cargo/chassis on all 8 views of each row. Intermediate views are full real upright views, no tilting the flat image. Each sprite centered in its equal grid cell with generous 15% transparent padding. Fixed scale across entire atlas; front/rear views naturally narrower. Tires touch same baseline in each cell. Detailed crisp hand-painted pixel art with tiny pixel texture and warm highlights; no blur, no ground plane, no cast shadow, no glow outside body, no scenery, NO text/labels/gridlines/captions. Transparent empty background, never a checkerboard painted into pixels. Ensure all 32 views present, no crops or overlaps.

## Town deliveries atlas prompt

Use case: precise-object-edit. Asset type: companion production delivery truck atlas for Little Works city builder. Make a NEW matching transparent RGBA sheet with EXACTLY the same 8 columns x 4 rows, 2:1 wide composition, camera, pixel-art style, compact vintage 1930s vehicle proportions, physical size and the EXACT heading order in the supplied reference. Replace the four industrial truck cargo designs with these four types. ROW1: olive-green farm produce pickup carrying small wooden crates with carrots, potatoes and tied beige grain sacks; no loose vegetables projecting outside bed. ROW2: cream-and-burgundy enclosed food delivery van with a short cabin and low rounded rectangular cargo box, small wooden bread and fish emblems on the side only, no text. ROW3: pale blue dairy delivery pickup carrying silver milk churns and a small cream egg crate, no labels. ROW4: dark forest-green tools truck with tidy closed copper-brown tool chests and wooden crates in its open bed, tiny hammer emblem on side panel. ALL trucks use the SAME wheelbase, cabin scale and visible tire contact points as supplied image, no oversized vans, cab always at front, load at rear. Each row is ONE coherent vehicle rotated through all 8 yaw views. Columns left-to-right: front toward screen lower-right SE, straight front toward viewer/down S, front lower-left SW, left side with nose left W, rear three-quarter nose upper-left NW, straight rear nose up N, rear three-quarter nose upper-right NE, right side nose right E. Preserve that exact ordering and do not mirror only fronts for backs. Orthographic dimetric 2:1 camera, vertical upright cabs and +/-0.5 screen ground axes, no perspective. Equal grid cells, fixed scale, center each sprite and leave transparent margins at least 8 pixels at every cell edge; all wheels fully inside cells. Detailed cozy pixel-art texture, amber headlights and warm copper details. No ground plane, no cast shadows, no text, no gridlines, no captions, no painted checkerboard; actual transparent background. EXACTLY 32 sprites.
