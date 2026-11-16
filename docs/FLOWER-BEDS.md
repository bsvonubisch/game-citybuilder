# Connected flower beds

The timber borders use the same four-world-pixel height as building foundations.
Their lower edge follows the exact 1×1 footprint; thin top caps stay inside it.
Near faces show the outside board, while far edges show only the shallow inside
lip. This avoids painting a full-height back board across the flowers. Lighter
timber shading preserves the existing painted grain. Borders disappear beside
same-height beds and building foundations, with no divider or inset gap.

Flowers are sampled from a continuous field in map coordinates. Each tile draws
the neighbouring blossoms that cross its boundary in the same depth order.
Species, position and size vary independently; the texture no longer restarts
as diagonal stripes in every tile. The physical flower layout remains stable
through camera turns. A two-tile repeat bounds the number of cached phases;
composition happens only when a new texture variant is needed, not per frame.

The placed bed, placement preview and menu thumbnail share `drawPlanter`.
Existing `planter-plants.png` and `bridge-wood.png` remain the source materials;
no upright sprite was warped or regenerated.

Checked in the game: single beds, rectangular and L-shaped groups, a bed around
a house foundation, adjoining roads, all four camera views, night lighting,
placement preview and a narrow mobile viewport. Six sprite/planter regression
tests pass, including shared texture sampling/order, rotation stability, matching
foundation height and joins at different terrain levels. Production build passes.
