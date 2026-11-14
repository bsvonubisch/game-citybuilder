# Art direction and provenance

Selected: **Pine & Copper** architecture and **Garden Streets (C)** environment treatment.

Terrain update selected: **Alpine Slate (C)** roads, meadow grass and deposits; **Clear Brook (A)** water and shoreline palette.

All raster artwork in `public/` was generated with the built-in image generation tool for this project. The runtime frames the atlases directly; it does not use the mockup images as a fake playable world. Roads, terrain, and overlays are rendered procedurally. Assets are provisional game art and can be replaced independently of simulation data.

| Asset | Purpose |
|---|---|
| `buildings.png` | 3×3 atlas: cottage, farm, mill, bakery, forester, sawmill, workshop, warehouse, fountain |
| `garden-sprites.png` | 4×4 atlas: oak, spruce, birch, flowering tree; four villagers; two cars and two trucks; planter, bench/lantern, rocks, fence |
| `style-directions.png` | Original three style concepts; Pine & Copper selected |
| `street-directions.png` | Woodland Lanes, Alpine Cobble, Garden Streets; Garden Streets selected |
| `house-rotations.png` | 2×2 atlas of the approved cottage viewed from four world rotations |
| `vehicles-directions.png` | Four vehicle types × four directional views, including rear views |
| `people-directions.png` | Four residents × four directional views, including walking away |
| `terrain-options.png` | Garden Cobble, Woodland Lane, and selected Alpine Slate concepts |
| `water-options.png` | Selected Clear Brook, Emerald River, and Silver-Blue Lake concepts |
| `alpine-surfaces.png` | Four grass and four slate pavement top-down texture cells |
| `alpine-deposits.png` | Four stone and four copper-bearing metal deposit cutouts |
| `clear-brook-water.png` | Turquoise water texture distributed across an 8×8-tile repeat |
| `pedestrian-walk.png` | Two costumes × four directions × four walking poses; runtime corrects one reversed view and excludes one mismatched bag pose |
| `windmill-parts.png` | Separate stationary mill and front-facing rotor; 96 projected rotor views are cached at startup |

The quarry and mine currently reuse tinted industrial/lodge artwork and have explicit mining behavior and deposits. Unique mining buildings are still to be commissioned; their resource deposits now have dedicated artwork. The active pedestrian atlas has looping walk poses in four directions, with a stationary passing pose while waiting. The older four-costume directional atlas remains as a source reference.

## Ground alignment

`src/building-art.ts` records ground-contact landmarks in original atlas-cell pixels for every building frame and each cottage rotation. Include the feet of steps, log piles, barrels, conveyor legs, and other props; exclude roofs and elevated foliage. Source cells are 418×418 for the original buildings, 627×627 for cottages, and 887×887 for the separate windmill. A narrow piece of the neighboring warehouse is excluded from the workshop runtime frame.

Terrain source textures are projected to exact 2:1 diamond tiles and baked into a single map texture after edits. Water glints, fountain droplets, chimney puffs, saw motion, conveyor cargo, and wheel spokes are small runtime overlays. Machinery requires an enabled, staffed, road-connected factory with inputs and output capacity; pauses freeze its phase. Windmill rotation uses a cached atlas rather than rerasterizing the sails each frame. Pedestrian gait follows traveled distance, and all animation timing uses simulation speed.

`fitGround` converts the contacts to both isometric tile axes, fits their extents uniformly inside the logical footprint with a 0.08-tile curb clearance, and centers the result. Alpha trimming only affects the texture crop; it never decides the plot anchor or scale. Placement previews and finished buildings use the same transform. Rectangular industrial plots retain their existing dimensions and save compatibility. Elevated roofs and canopies may visually occlude ground behind them; their bases and ground-level props stay in the plot.

For a visual regression review, run the dev server and open `/tests/footprints.html`. It shows every building and cottage rotation surrounded by roads, with contact guides and a comparison to the former placement. This audit page is excluded from the production build. Whenever replacing artwork, recalibrate its contact landmarks and inspect this page in addition to running the containment tests.

## Prompt briefs

The original style comparison requested three equal panels of the same cozy isometric city, with visible cars, inhabitants, factories and supply chains: sunny Honeyfield, forest Pine & Copper, pastel Sugar Canal. Crisp detailed SNES-era pixel art, 2:1 camera.

The building atlas requested nine isolated alpha sprites in a 3×3 grid with consistent timber construction, dark green shingle roofs, amber windows, copper equipment, upper-left light and 2:1 isometric perspective.

The environment comparison kept the approved cottage architecture constant and requested detailed trees, villagers, vehicles and seamless roads in three treatments. Garden Streets specifies lush oak/pine foliage, warm gray paving, gravel sidewalks, flower planters, dimensional villagers and vintage compact cars.

The final garden atlas used the approved building atlas and street comparison as references. It requested sixteen isolated alpha sprites in a regular 4×4 grid: mature oak, textured spruce, birch, flowering tree; four clothed villagers in different directions; forest-green and ochre compact cars, red plank pickup, cream/green delivery truck; planter, bench/copper lantern, mossy rocks, timber gate. All assets use crisp shaded pixel texture, upper-left warm light, and the approved house palette.

The directional atlases used the approved assets as references. Each vehicle/person row contains the same subject facing southeast, southwest, northwest, and northeast, with genuine front and rear views. The cottage atlas requests four 90-degree world rotations of the same architecture, retaining chimney, timber, windows, and roof style. All three sheets use real transparency, isolated grid cells, consistent pixel shading, and a fixed isometric camera.
