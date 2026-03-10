      "use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, LngLatLike, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import type * as GeoJSON from "geojson";
import type { MapboxPickedUnit, MapboxSceneFilter, Unit, BalconyProperties, AxisBasis, UnitsTransform } from "./mapbox/types";
import {
  TOTAL_FLOORS,
  FLOOR_HEIGHT_M,
  FLOOR_SCALE_OVERRIDES,
  emptyFeatureCollection,
  UNITS_OUTLINE_STRIP_SCALE,
  UNITS_OUTLINE_OUTSET,
  UNITS_OUTLINE_Z_EPS,
  UNITS_OUTLINE_BAND_HEIGHT,
  UNITS_OUTLINE_VERT_POST_MULT,
  UNITS_OUTLINE_VERT_INSET_MULT,
  UNITS_OUTLINE_VERT_POST_MIN_SIZE,
  UNITS_OUTLINE_COLOR,
  UNITS_OUTLINE_OPACITY,
  BUILDING_BASE_COLOR,
  BALCONY_FLOOR_COLOR,
  TERRACE_FLOOR_COLOR,
  TERRACE_GLASS_COLOR,
  TERRACE_GLASS_OPACITY,
  BALCONY_GLASS_COLOR,
  BALCONY_GLASS_OPACITY,
  FACADE_GLASS_COLOR,
  FACADE_GLASS_OPACITY,

  FLOOR5_LEFT_PANORAMA_BAND,
  FLOOR5_FRONT_RIGHT_BAND,
  FLOOR5_PERP_WINDOW_BAND,
  FLOOR5_FRONT_ASPECT_RATIO,
  FLOOR5_EDGE_BLEND,
  STREET_CORNER_BEAM_WIDTH_FACTOR,
  STREET_CORNER_BEAM_DEPTH_FACTOR,
  FLOOR5_RELAXED_FACING_COS,
  FLOOR5_SIDE_WINDOW_BAND,
  FLOOR5_FRONT_ALIGNMENT,
  FLOOR5_SIDE_ALIGNMENT,
  BALCONY_FALLBACK,
  TERRACE_FALLBACK,
  HOVER_EDGE_SCALE,
  HOVER_FACE_SCALE,
  HOVER_BASE_LIFT,
} from "./mapbox/constants";
import {
  ensureClosedRing,
  createRailGeometry,
  getPrimaryRing,
} from "./mapbox/geometry";

import {
  loadUnitsFromGeojson,
  loadFloorFeatureCollection,
  uvToLngLat as _uvToLngLat,
  sanitizeStyleExpression as _sanitizeStyleExpression,
  deriveFootprintFromUnits,
} from "./mapbox/data";
import {
  offsetGeometry,
  collectGeometryPoints,
  scaleGeometryFromCenter,
} from "./mapbox/geojson";

import { buildUnitsTransform } from "./mapbox/unitsTransform";

import {
  makeOutlineFeatureCollection,
  filterFeatureCollection,
  makeVerticalOutlineFeatureCollection,
  makeExternalUnitsFeatureCollection,
  makeStreetGlassFeatureCollection,
  makeOutdoorFeatureCollection,
} from "./mapbox/features";

const uvToLngLat = _uvToLngLat;
const sanitizeStyleExpression = _sanitizeStyleExpression;

export type { MapboxPickedUnit, MapboxSceneFilter, Unit, BalconyProperties, AxisBasis, UnitsTransform };

function centroidOfPolygon(points: [number, number][]): [number, number] {
  if (!points.length) return [0, 0];
  const sum = points.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);

  return [sum[0] / points.length, sum[1] / points.length];
}

function scaleGeometry(geometry: any, factor: number): any {
  if (!geometry || !factor) return geometry;
  const pts = collectGeometryPoints(geometry);
  if (!pts.length) return geometry;
  const center = centroidOfPolygon(pts);
  return scaleGeometryFromCenter(geometry, factor, center);
}

function makeUnitsFeatureCollection(quad: [number, number][], units: Unit[]) {
  return {
    type: "FeatureCollection",
    features: units.map(u => {
      const ring = u.polyUV.map(p => uvToLngLat(p, quad));
      ring.push(ring[0]);
      // place unit extrusion to occupy the whole floor height on the facade
      // add small epsilon inset to avoid z-fighting with building top/base
      const min_h = (u.floor - 1) * FLOOR_HEIGHT_M + 0.02;
      const h = u.floor * FLOOR_HEIGHT_M - 0.02;
      return {
        type: "Feature",
        properties: { id: u.id, floor: u.floor, status: u.status, area: u.area, rooms: u.rooms, min_height: min_h, height: h },
        geometry: { type: "Polygon", coordinates: [ring] }
      };
    })
  } as GeoJSON.FeatureCollection;
}

export default function MapboxScene({
  filter,
  onPick,
}: {
  filter: MapboxSceneFilter;
  onPick?: (u: MapboxPickedUnit) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const hasCustomFootprint = useRef(false);
  const lastCameraCenterKey = useRef<string>("");
  const [unitsTransform, setUnitsTransform] = useState<UnitsTransform | null>(null);

  const cameraOffsetXForMap = (map: Map) => {
    const w = (map.getCanvas() as any)?.clientWidth ?? 0;
    return Math.round(w * 0.07);
  };

  const center = useMemo<[number, number]>(() => {
    const lat = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LAT || "36.7696");
    const lng = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LNG || "-4.0387");
    return [lng, lat];
  }, []);

  const [footprint, setFootprint] = useState<[number, number][]>(() => {
    const [lng, lat] = center;
    const dx = 0.00009 * Math.cos(lat * Math.PI / 180);
    const dy = 0.00006;
    return [
      [lng - dx, lat + dy],
      [lng + dx, lat + dy],
      [lng + dx * 0.95, lat - dy],
      [lng - dx * 0.95, lat - dy],
    ];
  });

  // Try to load a user-provided footprint / quad from public/building-quad.json
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/building-quad.json');
        if (!res.ok) { try { console.warn('MapboxScene: /building-quad.json not found', res.status); } catch {} ; return; }
        const json = await res.json();
        let quad: [number, number][] | null = null;
        // support simple array [[lng,lat],..] or GeoJSON Feature / FeatureCollection with Polygon
        const normalizeRing = (ring: any) => {
          if (!Array.isArray(ring)) return null;
          const coords = ring.filter((p: any) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number');
          if (!coords.length) return null;
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first && last && first[0] === last[0] && first[1] === last[1]) {
            coords.pop();
          }
          return coords.length >= 3 ? coords as [number, number][] : null;
        };
        if (Array.isArray(json) && json.length >= 3 && Array.isArray(json[0])) {
          quad = normalizeRing(json as any) ?? null;
        } else if (json && json.type === 'Feature' && json.geometry && json.geometry.type === 'Polygon') {
          quad = normalizeRing(json.geometry.coordinates[0]) ?? null;
        } else if (json && json.type === 'FeatureCollection' && Array.isArray(json.features) && json.features.length) {
          const f = json.features.find((ff: any) => ff.geometry && ff.geometry.type === 'Polygon');
          if (f) quad = normalizeRing(f.geometry.coordinates[0]) ?? null;
        }
        if (quad && mounted) setFootprint(quad);
        if (quad && mounted) {
          try { console.info('MapboxScene: loaded building-quad.json, using quad:', quad); } catch {}
          setFootprint(quad);
          hasCustomFootprint.current = true;
        }
      } catch (e) {
        try { console.warn('MapboxScene: failed to load /building-quad.json', e); } catch {}
        // ignore - fallback to generated rectangle
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [units, setUnits] = useState<Unit[]>([]);
  const [externalUnits, setExternalUnits] = useState<GeoJSON.FeatureCollection | null>(null);
  const [useRawUnits, setUseRawUnits] = useState(false);
  const [unitsGeojson, setUnitsGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [terraceGeojson, setTerraceGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [streetGlassGeojson, setStreetGlassGeojson] = useState<GeoJSON.FeatureCollection>(emptyFeatureCollection);
  const [balconyFeatures, setBalconyFeatures] = useState<GeoJSON.FeatureCollection | null>(BALCONY_FALLBACK);
  const [terraceFeatures, setTerraceFeatures] = useState<GeoJSON.FeatureCollection | null>(TERRACE_FALLBACK);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    let source: GeoJSONSource | undefined;
    try {
      source = map.getSource("units") as GeoJSONSource | undefined;
    } catch {
      source = undefined;
    }
    if (!source) return;

    let unitsSourceData: GeoJSON.FeatureCollection;
    if (externalUnits && externalUnits.type === 'FeatureCollection') {
      unitsSourceData = makeExternalUnitsFeatureCollection(externalUnits, unitsTransform);
    } else {
      unitsSourceData = makeUnitsFeatureCollection(
        (Array.isArray(footprint) ? (footprint as [number, number][]) : [center]) as any,
        units
      ) as any;
    }
    source.setData(unitsSourceData as any);
    try {
      const outlineVertSource = map.getSource("units-outline-vert") as GeoJSONSource | undefined;
      if (outlineVertSource) {
        outlineVertSource.setData(makeVerticalOutlineFeatureCollection(unitsSourceData) as any);
      }
    } catch {}
    try {
      const outlineFloor6Source = map.getSource("units-outline-floor6") as GeoJSONSource | undefined;
      if (outlineFloor6Source) {
        const floor6Units = filterFeatureCollection(unitsSourceData, (feature: GeoJSON.Feature) => {
          const props = feature.properties as any;
          return Number(props?.floor) === 6;
        });
        outlineFloor6Source.setData(
          makeOutlineFeatureCollection(floor6Units, UNITS_OUTLINE_STRIP_SCALE) as any
        );
      }
    } catch {}
    setUnitsGeojson(unitsSourceData as GeoJSON.FeatureCollection);
  }, [ready, externalUnits, unitsTransform, useRawUnits, units, footprint, center]);

  // fallback UV units for demo/testing
  useEffect(() => {
    let mounted = true;
    loadUnitsFromGeojson()
      .then((data) => {
        if (mounted && data.length) setUnits(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Load detailed per-floor GeoJSON (floor1..floor6). If absent, fall back to legacy units.geojson
  useEffect(() => {
    let mounted = true;
    (async () => {
      const floorsFC = await loadFloorFeatureCollection();
      if (mounted && floorsFC) {
        setExternalUnits(floorsFC);
        setUseRawUnits(true);
        try {
          const [balconRes, terraceRes] = await Promise.allSettled([
            fetch("/plans/geojson/balcon.geojson", { cache: "no-store" }),
            fetch("/plans/geojson/terraces.geojson", { cache: "no-store" })
          ]);
          if (balconRes.status === "fulfilled" && balconRes.value.ok) {
            const balconJson = await balconRes.value.json();
            if (mounted && balconJson?.type === "FeatureCollection") {
              try { console.info("MapboxScene: loaded balcon.geojson with", balconJson.features?.length ?? 0, "features"); } catch {}
              setBalconyFeatures(balconJson as GeoJSON.FeatureCollection);
            }
          } else {
            setBalconyFeatures(BALCONY_FALLBACK);
          }
          if (terraceRes.status === "fulfilled" && terraceRes.value.ok) {
            const terraceJson = await terraceRes.value.json();
            if (mounted && terraceJson?.type === "FeatureCollection") {
              try { console.info("MapboxScene: loaded terraces.geojson with", terraceJson.features?.length ?? 0, "features"); } catch {}
              setTerraceFeatures(terraceJson as GeoJSON.FeatureCollection);
            }
          } else {
            setTerraceFeatures(TERRACE_FALLBACK);
          }
        } catch {
          setBalconyFeatures(BALCONY_FALLBACK);
          setTerraceFeatures(TERRACE_FALLBACK);
        }
        return;
      }
      try {
        const res = await fetch('/plans/geojson/units.geojson');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json && json.type === 'FeatureCollection') {
          setExternalUnits(json as GeoJSON.FeatureCollection);
          setUseRawUnits(false);
        }
      } catch {
        // ignore
      }
      try {
        const [balconRes, terraceRes] = await Promise.allSettled([
          fetch("/plans/geojson/balcon.geojson", { cache: "no-store" }),
          fetch("/plans/geojson/terraces.geojson", { cache: "no-store" })
        ]);
        if (balconRes.status === "fulfilled" && balconRes.value.ok) {
          const balconJson = await balconRes.value.json();
          if (mounted && balconJson?.type === "FeatureCollection") {
            try { console.info("MapboxScene: loaded balcon.geojson with", balconJson.features?.length ?? 0, "features"); } catch {}
            setBalconyFeatures(balconJson as GeoJSON.FeatureCollection);
          }
        } else {
          setBalconyFeatures(BALCONY_FALLBACK);
        }
        if (terraceRes.status === "fulfilled" && terraceRes.value.ok) {
          const terraceJson = await terraceRes.value.json();
          if (mounted && terraceJson?.type === "FeatureCollection") {
            try { console.info("MapboxScene: loaded terraces.geojson with", terraceJson.features?.length ?? 0, "features"); } catch {}
            setTerraceFeatures(terraceJson as GeoJSON.FeatureCollection);
          }
        } else {
          setTerraceFeatures(TERRACE_FALLBACK);
        }
      } catch {
        setBalconyFeatures(BALCONY_FALLBACK);
        setTerraceFeatures(TERRACE_FALLBACK);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!externalUnits || !hasCustomFootprint.current || footprint.length < 3 || useRawUnits) {
      setUnitsTransform(null);
      return;
    }
    const hull = deriveFootprintFromUnits(externalUnits);
    if (!hull || hull.length < 3) {
      setUnitsTransform(null);
      return;
    }
    const transform = buildUnitsTransform(hull, footprint);
    setUnitsTransform(transform);
  }, [externalUnits, footprint, useRawUnits]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    let source: GeoJSONSource | undefined;
    try {
      source = map.getSource("balconies") as GeoJSONSource | undefined;
    } catch {
      source = undefined;
    }
    if (!source) return;
    const data = makeOutdoorFeatureCollection(balconyFeatures, unitsTransform, { useRaw: useRawUnits, mode: "balcony" });
    try { console.info("MapboxScene: updating balcony source", { features: data.features?.length ?? 0 }); } catch {}
    source.setData(data as any);
    try {
      const outlineSource = map.getSource("balconies-outline") as GeoJSONSource | undefined;
      if (outlineSource) {
        const balconyOutlineTarget = filterFeatureCollection(data, (feature: GeoJSON.Feature) => {
          const props = feature.properties as any;
          const floor = Number(props?.floor);
          return props?.kind === "balcony-floor" && (floor === 2 || floor === 3);
        });
        outlineSource.setData(makeOutlineFeatureCollection(balconyOutlineTarget, UNITS_OUTLINE_STRIP_SCALE) as any);
      }
    } catch {}
  }, [balconyFeatures, unitsTransform, useRawUnits, ready]);
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    let source: GeoJSONSource | undefined;
    try {
      source = map.getSource("terraces") as GeoJSONSource | undefined;
    } catch {
      source = undefined;
    }
    if (!source) return;
    const data = makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" });
    try { console.info("MapboxScene: updating terrace source", { features: data.features?.length ?? 0 }); } catch {}
    source.setData(data as any);
    try {
      const outlineSource = map.getSource("terraces-outline") as GeoJSONSource | undefined;
      if (outlineSource) {
        const terraceOutlineTarget = filterFeatureCollection(data, (feature: GeoJSON.Feature) => {
          const props = feature.properties as any;
          const floor = Number(props?.floor);
          return props?.kind === "terrace-floor" && (floor === 4 || floor === 5 || floor === 6);
        });
        outlineSource.setData(makeOutlineFeatureCollection(terraceOutlineTarget, UNITS_OUTLINE_STRIP_SCALE) as any);
      }
    } catch {}
    setTerraceGeojson(data as GeoJSON.FeatureCollection);
  }, [terraceFeatures, unitsTransform, useRawUnits, ready]);

  useEffect(() => {
    if (!unitsGeojson || !terraceGeojson) {
      setStreetGlassGeojson(emptyFeatureCollection);
      return;
    }
    const glass = makeStreetGlassFeatureCollection(unitsGeojson, terraceGeojson);
    setStreetGlassGeojson(glass);
  }, [unitsGeojson, terraceGeojson]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    let source: GeoJSONSource | undefined;
    try {
      source = map.getSource("street-glass") as GeoJSONSource | undefined;
    } catch {
      source = undefined;
    }
    if (!source) return;
    source.setData(streetGlassGeojson as any);
  }, [streetGlassGeojson, ready]);
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;

    const cameraCenter = centroidOfPolygon(footprint);

    const styleUrl = "https://api.mapbox.com/styles/v1/mapbox/standard?access_token=" + token;

    const readBaseBuildingsMode = (): "hide" | "shrink" | "show" => {
      try {
        const v = localStorage.getItem("baseBuildingsMode");
        if (v === "hide" || v === "shrink" || v === "show") return v;
      } catch {
        // ignore
      }
      return "shrink";
    };

    const readBaseBuildingsHeightMult = (): number => {
      try {
        const raw = localStorage.getItem("baseBuildingsHeightMult");
        if (raw == null) return 0.4;
        const v = Number(raw);
        if (!Number.isFinite(v)) return 0.4;
        return Math.max(0, Math.min(1, v));
      } catch {
        return 0.4;
      }
    };

    const BASE_BUILDINGS_MODE = readBaseBuildingsMode();
    const BASE_BUILDINGS_HEIGHT_MULT = readBaseBuildingsHeightMult();

    const prepareStyle = async () => {
      try {
        const res = await fetch(styleUrl);

        if (!res.ok) throw new Error(`status ${res.status}`);
        const styleJson = await res.json();

        const scaleStyleExpression = (expr: any, factor: number) => {
          if (typeof expr === "number") return expr * factor;
          if (Array.isArray(expr)) return ["*", expr, factor];
          return expr;
        };

        const sanitizeLayer = (layer: any) => {
          if (!layer) return;
          if (layer.paint) {
            Object.keys(layer.paint).forEach((prop) => {
              layer.paint[prop] = sanitizeStyleExpression(layer.paint[prop]);
            });

            try {
              Object.keys(layer.paint).forEach((prop) => {
                if (typeof prop === "string" && prop.endsWith("emissive-strength")) {
                  const v = layer.paint[prop];
                  if (Array.isArray(v)) layer.paint[prop] = 1;
                }
              });
            } catch {}
          }
          if (layer.layout) {
            Object.keys(layer.layout).forEach((prop) => {
              layer.layout[prop] = sanitizeStyleExpression(layer.layout[prop]);
            });
          }
        };

        (styleJson.layers || []).forEach(sanitizeLayer);

        try {
          (styleJson.imports || []).forEach((imp: any) => {
            const layers = imp?.data?.layers;
            if (Array.isArray(layers)) layers.forEach(sanitizeLayer);
          });
        } catch {}

        if (Array.isArray(styleJson.layers)) {
          if (BASE_BUILDINGS_MODE === "hide") {
            styleJson.layers = styleJson.layers.filter((layer: any) => {
              const type = layer?.type;
              const sourceLayer = layer?.["source-layer"];
              if (type === "fill-extrusion") return false;
              if (sourceLayer === "building") return false;
              return true;
            });
          }

          if (BASE_BUILDINGS_MODE === "shrink") {
            styleJson.layers.forEach((layer: any) => {
              const type = layer?.type;
              const sourceLayer = layer?.["source-layer"];
              const isBuildingLayer = type === "fill-extrusion" || sourceLayer === "building";
              if (!isBuildingLayer) return;
              if (!layer.paint) return;

              if (layer.paint["fill-extrusion-height"] != null) {
                layer.paint["fill-extrusion-height"] = scaleStyleExpression(
                  layer.paint["fill-extrusion-height"],
                  BASE_BUILDINGS_HEIGHT_MULT
                );
              }
              if (layer.paint["fill-extrusion-base"] != null) {
                layer.paint["fill-extrusion-base"] = scaleStyleExpression(
                  layer.paint["fill-extrusion-base"],
                  BASE_BUILDINGS_HEIGHT_MULT
                );
              }
            });
          }
        }
        return styleJson;
      } catch (err) {
        try { console.warn('MapboxScene: failed to load sanitized style, fallback to default', err); } catch {}
        return "mapbox://styles/mapbox/standard";

      }
    };

    prepareStyle().then((styleConfig) => {
      if (!containerRef.current) return;
      const map = new mapboxgl.Map({
        container: containerRef.current as HTMLElement,
        style: styleConfig as any,
        center: cameraCenter as LngLatLike,
        zoom: 17.6,
        pitch: 64,
        bearing: 280,
        antialias: true,
        cooperativeGestures: true,
      });
        mapRef.current = map;
        try { (window as any).__debugMap = map; } catch {}

        // Controls: rotate with LMB (bearing + pitch). We disable default dragRotate to avoid conflicts.
        try {
          map.dragRotate.disable();
        } catch {}
        try {
          // If it was enabled somewhere else, keep it off.
          map.touchZoomRotate.disableRotation();
        } catch {}

        const isTouchDevice =
          typeof window !== "undefined" &&
          (("ontouchstart" in window) || ((navigator as any)?.maxTouchPoints ?? 0) > 0);

        if (isTouchDevice) {
          map.touchZoomRotate.enableRotation();
        }

        try {
          const canvas = map.getCanvas();
          let rotating = false;
          let suppressContextMenuUntil = 0;
          let startX = 0;
          let startY = 0;
          let startBearing = 0;
          let startPitch = 0;

          const onDocContextMenu = (e: MouseEvent) => {
            const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
            if (rotating || now < suppressContextMenuUntil) {
              try { e.preventDefault(); } catch {}
              try { e.stopPropagation(); } catch {}
            }
          };

          const onDown = (e: PointerEvent) => {
            // RMB only: avoids accidental apartment clicks while rotating
            if (e.button !== 2) return;
            rotating = true;
            suppressContextMenuUntil = (typeof performance !== "undefined" ? performance.now() : Date.now()) + 800;
            startX = e.clientX;
            startY = e.clientY;
            startBearing = map.getBearing();
            startPitch = map.getPitch();
            try { map.dragPan.disable(); } catch {}
            try { canvas.setPointerCapture(e.pointerId); } catch {}
            try { e.preventDefault(); } catch {}
            try { document.addEventListener("contextmenu", onDocContextMenu, true); } catch {}
          };

          const onMove = (e: PointerEvent) => {
            if (!rotating) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const bearing = startBearing + dx * 0.25;
            const pitch = Math.max(15, Math.min(80, startPitch - dy * 0.15));
            try {
              map.setBearing(bearing);
              map.setPitch(pitch);
            } catch {}
            try { e.preventDefault(); } catch {}
          };

          const onUp = (e: PointerEvent) => {
            if (!rotating) return;
            rotating = false;
            try { map.dragPan.enable(); } catch {}
            try { canvas.releasePointerCapture(e.pointerId); } catch {}
            try { e.preventDefault(); } catch {}
            try { document.removeEventListener("contextmenu", onDocContextMenu, true); } catch {}
          };

          const onContextMenu = (e: MouseEvent) => {
            // When using RMB-drag for rotate, suppress the browser context menu.
            const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
            if (rotating || now < suppressContextMenuUntil) {
              try { e.preventDefault(); } catch {}
              return;
            }
            // Also suppress context menu on the map canvas in general, since RMB is reserved for camera controls.
            try { e.preventDefault(); } catch {}
          };

          canvas.addEventListener("pointerdown", onDown, { passive: false });
          canvas.addEventListener("pointermove", onMove, { passive: false });
          canvas.addEventListener("pointerup", onUp, { passive: false });
          canvas.addEventListener("pointercancel", onUp, { passive: false });
          canvas.addEventListener("contextmenu", onContextMenu, { passive: false, capture: true } as any);

          // Cleanup on map remove
          map.once("remove", () => {
            try { canvas.removeEventListener("pointerdown", onDown as any); } catch {}
            try { canvas.removeEventListener("pointermove", onMove as any); } catch {}
            try { canvas.removeEventListener("pointerup", onUp as any); } catch {}
            try { canvas.removeEventListener("pointercancel", onUp as any); } catch {}
            try { canvas.removeEventListener("contextmenu", onContextMenu as any); } catch {}
            try { document.removeEventListener("contextmenu", onDocContextMenu, true); } catch {}
          });
        } catch {}

        map.on("load", () => {
          try {
        // Наш дом: добавляем footprint и слой здания
          const polygonCoords = Array.isArray(footprint) && footprint.length >= 4 ? [...footprint, footprint[0]] : null;
          if (!polygonCoords) {
            console.warn('MapboxScene: invalid footprint, falling back to generated rectangle', footprint);
          }
          // validate coordinates: each item should be [number, number]
          const isValid = polygonCoords && polygonCoords.every((p: any) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number');
          const usedPolygon = isValid ? polygonCoords : [...(typeof footprint !== 'undefined' ? footprint as any : []), (footprint as any)?.[0]];
          try { console.info('MapboxScene: using polygon coords for building footprint:', usedPolygon); } catch {}
          // our footprint source (needed for transform math even without rendering)
          const FLOORS = TOTAL_FLOORS;
          if (isValid) {
            map.addSource("our-footprint", { type: "geojson", data: { type: "Feature", id: "building", properties: { floors: FLOORS }, geometry: { type: "Polygon", coordinates: [polygonCoords! as any] } } });
          } else {
            const [lng, lat] = center;
            const dx = 0.00009 * Math.cos(lat * Math.PI / 180);
            const dy = 0.00006;
            const fallback = [
              [lng - dx, lat + dy],
              [lng + dx, lat + dy],
              [lng + dx * 0.95, lat - dy],
              [lng - dx * 0.95, lat - dy],
            ];
            map.addSource("our-footprint", { type: "geojson", data: { type: "Feature", id: "building", properties: { floors: FLOORS }, geometry: { type: "Polygon", coordinates: [fallback.concat([fallback[0]])] } } });
            console.info('MapboxScene: used fallback rectangle footprint', fallback);
          }

          // Квартиры: добавляем source и слои (оставляем поверх фасада)
          let unitsSourceData: GeoJSON.FeatureCollection;
          if (externalUnits && externalUnits.type === 'FeatureCollection') {
            unitsSourceData = makeExternalUnitsFeatureCollection(externalUnits, unitsTransform);
          } else {
            unitsSourceData = makeUnitsFeatureCollection(
              (Array.isArray(footprint) ? (footprint as [number, number][]) : [center]) as any,
              units
            ) as any;
          }

          map.addSource("units", { type: "geojson", data: unitsSourceData });
          map.addSource("units-outline-vert", { type: "geojson", data: makeVerticalOutlineFeatureCollection(unitsSourceData) });
          map.addSource("units-outline-floor6", {
            type: "geojson",
            data: makeOutlineFeatureCollection(
              filterFeatureCollection(unitsSourceData, (feature: GeoJSON.Feature) => {
                const props = feature.properties as any;
                return Number(props?.floor) === 6;
              }),
              UNITS_OUTLINE_STRIP_SCALE
            )
          });
          setUnitsGeojson(unitsSourceData as GeoJSON.FeatureCollection);
          map.addSource("hover-unit", { type: "geojson", data: emptyFeatureCollection });
          map.addSource("hover-edge", { type: "geojson", data: emptyFeatureCollection });
          map.addSource("balconies", {
            type: "geojson",
            data: makeOutdoorFeatureCollection(balconyFeatures, unitsTransform, { useRaw: useRawUnits, mode: "balcony" })
          });
          map.addSource("balconies-outline", {
            type: "geojson",
            data: makeOutlineFeatureCollection(
              filterFeatureCollection(
                makeOutdoorFeatureCollection(balconyFeatures, unitsTransform, { useRaw: useRawUnits, mode: "balcony" }),
                (feature: GeoJSON.Feature) => {
                  const props = feature.properties as any;
                  const floor = Number(props?.floor);
                  return props?.kind === "balcony-floor" && (floor === 2 || floor === 3);
                }
              ),
              UNITS_OUTLINE_STRIP_SCALE
            )
          });
          map.addSource("terraces", {
            type: "geojson",
            data: makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" })
          });
          map.addSource("terraces-outline", {
            type: "geojson",
            data: makeOutlineFeatureCollection(
              filterFeatureCollection(
                makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" }),
                (feature: GeoJSON.Feature) => {
                  const props = feature.properties as any;
                  const floor = Number(props?.floor);
                  return props?.kind === "terrace-floor" && (floor === 4 || floor === 5 || floor === 6);
                }
              ),
              UNITS_OUTLINE_STRIP_SCALE
            )
          });
          setTerraceGeojson(makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" }));
          map.addSource("street-glass", { type: "geojson", data: streetGlassGeojson });
          map.addLayer({
            id: "units-outline-floor6-fill",
            type: "fill-extrusion",
            source: "units-outline-floor6",
            paint: {
              "fill-extrusion-color": UNITS_OUTLINE_COLOR,
              "fill-extrusion-height": ["+", ["get", "height"], UNITS_OUTLINE_Z_EPS],
              "fill-extrusion-base": [
                "-",
                ["-", ["get", "height"], UNITS_OUTLINE_BAND_HEIGHT],
                UNITS_OUTLINE_Z_EPS
              ],
              "fill-extrusion-opacity": UNITS_OUTLINE_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "units-outline-vert-fill",
            type: "fill-extrusion",
            source: "units-outline-vert",
            paint: {
              "fill-extrusion-color": UNITS_OUTLINE_COLOR,
              "fill-extrusion-height": ["+", ["get", "height"], UNITS_OUTLINE_Z_EPS],
              "fill-extrusion-base": ["-", ["get", "min_height"], UNITS_OUTLINE_Z_EPS],
              "fill-extrusion-opacity": UNITS_OUTLINE_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "balcony-floor-fill",
            type: "fill-extrusion",
            source: "balconies",
            filter: ["==", ["get", "kind"], "balcony-floor"],
            paint: {
              "fill-extrusion-color": BALCONY_FLOOR_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.96,
              "fill-extrusion-vertical-gradient": false
            }
          });

          map.addLayer({
            id: "balconies-outline-fill",
            type: "fill-extrusion",
            source: "balconies-outline",
            paint: {
              "fill-extrusion-color": UNITS_OUTLINE_COLOR,
              "fill-extrusion-height": ["+", ["get", "height"], UNITS_OUTLINE_Z_EPS],
              "fill-extrusion-base": [
                "-",
                ["-", ["get", "height"], UNITS_OUTLINE_BAND_HEIGHT],
                UNITS_OUTLINE_Z_EPS
              ],
              "fill-extrusion-opacity": UNITS_OUTLINE_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "units-fill",
            type: "fill-extrusion",
            source: "units",
            paint: {
              "fill-extrusion-color": [
                "case",
                  ["boolean", ["feature-state", "hover"], false], "#fff7ef",
                  ["match", ["get", "status"],
                    "sold", "#dfd1c4",
                    "reserved", "#f1e3d6",
                    "available", BUILDING_BASE_COLOR,
                    BUILDING_BASE_COLOR
                  ]
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.98,
            }
          });
          map.addLayer({
            id: "street-glass-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass"],
            paint: {
              "fill-extrusion-color": FACADE_GLASS_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": FACADE_GLASS_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-cross-vertical-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-cross-vertical"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-cross-horizontal-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-cross-horizontal"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-beam-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-beam"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-top-beam-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-top-beam"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "terrace-floor-fill",
            type: "fill-extrusion",
            source: "terraces",
            filter: ["==", ["get", "kind"], "terrace-floor"],
            paint: {
              "fill-extrusion-color": TERRACE_FLOOR_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.98,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "terraces-outline-fill",
            type: "fill-extrusion",
            source: "terraces-outline",
            paint: {
              "fill-extrusion-color": UNITS_OUTLINE_COLOR,
              "fill-extrusion-height": ["+", ["get", "height"], UNITS_OUTLINE_Z_EPS],
              "fill-extrusion-base": [
                "-",
                ["-", ["get", "height"], UNITS_OUTLINE_BAND_HEIGHT],
                UNITS_OUTLINE_Z_EPS
              ],
              "fill-extrusion-opacity": UNITS_OUTLINE_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "terrace-rail-fill",
            type: "fill-extrusion",
            source: "terraces",
            filter: ["==", ["get", "kind"], "terrace-rail"],
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "floor"],
                4, TERRACE_GLASS_COLOR,
                6, "#eff4f9"
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": TERRACE_GLASS_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "hover-edge-fill",
            type: "fill-extrusion",
            source: "hover-edge",
            paint: {
              "fill-extrusion-color": "#1eff65",
              "fill-extrusion-height": [
                "+",
                ["get", "height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-base": [
                "+",
                ["get", "min_height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-opacity": 0.65,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "hover-unit-fill",
            type: "fill-extrusion",
            source: "hover-unit",
            paint: {
              "fill-extrusion-color": "#ffe9c8",
              "fill-extrusion-height": [
                "+",
                ["get", "height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-base": [
                "+",
                ["get", "min_height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-opacity": 0.96,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "balcony-rail-fill",
            type: "fill-extrusion",
            source: "balconies",
            filter: ["==", ["get", "kind"], "balcony-rail"],
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "floor"],
                2, BALCONY_GLASS_COLOR,
                4, "#eff5fb"
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": BALCONY_GLASS_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "balcony-post-fill",
            type: "fill-extrusion",
            source: "balconies",
            filter: ["==", ["get", "kind"], "balcony-post"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });

          // Center and zoom closer to the building so facade is visible
          try {
            map.easeTo({ center: cameraCenter as LngLatLike, zoom: 19.1, pitch: 66, bearing: 280, offset: [cameraOffsetXForMap(map), 0] as any, duration: 900, essential: true });
          } catch(e) {}

          } catch (e) {
            console.error('MapboxScene: error during map load:', e);
          }
          setReady(true);
        });
      let lastHoverId: string | null = null;
      const hoverSource = () => map.getSource("hover-unit") as GeoJSONSource | undefined;
      const hoverEdgeSource = () => map.getSource("hover-edge") as GeoJSONSource | undefined;
      let lastBuildingHover = false;
      map.on("mousemove", "units-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features && e.features[0];
        const tip = tipRef.current;
        if (!f || !tip) return;
        tip.style.display = "block";
        tip.style.left = e.point.x + 12 + "px";
        tip.style.top = e.point.y + 12 + "px";
        const fid = (typeof f.id !== 'undefined') ? String(f.id) : (f.properties && f.properties.id ? String(f.properties.id) : null);
        const { floor, status, area, rooms } = f.properties as any;
        tip.textContent = `Кв. ${fid ?? ''} • этаж ${floor} • ${status} • ${area} м² • ${rooms}к`;
        if (fid && lastHoverId !== fid) {
          if (lastHoverId) {
            map.setFeatureState({ source: "units", id: lastHoverId }, { hover: false });
          }
          map.setFeatureState({ source: "units", id: fid }, { hover: true });
          const hs = hoverSource();
          if (hs) {
            const baseMin = Number((f.properties as any)?.min_height ?? 0);
            const baseHeight = Number((f.properties as any)?.height ?? baseMin + FLOOR_HEIGHT_M);
            const faceGeom = scaleGeometry(f.geometry, HOVER_FACE_SCALE) ?? f.geometry;
            const edgeGeom = scaleGeometry(f.geometry, HOVER_EDGE_SCALE) ?? f.geometry;
            hs.setData({
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: faceGeom,
                properties: {
                  min_height: baseMin + HOVER_BASE_LIFT,
                  height: baseHeight - 0.04 + HOVER_BASE_LIFT
                }
              }]
            } as any);
            const es = hoverEdgeSource();
            if (es) {
              es.setData({
                type: "FeatureCollection",
                features: [{
                  type: "Feature",
                  geometry: edgeGeom,
                  properties: {
                    min_height: baseMin + HOVER_BASE_LIFT,
                    height: baseHeight + HOVER_BASE_LIFT
                  }
                }]
              } as any);
            }
          }
          lastHoverId = fid;
        }
        if (!lastBuildingHover) {
          try { map.setFeatureState({ source: "our-footprint", id: "building" }, { hover: true }); } catch {}
          lastBuildingHover = true;
        }
      });
      map.on("mouseleave", "units-fill", () => {
        map.getCanvas().style.cursor = "";
        if (tipRef.current) tipRef.current.style.display = "none";
        if (lastHoverId) {
          map.setFeatureState({ source: "units", id: lastHoverId }, { hover: false });
          const hs = hoverSource();
          if (hs) hs.setData(emptyFeatureCollection as any);
          const es = hoverEdgeSource();
          if (es) es.setData(emptyFeatureCollection as any);
          lastHoverId = null;
        }
        if (lastBuildingHover) {
          try { map.setFeatureState({ source: "our-footprint", id: "building" }, { hover: false }); } catch {}
          lastBuildingHover = false;
        }
      });
      map.on("click", "units-fill", (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const fid = (typeof f.id !== 'undefined') ? String(f.id) : (f.properties && f.properties.id ? String(f.properties.id) : null);
        const { area, rooms } = f.properties as any;
        onPick?.({ id: fid ?? (f.properties && f.properties.id) ?? null, area: Number(area), rooms: Number(rooms) });
      });
    });

    return () => { mapRef.current?.remove(); };
  }, [token, center, onPick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!Array.isArray(footprint) || footprint.length < 3) return;

    const cameraCenter = centroidOfPolygon(footprint);
    const key = `${cameraCenter[0].toFixed(10)},${cameraCenter[1].toFixed(10)}`;
    if (key === lastCameraCenterKey.current) return;
    lastCameraCenterKey.current = key;

    try {
      map.easeTo({
        center: cameraCenter as LngLatLike,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        offset: [cameraOffsetXForMap(map), 0] as any,
        duration: 450,
        essential: true,
      });
    } catch {}
  }, [footprint]);

  // Применение фильтра (available/rooms/floor)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filters: any[] = ["all"]; // базовый фильтр для слоя
    if (filter.onlyAvailable) filters.push(["==", ["get", "status"], "available"]);
    if (filter.rooms) filters.push(["==", ["get", "rooms"], filter.rooms]);
    if (filter.hoverFloor) filters.push(["==", ["get", "floor"], filter.hoverFloor]);
    try {
      map.setFilter("units-fill", filters as any);
    } catch {}
    try {
      map.setFilter("units-outline-floor6-fill", filters as any);
    } catch {}
    try {
      map.setFilter("units-outline-vert-fill", filters as any);
    } catch {}
  }, [filter]);

  if (!token) {
    return (
      <div className="relative w-full max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border bg-surface p-6 text-sm text-muted">
        Добавьте NEXT_PUBLIC_MAPBOX_TOKEN в .env.local, чтобы отобразить карту с окружением.
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border" style={{ height: "68vh" }}>
      <div ref={containerRef} className="w-full h-full" />
      <div ref={tipRef} className="absolute pointer-events-none bg-[#111] text-white text-xs px-2 py-1 rounded" style={{ display: "none" }} />
    </div>
  );
}