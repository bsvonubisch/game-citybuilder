# Road calculations and frame pacing

The played town (74 buildings, 273 road tiles, 128 residents) repeated about
62,000 breadth-first road searches in 16 seconds. Most came from sorting
residents' available leisure destinations and calculating service coverage for
the UI. These searches did not depend on changing traffic positions.

`RoadPathCache` reuses exact paths, including unreachable pairs. Walking and
vehicle routes remain separate, so cars cannot use pedestrian-only paths.
Every returned path owns its array and points. The cache clears on reconnect or
world revision and is capped at 1,024 entries and 20,000 points; it is not saved.

`RoadHeightCache` resolves each tile's land corners or bridge landings once per
geometry revision. It retains the existing interpolation, including the minimum
of multiple bridge ramps. Scene and roadwork surfaces have separate caches.
Terrain edits, road changes, save replacement and view rotation invalidate them.
No textures, draw quality, simulation rates or animation timing were changed.

## Observed desktop comparison

Isolated Edge, same captured save, 1440×950, zoom 1.3, normal speed, 16-second
CPU profiles after warm-up. These are measurements on the development machine,
not a guarantee for other devices.

| Measurement | Before | After |
| --- | ---: | ---: |
| Displayed FPS | 56 | 60 |
| 95th-percentile animation-frame interval | 33.3 ms | 16.8 ms |
| Total route-search time | 2,049.6 ms | 53.5 ms |
| Average simulation step | 28.0 ms | 7.7 ms |

All 242 game tests pass. Additional cache tests check invalidation, memory limits,
ownership of returned paths, exact road heights in all four views and identical
simulation outcomes with caching disabled. Mobile browser checks use the played
save at 390×844, DPR 3, four-times speed, panning, zooming and all four view turns.

The starter-layout update also keeps the former planned town as an explicit
traffic regression fixture, preserving its original workload and thresholds.
The larger captured town recorded 40 automatic vehicle recoveries in the
20-minute simulation audit, above that smaller fixture's threshold of 30;
traffic behavior was not changed by this optimization.
