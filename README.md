# Obliqua Data rail-network project page

This package contains an updated Obliqua Data homepage and a new project page at `rail-network/`.

## What changed in v3

- The header and footer are inline again on each page. This avoids the client-side partial-loading approach and keeps the homepage self-contained.
- All site styling now comes from the single shared `styles.css` file. The rail project no longer has a separate page-specific CSS file.
- The map has been fixed so the rail network vectors use explicit Leaflet panes above the basemap tiles.
- The rail lines have been made slightly stronger to improve visibility on light basemaps.

## Upload

Upload the full contents of this folder to the GitHub Pages repository root. Keep the `rail-network/data/` folder in place.

## Preview locally

Use a local server rather than opening the HTML files directly:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.


## Shared footer setup

The header remains inline in each page so the main navigation is always available even if a shared component fails to load.

The footer is shared from `site-footer.html` and loaded by `assets/site-footer.js`. To update the footer across the site, edit `site-footer.html` once.

Do not preview by double-clicking the HTML files, because browser file security can block `fetch()`. Use a local server instead:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.
