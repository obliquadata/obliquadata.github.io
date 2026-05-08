const DATA_PATH = "data/";

const railStyleDefault = { color: "#123f1a", weight: 3.1, opacity: 0.82, pane: "railPane" };
const backboneStyleDefault = { color: "#123f1a", weight: 4.2, opacity: 0.9, pane: "railBackbonePane" };

const railStylesByType = {
  hub_backbone: { color: "#123f1a", weight: 4.2, opacity: 0.95, pane: "railBackbonePane" },
  spoke: { color: "#5b9440", weight: 2.4, opacity: 0.72, pane: "railPane" },
  augment: { color: "#c99534", weight: 3.2, opacity: 0.9, pane: "railPane" }
};

const styles = {
  ...railStylesByType,
  junction: { radius: 2.5, color: "#47634d", fillColor: "#47634d", fillOpacity: 0.55, opacity: 0.65, weight: 1 },
  Good: { color: "#246b45", weight: 3.5, opacity: 0.78, dashArray: "8 8", pane: "corridorPane" },
  Okay: { color: "#b57422", weight: 3.5, opacity: 0.78, dashArray: "8 8", pane: "corridorPane" },
  Poor: { color: "#9d3f36", weight: 4, opacity: 0.86, dashArray: "8 8", pane: "corridorPane" }
};

let colorRailByType = true;

const map = L.map("railMap", {
  scrollWheelZoom: false,
  worldCopyJump: true
}).setView([39.5, -98.35], 4);

// Put rail and corridor vectors in explicit panes above the basemap.
// This prevents basemap tiles from covering the network in browsers or previews
// where Leaflet's external CSS loads late or is partially overridden.
map.createPane("railPane");
map.getPane("railPane").style.zIndex = 430;
map.createPane("corridorPane");
map.getPane("corridorPane").style.zIndex = 460;
map.createPane("railBackbonePane");
map.getPane("railBackbonePane").style.zIndex = 500;
map.createPane("junctionPane");
map.getPane("junctionPane").style.zIndex = 620;
map.createPane("hubPane");
map.getPane("hubPane").style.zIndex = 650;

function refreshMapSize() {
  requestAnimationFrame(() => map.invalidateSize({ animate: false }));
}

window.addEventListener("load", () => {
  refreshMapSize();
  setTimeout(refreshMapSize, 250);
});

const positron = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19
});

const voyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19
}).addTo(map);

const backboneLayer = L.geoJSON(null, { style: backboneStyleDefault, interactive: false });
const spokeLayer = L.geoJSON(null, { style: railStyleDefault, interactive: false });
const augmentLayer = L.geoJSON(null, { style: railStyleDefault, interactive: false });
const hubLayer = L.geoJSON(null, {
  pane: "hubPane",
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    pane: "hubPane",
    radius: 8,
    color: "#123f1a",
    weight: 2.4,
    fillColor: "#f5f1e4",
    fillOpacity: 0.98,
    opacity: 1
  }),
  onEachFeature: (feature, layer) => {
    layer.bindPopup(`<strong class="map-popup-title">${feature.properties.name}</strong>Fixed hub in the prototype network.`);
  }
});
const junctionLayer = L.geoJSON(null, {
  pane: "junctionPane",
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    ...styles.junction,
    pane: "junctionPane"
  }),
  onEachFeature: (feature, layer) => {
    layer.bindPopup(`<strong class="map-popup-title">Sampled junction</strong>Degree: ${feature.properties.degree}`);
  }
});
const flightLayer = L.layerGroup();

const baseMaps = {
  "Light basemap": positron,
  "Voyager basemap": voyager
};

const overlays = {
  "Hub backbone": backboneLayer,
  "Spokes": spokeLayer,
  "Augmenting links": augmentLayer,
  "Fixed hubs": hubLayer,
  "Sampled junctions": junctionLayer,
  "Evaluated air corridors": flightLayer
};

L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

const railColorControl = L.control({ position: "topright" });
railColorControl.onAdd = () => {
  const container = L.DomUtil.create("div", "leaflet-control-layers rail-color-toggle");
  container.innerHTML = `
    <label>
      <input type="checkbox" id="railColorToggle" checked />
      <span>Color rail by edge type</span>
    </label>
  `;
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);
  return container;
};
railColorControl.addTo(map);

function applyRailColorMode(enabled) {
  colorRailByType = enabled;
  const legend = document.querySelector(".map-legend");
  legend?.classList.toggle("rail-colors-enabled", enabled);

  backboneLayer.setStyle(enabled ? railStylesByType.hub_backbone : backboneStyleDefault);
  spokeLayer.setStyle(enabled ? railStylesByType.spoke : railStyleDefault);
  augmentLayer.setStyle(enabled ? railStylesByType.augment : railStyleDefault);
}

const railColorToggle = document.getElementById("railColorToggle");
railColorToggle?.addEventListener("change", (event) => {
  applyRailColorMode(event.target.checked);
});
applyRailColorMode(true);
function bringGroupToFront(layer) {
  if (!map.hasLayer(layer)) return;
  if (typeof layer.bringToFront === "function") {
    layer.bringToFront();
  }
  if (typeof layer.eachLayer === "function") {
    layer.eachLayer((childLayer) => childLayer.bringToFront?.());
  }
}

function enforceOverlayOrder() {
  // Draw lower-priority lines first, then put the backbone above the rest
  // of the rail network, sampled junctions above the backbone, and fixed
  // hubs above every other project layer. The point layers also specify
  // their panes inside pointToLayer; without that, Leaflet can leave the
  // actual circle markers in the default overlay pane.
  [spokeLayer, augmentLayer, flightLayer, backboneLayer, junctionLayer, hubLayer].forEach(bringGroupToFront);
}

map.on("baselayerchange overlayadd overlayremove zoomend moveend", enforceOverlayOrder);

backboneLayer.addTo(map);
spokeLayer.addTo(map);
augmentLayer.addTo(map);
hubLayer.addTo(map);
junctionLayer.addTo(map);

function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function arcPoints(a, b, bend = 0.18, steps = 48) {
  const lat1 = a.lat, lon1 = a.lon;
  const lat2 = b.lat, lon2 = b.lon;
  const midLat = (lat1 + lat2) / 2;
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const curve = Math.min(8, dist * bend);
  const ctrlLon = (lon1 + lon2) / 2 + nx * curve;
  const ctrlLat = midLat + ny * curve;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * ctrlLon + t * t * lon2;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    points.push([lat, lon]);
  }
  return points;
}

function addFlightCorridors(corridors) {
  flightLayer.clearLayers();
  corridors.forEach((d, index) => {
    const a = { lat: d.a_lat, lon: d.a_lon };
    const b = { lat: d.b_lat, lon: d.b_lon };
    const line = L.polyline(arcPoints(a, b, index % 2 === 0 ? 0.16 : -0.16), styles[d.class] || styles.Good);
    line.bindPopup(`
      <strong class="map-popup-title">${d.airport_a}–${d.airport_b}</strong>
      <div>${d.airport_a_name} ↔ ${d.airport_b_name}</div>
      <div><strong>${formatNumber(d.flights_per_day)}</strong> flights/day</div>
      <div>Rail distance: <strong>${formatNumber(d.rail_km, 0)} km</strong></div>
      <div>Detour ratio: <strong>${formatNumber(d.detour_ratio, 2)}</strong></div>
      <div>Class: <strong>${d.class}</strong></div>
    `);
    line.addTo(flightLayer);
  });
}

function renderCorridorTable(corridors, selected = "All") {
  const rows = document.getElementById("corridorRows");
  const filtered = selected === "All" ? corridors : corridors.filter((d) => d.class === selected);
  rows.innerHTML = filtered.map((d) => `
    <tr>
      <td><strong>${d.airport_a}–${d.airport_b}</strong><br><span>${d.airport_a_name} ↔ ${d.airport_b_name}</span></td>
      <td>${formatNumber(d.flights_per_day)}</td>
      <td>${formatNumber(d.detour_ratio, 2)}</td>
      <td><span class="badge ${d.class.toLowerCase()}">${d.class}</span></td>
    </tr>
  `).join("");
}

function splitEdgesByType(edges) {
  const collections = { hub_backbone: [], spoke: [], augment: [] };
  edges.features.forEach((feature) => {
    const type = feature.properties.edge_type;
    if (collections[type]) collections[type].push(feature);
  });
  backboneLayer.addData({ type: "FeatureCollection", features: collections.hub_backbone });
  spokeLayer.addData({ type: "FeatureCollection", features: collections.spoke });
  augmentLayer.addData({ type: "FeatureCollection", features: collections.augment });
}

async function init() {
  const [metadata, edges, hubs, junctions, corridors] = await Promise.all([
    fetch(`${DATA_PATH}metadata.json`).then((r) => r.json()),
    fetch(`${DATA_PATH}network_edges_simplified.geojson`).then((r) => r.json()),
    fetch(`${DATA_PATH}fixed_hubs.geojson`).then((r) => r.json()),
    fetch(`${DATA_PATH}network_junctions_sample.geojson`).then((r) => r.json()),
    fetch(`${DATA_PATH}flight_corridors_enriched.json`).then((r) => r.json())
  ]);

  document.getElementById("metric-nodes").textContent = formatNumber(metadata.graph_nodes);
  document.getElementById("metric-edges").textContent = formatNumber(metadata.graph_edges);
  document.getElementById("metric-hubs").textContent = formatNumber(metadata.hub_names.length);
  document.getElementById("metric-corridors").textContent = formatNumber(corridors.length);

  splitEdgesByType(edges);
  applyRailColorMode(colorRailByType);
  hubLayer.addData(hubs);
  junctionLayer.addData(junctions);
  addFlightCorridors(corridors);
  enforceOverlayOrder();
  renderCorridorTable(corridors);

  const filter = document.getElementById("corridorFilter");
  filter.addEventListener("change", () => renderCorridorTable(corridors, filter.value));

  const bounds = backboneLayer.getBounds();
  if (bounds.isValid()) {
    refreshMapSize();
    map.fitBounds(bounds.pad(0.12));
    setTimeout(() => {
      refreshMapSize();
      map.fitBounds(bounds.pad(0.12));
    }, 250);
  }
}

init().catch((error) => {
  console.error("Unable to load rail project data", error);
  const mapElement = document.getElementById("railMap");
  mapElement.innerHTML = '<div style="padding: 24px; font-family: Inter, system-ui; color: #17361d;">Unable to load the interactive map data. Please check that the data folder was uploaded with the page.</div>';
});
