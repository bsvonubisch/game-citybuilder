# Construction artwork

Generated with the built-in image generation tool. Production assets:

- `public/construction-props.png`: transparent 2 × 2 atlas (two scaffold directions, timber/tools, stone/mortar/wheelbarrow).
- `public/construction-workers.png`: transparent 4 × 4 atlas, four-frame hammering and digging cycles in two directions. Each row uses a constant scale and foot anchor. The source pedestrians are used only while travelling; builders use dedicated work poses after arriving.

The dirt base is drawn in the renderer at four source pixels per world pixel. It uses the actual plot outline. Props retain their aspect ratios and repeat along the footprint edges rather than stretching one square sprite over a rectangular site. Workers stand within the site; the front scaffold is drawn over their feet where appropriate.

## Prompts

Props (reference: `public/plot-house.png`, style only):

> Create a NEW transparent game sprite atlas for construction-site props, using the attached house atlas ONLY as a style reference (warm timber, detailed cozy pixel art, crisp tiny pixels, same lighting). One atlas, exactly 2 columns by 2 rows, four equal square cells, each independent prop centered with generous transparent padding. Top left: one freestanding narrow timber scaffold bay with two upright posts and diagonal brace, plank working platform, facing along screen-down-right 2:1 isometric axis. Top right: matching scaffold bay along screen-down-left axis. Bottom left: tidy pile of long warm wooden planks with a small tool chest and hammer, isometric. Bottom right: small stack of grey stone blocks, bucket of mortar and wooden wheelbarrow, isometric. Actual alpha transparent background, no text, no grass, no ground tile, no surrounding building, no people, no frame/borders, no contact shadow spreading beyond object. Vertical posts perfectly upright; all ground axes exactly 2:1 isometric. High-resolution crisp detailed pixel art sprites matching reference, not vector, not blurry. These will be tiled on different rectangular construction footprints; scaffolds must be open and modular.

Workers (reference: `public/pedestrian-walk.png`, style only):

> Create a NEW production-quality construction worker animation sprite sheet for this cozy isometric pixel-art city builder, matching the attached pedestrians' detailed crisp pixel style, warm lighting and proportions. Exactly FOUR COLUMNS by FOUR ROWS (16 separate frames), equal square cells, transparent alpha background. Each ROW is one four-frame loop, not a different angle per column. Row 1: male carpenter in straw hat, green shirt, leather apron, brown boots, facing diagonally down-right, kneeling beside a LOW small timber sawhorse, holding a real hammer: frame1 tool low ready, frame2 arm and hammer raised, frame3 hammer striking timber with torso leaning, frame4 recovery. Row 2: same carpenter and action facing diagonally down-left. Row 3: female builder in straw hat, cream rolled sleeves, blue work trousers and boots, NO basket or handbag, facing down-right, using a long-handled shovel: ready, pressing shovel into dirt, lifting a small scoop, dropping scoop. Row 4: same female builder/action facing down-left. Ground/feet anchor EXACTLY same central x and y in every cell, fixed camera and fixed scale throughout, no sliding feet, no walking. Genuine coherent body/arm/tool animation across each row; consistent faces, clothes, tool, body size. Keep hammer and shovel clearly attached to hands in all frames. Plenty of transparent margin above raised tools. NO ground tile, NO building or background, NO text, NO gridlines. Subtle natural physical work motions, grounded feet, no exaggerated dancing. Every sprite fully inside its own cell. Detailed pixel art, avoid smooth vector rendering.

Final transparent-background edit of the worker atlas:

> Edit ONLY the background of this 4-column by 4-row construction worker animation atlas. Keep every worker, tool, sawhorse, pose and its exact pixel position and scale unchanged. Remove ALL gray/beige backdrop, paper grain, haze, glows and cast shadows to completely clear alpha transparency (alpha=0) between and around all 16 sprites. Preserve clean opaque silhouettes, with transparent gaps between arms, shovel, legs and workbench. Absolutely NO replacement background, no ground, no checkerboard drawn into image. Production game sprite cutout sheet with genuinely empty RGBA pixels around every object. Do not add or remove frames. Keep exact original canvas dimensions and cell layout.

## Textured earth revision

`public/construction-earth.png` was generated with the built-in image tool from the construction screenshot as a style reference, using this prompt: seamless, edge-to-edge, directly-overhead warm compacted sandy-brown soil; subtle clumps, embedded small tan/gray pebbles, fine grit, softly blended natural patches and a few shallow irregular boot impressions. Match the detailed cozy pixel art of the houses, trees and paving. Muted umber, ochre and sandy tan, gentle top-left light. No plank shapes, stripes, rows, grid, trenches, large stones, grass, buildings, UI, labels or isometric outline. Keep a constant texture scale when the ground plane is projected into different footprints.

Source: `exec-cdbff0e4-d544-4429-92d1-849e0694132c.png`. The renderer uses one repeat per two ground tiles in each axis, clipped exactly to the construction footprint, cached at 4× resolution. Scaffolding, materials and workers retain their original proportions.
