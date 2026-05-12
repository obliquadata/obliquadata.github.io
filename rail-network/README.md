# Rail network project page

This package contains the updated rail-network page with two interactive maps:

1. Method 1: fixed-hub hub-and-spoke with sparse gap fill.
2. Method 2: hierarchical backbone–feeder construction.

The Method 2 map reads these files:

- `data/network_edges_v3_simplified.geojson`
- `data/network_junctions_v3_sample.geojson`
- `data/fixed_hubs_v3.geojson`
- `data/metadata_v3.json`
- `data/flight_corridors_v3_enriched.json`

If you regenerate the Version 3 network, replace those files and keep the filenames the same.
