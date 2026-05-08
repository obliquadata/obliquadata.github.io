# Obliqua Data rail project page

Upload these files to the root of the Obliqua Data GitHub Pages repository.

## What changed in this version

- The shared header and footer now live in `partials/site-header.html` and `partials/site-footer.html`.
- Pages load those shared components through `assets/site-components.js`.
- The rail page keeps its page-specific links in a small secondary navigation bar below the shared header.
- The map CSS now includes Leaflet fallback styles, so the map should render correctly even if the external Leaflet CSS is blocked or slow to load.
- The rail map script now calls `map.invalidateSize()` after load and after data has been added, which helps Leaflet calculate the correct map dimensions.

## File structure

- `index.html` — updated homepage with a rail project card and shared header/footer placeholders.
- `styles.css` — updated homepage/shared styling.
- `assets/site-components.js` — injects the shared header and footer.
- `partials/site-header.html` — single source for the site header.
- `partials/site-footer.html` — single source for the site footer.
- `rail-network/index.html` — project page.
- `rail-network/rail-network.css` — page and map styling.
- `rail-network/rail-network.js` — interactive map logic.
- `rail-network/data/` — web-ready project data.

## Note for local preview

Because the shared header/footer are loaded with `fetch()`, previewing by double-clicking `index.html` may not work in all browsers. Use a local server instead, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.
