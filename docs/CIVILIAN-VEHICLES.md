# Civilian vehicle variety

Six deterministic appearances: existing green/gold compacts plus lavender
fastback, blue family saloon, cream roadster and teal wood-paneled estate.
The user rejected the first burgundy coupe; it is not shipped.

Accepted asset: `public/civilian-cars-v1.png`, generated with the built-in image
tool. Four rows, eight headings per row: SE, S, SW, W, NW, N, NE, E. Row order is
fastback, saloon, roadster, estate. Production alpha trimming measures each cell;
one common scale is 25 world pixels divided by the mean diagonal width of the
saloon. Upright images use no screen rotation, skew, or per-frame resizing.
Origin is (0.5, 0.8), matching existing vehicle ground contacts. Collision bodies
and speeds retain their existing dimensions.

The narrow S-facing cells exclude their outer 15% gutters before alpha trimming,
to prevent stray pixels from neighboring cars appearing beside the front view.

`src/civilian-vehicles.ts` hashes resident identity before selecting a model.
This avoids regularly spaced motorist IDs showing only two colors. Return trips,
vehicle recovery and reloaded saves keep the same model without new save fields.

References: the existing eight-direction civilian atlases for physical scale and
camera; `delivery-town-v1.png` for the shared atlas layout and pixel texture.
The accepted source and all 48 civilian model/heading combinations were reviewed
at common scale. Browser checks cover matching frames in all four town views,
resident identity, mobile layout and no page errors. The production build and
all 230 game checks pass.

## Initial generation prompt

Use case: stylized-concept. Asset type: civilian car sprite atlas for cozy Little Works city builder. NEW genuinely transparent RGBA image, wide 2:1 aspect, exactly 8 equal columns by 4 equal rows, 32 individual vehicle views, no labels. Match the compact vintage 1930s cozy pixel-art vehicles in the reference, the same amber headlights, small brass details, detailed crisp pixel texture and upright camera. Four distinct civilian models: ROW1 burgundy two-door rounded coupe with a short roof and two compact windows. ROW2 powder-blue four-door family saloon with cream roof. ROW3 ivory open-top little roadster, tan folded roof behind seats, tiny seated driver mostly hidden by windscreen (not standing), no visible people outside. ROW4 dark teal compact wood-paneled station wagon, warm wooden side panels, short rear cargo area with windows. All are small village passenger cars, not trucks, no sporty modern design, no elongated luxury vehicles. Keep wheelbase and cabin height within 10% across all models and similar to reference green/gold passenger cars; consistent wheel radius across all 32 views. Eight columns left to right in EVERY row: front points screen lower right SE; straight front screen down S; front lower left SW; left side nose left W; rear three-quarter nose upper left NW; straight rear nose up N; rear three-quarter nose upper right NE; right side nose right E. Preserve the same coherent body, roof, door count, windows and panels around each model. Orthographic dimetric 2:1 projection with diagonal ground axes screen slopes +/-0.5, vertical cabin pillars, no perspective convergence. One fixed scale in all cells, front/back views naturally narrower. Center each vehicle in its equal cell with 10px minimum transparent padding and all wheels entirely visible. No ground, no cast shadow, no smoke, no scenery, no labels, no gridlines, no text, no logo. Transparent background, no painted checkerboard. All 32 sprites must be fully inside their cells.

## Accepted revision prompt

Use case: precise-object-edit. Edit this exact transparent sprite atlas. Change ONLY the first/top row of 8 burgundy round cars into a visibly different model: a compact lavender-and-silver vintage 1930s streamlined FASTBACK coupe with a lower swept roof, longer tapered bonnet, sloping rear, slim horizontal art-deco grille, silver bumpers and cream wheel hubs. It must look like a distinct elegant low fastback model, not merely a recolored version of the old tall round car. Keep a compact wheelbase and total footprint comparable to the other cars, width/length no more than 10% different, front/rear views narrower naturally. Render exactly the same eight headings for the new model, left to right: SE(front lower right), S(front down), SW(front lower left), W(nose left), NW(rear with nose upper left), N(straight rear), NE(rear with nose upper right), E(nose right). Maintain coherent fastback body, roof, windows, headlights and hood around all eight views. Preserve the other three rows EXACTLY as supplied: powder blue cream-roof saloon, ivory open-top roadster with driver, and teal wooden station wagon. Preserve equal 8-column by 4-row atlas layout, canvas proportions, all padding, warm cozy pixel-art style, true transparent alpha, same fixed orthographic 2:1 dimetric camera, +/-0.5 diagonal ground-plane slopes, same lighting and common physical scale. No ground plane, no shadows, no text, no gridlines, no labels, no cropping.
