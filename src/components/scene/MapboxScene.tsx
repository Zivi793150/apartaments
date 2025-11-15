"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, LngLatLike, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapboxPickedUnit = { id: string; area: number; rooms: number } | null;
export type MapboxSceneFilter = {
  activeBuilding: "all" | "a" | "b";
  rooms?: 1 | 2 | 3 | 4 | null;
  onlyAvailable?: boolean;
  hoverFloor?: number | null;
};

// Простая генерация плана квартир (пример). Позже можно заменить данными из public/plans
const FLOORS = 6;
const FLOOR_HEIGHT_M = 3.1; // метр высоты
const UNITS_PER_FLOOR = 4;

type Unit = { id: string; floor: number; status: "available" | "reserved" | "sold"; area: number; rooms: number; polyUV: [number, number][] };

function generateUnitsPlan(): Unit[] {
  const units: Unit[] = [];
  for (let f = 1; f <= FLOORS; f++) {
    for (let i = 0; i < UNITS_PER_FLOOR; i++) {
      const id = `A-${f}-${i + 1}`;
      const status: Unit["status"] = ((f * (i + 1)) % 5 === 0) ? "reserved" : ((f + i) % 7 === 0 ? "sold" : "available");
      const area = 35 + i * 3 + f * 1.2;
      const rooms = (i % 3) + 1 as 1 | 2 | 3;
      // делим прямоугольник этажа на 4 равных секции (UV 0..1)
      const x0 = i * 0.25, x1 = (i + 1) * 0.25;
      const polyUV: [number, number][] = [ [x0 + 0.02, 0.1], [x1 - 0.02, 0.1], [x1 - 0.02, 0.9], [x0 + 0.02, 0.9] ];
      units.push({ id, floor: f, status, area: Number(area.toFixed(1)), rooms, polyUV });
    }
  }
  return units;
}

// Билинейная проекция UV -> lngLat на четырехугольник (контур здания)
function uvToLngLat(uv: [number, number], quad: [number, number][]) {
  const [u, v] = uv;
  const [A, B, C, D] = quad; // по часовой
  const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] as [number, number];
  const E = lerp(A, D, v);
  const F = lerp(B, C, v);
  return lerp(E, F, u) as [number, number];
}

function makeUnitsFeatureCollection(quad: [number, number][], units: Unit[]) {
  return {
    type: "FeatureCollection",
    features: units.map(u => {
      const ring = u.polyUV.map(p => uvToLngLat(p, quad));
      ring.push(ring[0]);
      const min_h = u.floor * FLOOR_HEIGHT_M;
      const h = min_h + 0.25;
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

  // Координаты здания (Camino de Vélez 15, Algarrobo) — можно задать через .env
  const center = useMemo<[number, number]>(() => {
    const lat = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LAT || "36.7696");
    const lng = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LNG || "-4.0387");
    return [lng, lat];
  }, []);

  // Прямоугольный контур вокруг центра (~20м x 12м)
  const footprint = useMemo<[number, number][]>(() => {
    const [lng, lat] = center;
    // градусы в метры грубо: 1e-4 ~ 11м по широте; по долготе умножаем на cos(lat)
    const dx = 0.00009 * Math.cos(lat * Math.PI / 180);
    const dy = 0.00006;
    return [
      [lng - dx, lat + dy],
      [lng + dx, lat + dy],
      [lng + dx * 0.95, lat - dy],
      [lng - dx * 0.95, lat - dy],
    ];
  }, [center]);

  const units = useMemo(() => generateUnitsPlan(), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: center as LngLatLike,
      zoom: 17.6,
      pitch: 60,
      bearing: -20,
      antialias: true,
      cooperativeGestures: true,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Наш дом
      const polygonCoords = [...footprint, footprint[0]];
      map.addSource("our-footprint", { type: "geojson", data: { type: "Feature", properties: { floors: FLOORS }, geometry: { type: "Polygon", coordinates: [polygonCoords] } } });
      map.addLayer({ id: "our-bldg", type: "fill-extrusion", source: "our-footprint", paint: { "fill-extrusion-color": "#EAECEF", "fill-extrusion-height": ["*", ["get", "floors"], FLOOR_HEIGHT_M], "fill-extrusion-opacity": 0.9 } });

      // Квартиры
      const fc = makeUnitsFeatureCollection(footprint as any, units);
      map.addSource("units", { type: "geojson", data: fc });
      map.addLayer({
        id: "units-fill",
        type: "fill-extrusion",
        source: "units",
        paint: {
          "fill-extrusion-color": [
            "match", ["get", "status"],
            "sold", "#b8b8b8",
            "reserved", "#ffcd3c",
            "available", "#4fea98",
            "#4fea98"
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.7,
        }
      });
      map.addLayer({ id: "units-outline", type: "line", source: "units", paint: { "line-color": "#2b2b2b", "line-width": 0.8 } });

      // Hover/tooltip
      map.on("mousemove", "units-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features && e.features[0];
        const tip = tipRef.current;
        if (!f || !tip) return;
        tip.style.display = "block";
        tip.style.left = e.point.x + 12 + "px";
        tip.style.top = e.point.y + 12 + "px";
        const { id, floor, status, area, rooms } = f.properties as any;
        tip.textContent = `Кв. ${id} • этаж ${floor} • ${status} • ${area} м² • ${rooms}к`;
      });
      map.on("mouseleave", "units-fill", () => {
        map.getCanvas().style.cursor = "";
        if (tipRef.current) tipRef.current.style.display = "none";
      });
      map.on("click", "units-fill", (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const { id, area, rooms } = f.properties as any;
        onPick?.({ id, area: Number(area), rooms: Number(rooms) });
      });

      setReady(true);
    });

    return () => { map.remove(); };
  }, [token, center, footprint, units, onPick]);

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
      map.setFilter("units-outline", filters as any);
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