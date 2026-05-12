# Rail network website package - Method 3 corridor-aware update

This package replaces the previous Version 4 third map with Method 3.

Method 3 keeps the manually guided hub-backbone corridors, but treats the intermediate waypoint cities along those corridors as corridor access anchors. These anchors are not fixed hubs, but they allow nearby terminals to feed into the nearest trunk corridor before moving through the wider network.

Key data files for the third map:

- `data/network_edges_method3_optimized.geojson`
- `data/metadata_method3.json`
- `data/fixed_hubs_method3.geojson`
- `data/corridor_access_anchors_method3.geojson`
- `data/network_junctions_method3_sample.geojson`
- `data/flight_corridors_method3_enriched.json`

The Method 3 web edge file is optimized for Leaflet display by safely merging and simplifying road-derived linework while preserving edge-type styling. Corridor access anchors are available as an optional map layer and are off by default to avoid visual clutter.
