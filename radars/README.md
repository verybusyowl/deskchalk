# Radar background images for Map Lab

Drop 1024×1024 PNG files here named after each map. They'll show as the background
behind the kill/death/grenade points on the Map Lab dashboard.

```
de_inferno.png
de_mirage.png
de_dust2.png
de_nuke.png
de_ancient.png
de_anubis.png
de_vertigo.png
```

If a file isn't present, `cs2-renderer` falls back to a dark grid with the map
name and a hint — Map Lab still works, just without the radar overlay.

## Where to get radars

- **SimpleRadar** (CC-licensed community remake) — https://readtldr.gg/simpleradar
  Best for legibility. Download the pack, rename to `de_*.png`.
- **Valve's official radars** — extracted from your CS2 install at
  `game/csgo/resource/overviews/{map}.png`. Standard CS2 dimensions.
- **boltobserv overviews** — https://github.com/boltobserv/boltobserv —
  community-maintained, CC-licensed.

The renderer expects 1024×1024 — anything else is resized on the fly, but
pre-resizing client-side gives sharper results.

## Coordinate alignment

The world→pixel transform uses `map_radar_calibration` in Postgres. If points
fall off-canvas after dropping a radar, verify your radar's origin/scale matches
the values in that table. Authoritative source: `game/csgo/resource/overviews/{map}.txt`.
