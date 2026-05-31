const DATA_PATH = "data/";

const BASELINE_CONFIG = {
  mapId: "railMapBaseline",
  legendId: "legendBaseline",
  metadata: "metadata_method1.json",
  edges: "network_edges_method1_simplified.geojson",
  hubs: "fixed_hubs.geojson",
  junctions: "network_junctions_sample.geojson",
  corridors: "flight_corridors_enriched.json",
  metricPrefix: "baseline",
  title: "Method 1",
  defaultEdgeTypes: ["hub_backbone", "spoke", "spoke_fallback", "augment"],
  showJunctionsByDefault: false,
  showCorridorsByDefault: false
};

const V3_CONFIG = {
  mapId: "railMapV3",
  legendId: "legendV3",
  metadata: "metadata_method2.json",
  edges: "network_edges_method2_simplified.geojson",
  hubs: "fixed_hubs_v3.geojson",
  junctions: "network_junctions_v3_sample.geojson",
  corridors: "flight_corridors_v3_enriched.json",
  metricPrefix: "v3",
  title: "Method 2",
  defaultEdgeTypes: ["hub_backbone", "feeder_tree", "spoke", "spoke_fallback", "augment"],
  showJunctionsByDefault: false,
  showCorridorsByDefault: false
};

const METHOD3_CONFIG = {
  mapId: "railMapV4",
  legendId: "legendV4",
  metadata: "metadata_method3.json",
  edges: "network_edges_method3_optimized.geojson",
  hubs: "fixed_hubs_method3.geojson",
  junctions: "network_junctions_method3_sample.geojson",
  metricPrefix: "method3",
  title: "Method 3",
  defaultEdgeTypes: ["hub_backbone", "feeder_tree", "spoke", "spoke_fallback", "fallback_access_city", "augment"],
  showJunctionsByDefault: false,
  showCorridorsByDefault: false
};

const commonRailStyle = { color: "#123f1a", weight: 3.0, opacity: 0.82, pane: "railPane" };
const backboneDefault = { color: "#123f1a", weight: 4.3, opacity: 0.94, pane: "railBackbonePane" };

const railStylesByType = {
  hub_backbone: { color: "#123f1a", weight: 4.3, opacity: 0.96, pane: "railBackbonePane" },
  feeder_tree: { color: "#5f8f4e", weight: 2.55, opacity: 0.78, pane: "railPane" },
  spoke: { color: "#7ca66a", weight: 2.1, opacity: 0.58, pane: "railPane" },
  spoke_fallback: { color: "#65735e", weight: 2.55, opacity: 0.82, pane: "railPane" },
  fallback_access_city: { color: "#7d8a72", weight: 2.35, opacity: 0.78, pane: "railPane" },
  augment: { color: "#c99534", weight: 3.15, opacity: 0.9, pane: "railPane" },
  forced_flight_corridor: { color: "#b046a3", weight: 3.65, opacity: 0.9, pane: "priorityPane" }
};

const corridorStyles = {
  Good: { color: "#246b45", weight: 3.5, opacity: 0.78, dashArray: "8 8", pane: "corridorPane" },
  Okay: { color: "#b57422", weight: 3.5, opacity: 0.78, dashArray: "8 8", pane: "corridorPane" },
  Poor: { color: "#9d3f36", weight: 4, opacity: 0.86, dashArray: "8 8", pane: "corridorPane" }
};

const displayNames = {
  hub_backbone: "Hub backbone",
  feeder_tree: "Regional feeder trees",
  spoke: "Direct spokes",
  spoke_fallback: "Fallback spokes",
  fallback_access_city: "City-anchored fallback access",
  augment: "Gap-fill / augmenting links",
  forced_flight_corridor: "Remaining flight-corridor priority links"
};

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function featureCollection(features) {
  return { type: "FeatureCollection", features };
}

function makeTileLayers() {
  const positron = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19
  });

  const voyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19
  });

  return { positron, voyager };
}

function makePanes(map) {
  map.createPane("railPane");
  map.getPane("railPane").style.zIndex = 430;
  map.createPane("corridorPane");
  map.getPane("corridorPane").style.zIndex = 455;
  map.createPane("priorityPane");
  map.getPane("priorityPane").style.zIndex = 485;
  map.createPane("railBackbonePane");
  map.getPane("railBackbonePane").style.zIndex = 510;
  map.createPane("junctionPane");
  map.getPane("junctionPane").style.zIndex = 620;
  map.createPane("accessPane");
  map.getPane("accessPane").style.zIndex = 635;
  map.createPane("hubPane");
  map.getPane("hubPane").style.zIndex = 650;
}

function styleForType(edgeType, colorByType) {
  if (!colorByType) {
    return edgeType === "hub_backbone" ? backboneDefault : commonRailStyle;
  }
  return railStylesByType[edgeType] || commonRailStyle;
}

function createLegend(legendId, edgeTypes, colorByType, includeCorridors = true) {
  const legend = document.getElementById(legendId);
  if (!legend) return;

  const railItems = edgeTypes
    .filter((type) => type !== "unknown")
    .map((type) => {
      const style = styleForType(type, colorByType);
      const cls = type.replaceAll("_", "-");
      return `<span><i class="legend-line ${cls}" style="background:${style.color}"></i>${displayNames[type] || type}</span>`;
    })
    .join("");

  const corridorItems = includeCorridors ? `
    <span><i class="legend-line flight-good"></i>Good flight corridor fit</span>
    <span><i class="legend-line flight-okay"></i>Okay</span>
    <span><i class="legend-line flight-poor"></i>Poor</span>` : "";

  legend.innerHTML = `
    ${railItems}
    <span><i class="legend-dot hub"></i>Fixed hubs</span>${corridorItems}
  `;
}

function arcPoints(a, b, bend = 0.18, steps = 48) {
  const lat1 = a.lat, lon1 = a.lon;
  const lat2 = b.lat, lon2 = b.lon;
  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const curve = Math.min(8, dist * bend);
  const ctrlLon = (lon1 + lon2) / 2 + nx * curve;
  const ctrlLat = (lat1 + lat2) / 2 + ny * curve;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * ctrlLon + t * t * lon2;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    points.push([lat, lon]);
  }
  return points;
}

function addFlightCorridors(layerGroup, corridors, renderer) {
  layerGroup.clearLayers();
  corridors.forEach((d, index) => {
    if (![d.a_lat, d.a_lon, d.b_lat, d.b_lon].every((x) => Number.isFinite(Number(x)))) return;
    const a = { lat: Number(d.a_lat), lon: Number(d.a_lon) };
    const b = { lat: Number(d.b_lat), lon: Number(d.b_lon) };
    const style = { ...(corridorStyles[d.class] || corridorStyles.Good), renderer, interactive: false };
    const line = L.polyline(arcPoints(a, b, index % 2 === 0 ? 0.16 : -0.16), style);
    line.addTo(layerGroup);
  });
}

function renderCorridorTable(tableId, corridors, selected = "All") {
  const rows = document.getElementById(tableId);
  if (!rows) return;
  const filtered = selected === "All" ? corridors : corridors.filter((d) => d.class === selected);
  rows.innerHTML = filtered.map((d) => `
    <tr>
      <td><strong>${d.airport_a}–${d.airport_b}</strong><br><span>${d.airport_a_name || d.airport_a} ↔ ${d.airport_b_name || d.airport_b}</span></td>
      <td>${formatNumber(d.flights_per_day)}</td>
      <td>${formatNumber(d.detour_ratio, 2)}</td>
      <td><span class="badge ${(d.class || "").toLowerCase()}">${d.class}</span></td>
    </tr>
  `).join("");
}

function bringGroupToFront(map, layer) {
  if (!map.hasLayer(layer)) return;
  layer.bringToFront?.();
  layer.eachLayer?.((childLayer) => childLayer.bringToFront?.());
}

async function initRailMap(config) {
  const mapElement = document.getElementById(config.mapId);
  if (!mapElement) return null;

  const canvasRenderer = L.canvas({ padding: 0.5 });
  const map = L.map(config.mapId, {
    scrollWheelZoom: false,
    worldCopyJump: true,
    preferCanvas: true,
    renderer: canvasRenderer,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false
  }).setView([39.5, -98.35], 4);
  makePanes(map);

  const { positron, voyager } = makeTileLayers();
  voyager.addTo(map);

  const layersByType = {};
  const hubLayer = L.geoJSON(null, {
    renderer: canvasRenderer,
    pane: "hubPane",
    pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
      pane: "hubPane", radius: 8, color: "#123f1a", weight: 2.4,
      fillColor: "#f5f1e4", fillOpacity: 0.98, opacity: 1
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`<strong class="map-popup-title">${feature.properties.name}</strong>Fixed hub in the prototype network.`);
    }
  });

  const junctionLayer = L.geoJSON(null, {
    renderer: canvasRenderer,
    interactive: false,
    pane: "junctionPane",
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      pane: "junctionPane", radius: 2.5, color: "#47634d", fillColor: "#47634d",
      fillOpacity: 0.55, opacity: 0.65, weight: 1
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`<strong class="map-popup-title">Sampled junction</strong>Degree: ${feature.properties.degree ?? "—"}`);
    }
  });

  const accessAnchorLayer = L.geoJSON(null, {
    renderer: canvasRenderer,
    pane: "accessPane",
    pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
      pane: "accessPane", radius: 4.6, color: "#31572c", weight: 1.4,
      fillColor: "#fffdf3", fillOpacity: 0.92, opacity: 0.9
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const name = p.access_name || String(p.name || "").replace(/^Access:\s*/, "") || "Corridor access anchor";
      layer.bindPopup(`<strong class="map-popup-title">${name}</strong>Corridor access anchor used by Method 3 feeder-tree assignment, not a fixed hub.`);
    }
  });

  const flightLayer = L.layerGroup();

  let colorByType = true;
  const overlayOrder = [];

  function ensureLayer(edgeType) {
    if (layersByType[edgeType]) return layersByType[edgeType];
    const isPriorityLink = edgeType === "forced_flight_corridor";
    const layer = L.geoJSON(null, {
      renderer: canvasRenderer,
      style: () => styleForType(edgeType, colorByType),
      interactive: false,
      pane: (railStylesByType[edgeType] || commonRailStyle).pane || "railPane",
      onEachFeature: (feature, featureLayer) => {
        if (!isPriorityLink) return;
        const p = feature.properties || {};
        const pair = [p.airport_a, p.airport_b].filter(Boolean).join("–") || "Priority link";
        const flights = Number.isFinite(Number(p.flights_per_day)) ? formatNumber(p.flights_per_day) : "—";
        featureLayer.bindPopup(`
          <strong class="map-popup-title">Flight-corridor priority link</strong>
          <div>${pair}</div>
          <div>Added after the flight-corridor evaluation identified an indirect rail path.</div>
          <div>Approx. flights/day in evaluated corridor: <strong>${flights}</strong></div>
        `);
      }
    });
    layersByType[edgeType] = layer;
    overlayOrder.push(edgeType);
    return layer;
  }

  function applyRailColorMode(enabled) {
    colorByType = enabled;
    Object.entries(layersByType).forEach(([type, layer]) => layer.setStyle(styleForType(type, colorByType)));
    createLegend(config.legendId, overlayOrder, colorByType, Boolean(config.corridors));
  }

  function enforceOverlayOrder() {
    ["spoke", "feeder_tree", "spoke_fallback", "fallback_access_city", "augment", "forced_flight_corridor", "hub_backbone"].forEach((type) => {
      if (layersByType[type]) bringGroupToFront(map, layersByType[type]);
    });
    bringGroupToFront(map, flightLayer);
    bringGroupToFront(map, junctionLayer);
    bringGroupToFront(map, accessAnchorLayer);
    bringGroupToFront(map, hubLayer);
  }

  const [metadata, edges, hubs, accessAnchors, junctions, corridors] = await Promise.all([
    fetch(`${DATA_PATH}${config.metadata}`).then((r) => r.json()).catch(() => ({})),
    fetch(`${DATA_PATH}${config.edges}`).then((r) => r.json()),
    fetch(`${DATA_PATH}${config.hubs}`).then((r) => r.json()),
    config.accessAnchors
      ? fetch(`${DATA_PATH}${config.accessAnchors}`).then((r) => r.json()).catch(() => ({ type: "FeatureCollection", features: [] }))
      : Promise.resolve({ type: "FeatureCollection", features: [] }),
    fetch(`${DATA_PATH}${config.junctions}`).then((r) => r.json()).catch(() => ({ type: "FeatureCollection", features: [] })),
    config.corridors
      ? fetch(`${DATA_PATH}${config.corridors}`).then((r) => r.json()).catch(() => [])
      : Promise.resolve([])
  ]);

  const grouped = {};
  edges.features.forEach((feature) => {
    const type = feature.properties?.edge_type || "unknown";
    grouped[type] ||= [];
    grouped[type].push(feature);
  });

  const preferredOrder = ["spoke", "feeder_tree", "spoke_fallback", "fallback_access_city", "augment", "forced_flight_corridor", "hub_backbone"];
  const edgeTypes = [...preferredOrder.filter((t) => grouped[t]), ...Object.keys(grouped).filter((t) => !preferredOrder.includes(t))];

  const defaultEdgeTypes = new Set(config.defaultEdgeTypes || edgeTypes);

  edgeTypes.forEach((type) => {
    const layer = ensureLayer(type);
    layer.addData(featureCollection(grouped[type]));
    if (defaultEdgeTypes.has(type)) {
      layer.addTo(map);
    }
  });

  hubLayer.addData(hubs).addTo(map);
  accessAnchorLayer.addData(accessAnchors);
  if (config.showAccessAnchorsByDefault) accessAnchorLayer.addTo(map);
  junctionLayer.addData(junctions);
  if (config.showJunctionsByDefault) junctionLayer.addTo(map);
  if (config.corridors) {
    addFlightCorridors(flightLayer, corridors, canvasRenderer);
    if (config.showCorridorsByDefault) flightLayer.addTo(map);
  }

  const overlays = {};
  edgeTypes.forEach((type) => { overlays[displayNames[type] || type] = layersByType[type]; });
  overlays["Fixed hubs"] = hubLayer;
  if (config.accessAnchors) overlays["Corridor access anchors"] = accessAnchorLayer;
  if (config.corridors) overlays["Evaluated air corridors"] = flightLayer;

  L.control.layers({ "Light basemap": positron, "Voyager basemap": voyager }, overlays, { collapsed: true }).addTo(map);

  const railColorControl = L.control({ position: "topright" });
  railColorControl.onAdd = () => {
    const container = L.DomUtil.create("div", "leaflet-control-layers rail-color-toggle");
    const id = `railColorToggle-${config.mapId}`;
    container.innerHTML = `<label><input type="checkbox" id="${id}" checked /><span>Color rail by edge type</span></label>`;
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    setTimeout(() => {
      document.getElementById(id)?.addEventListener("change", (event) => applyRailColorMode(event.target.checked));
    }, 0);
    return container;
  };
  railColorControl.addTo(map);

  map.on("baselayerchange overlayadd overlayremove", enforceOverlayOrder);

  applyRailColorMode(true);
  enforceOverlayOrder();

  const boundsSource = layersByType.hub_backbone || Object.values(layersByType)[0];
  const bounds = boundsSource?.getBounds?.();
  if (bounds && bounds.isValid()) {
    requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    map.fitBounds(bounds.pad(0.12));
    setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds.pad(0.12));
    }, 250);
  }

  return { map, metadata, corridors, edgeTypes };
}

async function init() {
  const [baseline, v3, method3] = await Promise.all([
    initRailMap(BASELINE_CONFIG),
    initRailMap(V3_CONFIG),
    initRailMap(METHOD3_CONFIG)
  ]);

  const latest = method3 || v3 || baseline;
  if (latest?.metadata) {
    document.getElementById("metric-nodes").textContent = formatNumber(latest.metadata.graph_nodes);
    document.getElementById("metric-edges").textContent = formatNumber(latest.metadata.graph_edges);
    document.getElementById("metric-hubs").textContent = formatNumber(
      latest.metadata.fixed_hub_names?.length || latest.metadata.hub_names?.length || 14
    );
  }
  document.getElementById("metric-corridors").textContent = formatNumber(Math.max(baseline?.corridors?.length || 0, v3?.corridors?.length || 0));

  const baselineCorridors = baseline?.corridors || [];
  const v3Corridors = v3?.corridors || [];
  renderCorridorTable("corridorRowsMethod1", baselineCorridors);
  renderCorridorTable("corridorRowsMethod2", v3Corridors);

  const method1Filter = document.getElementById("corridorFilterMethod1");
  method1Filter?.addEventListener("change", () => {
    renderCorridorTable("corridorRowsMethod1", baselineCorridors, method1Filter.value);
  });

  const method2Filter = document.getElementById("corridorFilterMethod2");
  method2Filter?.addEventListener("change", () => {
    renderCorridorTable("corridorRowsMethod2", v3Corridors, method2Filter.value);
  });
}

init().catch((error) => {
  console.error("Unable to load rail project data", error);
  ["railMapBaseline", "railMapV3", "railMapV4"].forEach((id) => {
    const mapElement = document.getElementById(id);
    if (mapElement) {
      mapElement.innerHTML = '<div style="padding: 24px; font-family: Inter, system-ui; color: #17361d;">Unable to load the interactive map data. Please check that the data folder was uploaded with the page.</div>';
    }
  });
});
