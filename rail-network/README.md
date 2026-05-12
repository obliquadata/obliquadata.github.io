# Rail network website package - balanced map data

This version replaces the overly-dissolved map layers with per-feature simplified GeoJSON.

Map 1 simplification: tolerance 10,000 m; minimum line length 2,500 m; web features 6,211; file size 1.49 MB.

Map 2 simplification: tolerance 10,000 m; minimum line length 2,500 m; web features 7,562; file size 2.21 MB.

Unlike the previous ultra-light export, this version does not dissolve by edge type, so the routes should not visually break into overly coarse pieces. Leaflet Canvas rendering remains enabled, and heavier layers are still off by default.
