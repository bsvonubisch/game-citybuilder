# Fishing boat motion

The existing four-view `fishing-boats.png` remains unchanged. Buoyancy uses
sub-pixel vertical movement and a small ground-plane drift; the hull is never
screen-rotated, stretched or repeatedly resized by the animation. The wake uses
the unshifted navigation position, so bobbing cannot create false foam trails.

Fishing gear uses one cast, soak, haul and stow per actual production cycle:
0–18%, 18–67%, 67–94%, then 94–100%. Pausing production holds net progress.
Upgrades interpolate the same progress at the building's production rate.
Moored and travelling boats hide the gear. Small fish, drips and surface floats
appear at the corresponding hauling/soaking stages.

The rope attaches to measured hand contacts in the trimmed boat frames:
SE (0.54,0.43), SW (0.46,0.43), NW (0.51,0.44), NE (0.49,0.44).
Net geometry uses the game's 2:1 ground projection; its side is chosen from
adjacent open water and stays consistent through camera turns. Near-side gear
draws in front of the hull, far-side gear behind it. Surface rings and floats
draw under land, piers and bridge decks. Recheck the contacts if boat art changes.

Checked in the running game: all four views, cast/soak/haul/stow, gentle hull
movement, travel cleanup, pause, removal and mobile layout. The production
build and all 12 fishing/wake checks pass. No generated image assets or
per-frame texture uploads are used.
