# Art direction and provenance

Selected: **Pine & Copper** architecture and **Garden Streets (C)** environment treatment.

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

The quarry and mine currently reuse tinted industrial/lodge artwork and have explicit mining behavior and deposits. Unique mining artwork is still to be commissioned. Each villager has four directions, but these are not complete walk-animation cycles. The renderer trims alpha padding per cell and anchors each building at its visible ground-contact point.

## Prompt briefs

The original style comparison requested three equal panels of the same cozy isometric city, with visible cars, inhabitants, factories and supply chains: sunny Honeyfield, forest Pine & Copper, pastel Sugar Canal. Crisp detailed SNES-era pixel art, 2:1 camera.

The building atlas requested nine isolated alpha sprites in a 3×3 grid with consistent timber construction, dark green shingle roofs, amber windows, copper equipment, upper-left light and 2:1 isometric perspective.

The environment comparison kept the approved cottage architecture constant and requested detailed trees, villagers, vehicles and seamless roads in three treatments. Garden Streets specifies lush oak/pine foliage, warm gray paving, gravel sidewalks, flower planters, dimensional villagers and vintage compact cars.

The final garden atlas used the approved building atlas and street comparison as references. It requested sixteen isolated alpha sprites in a regular 4×4 grid: mature oak, textured spruce, birch, flowering tree; four clothed villagers in different directions; forest-green and ochre compact cars, red plank pickup, cream/green delivery truck; planter, bench/copper lantern, mossy rocks, timber gate. All assets use crisp shaded pixel texture, upper-left warm light, and the approved house palette.

The directional atlases used the approved assets as references. Each vehicle/person row contains the same subject facing southeast, southwest, northwest, and northeast, with genuine front and rear views. The cottage atlas requests four 90-degree world rotations of the same architecture, retaining chimney, timber, windows, and roof style. All three sheets use real transparency, isolated grid cells, consistent pixel shading, and a fixed isometric camera.
