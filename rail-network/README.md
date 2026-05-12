# Rail Network comparison page

This package contains the Obliqua Data rail-network comparison page.

Method 2 has been updated from the latest Phoenix-hub export. The page loads `data/network_edges_v3_simplified.geojson` for the second map. The update adds Phoenix as a fixed Southwest hub and treats Denver–Phoenix via Albuquerque as a hub-backbone refinement rather than as a post-hoc forced flight-corridor link.

Preview with a local server:

```bash
python -m http.server 8000
```

Then open the page in your browser.
