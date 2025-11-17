"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import mapboxgl, { Map, LngLatLike, GeoJSONSource, MapboxGeoJSONFeature } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info, MapPin } from "lucide-react";

export type Spain3DPickedUnit = { id: string; area: number; rooms: number; floor: number; status: string } | null;

export type Spain3DSceneFilter = {
  activeBuilding?: "a" | "b";
  rooms?: 1 | 2 | 3 | 4 | null;
  onlyAvailable?: boolean;
  hoverFloor?: number | null;
};

interface ApartmentData {
  id: string;
  floor: number;
  unit: number;
  status: "available" | "reserved" | "sold";
  area: number;
  rooms: number;
  price?: number;
  description?: string;
}

const FLOORS = 6;
const FLOOR_HEIGHT_M = 3.2; // высота одного этажа в метрах
const UNITS_PER_FLOOR = 4;

// Генерация данных квартир
function generateApartmentData(): ApartmentData[] {
  const apartments: ApartmentData[] = [];
  for (let f = 1; f <= FLOORS; f++) {
    for (let u = 1; u <= UNITS_PER_FLOOR; u++) {
      const id = `A-${f}-${u}`;
      const statusOptions: ApartmentData["status"][] = ["available", "reserved", "sold"];
      const status = statusOptions[((f * u) % 3)];
      const baseArea = 55 + u * 15 + (f % 2) * 10;
      const rooms = ((u - 1) % 3) + 1 as 1 | 2 | 3;
      const basePrice = baseArea * 3500; // условная цена за м²
      
      apartments.push({
        id,
        floor: f,
        unit: u,
        status,
        area: Number(baseArea.toFixed(1)),
        rooms,
        price: basePrice,
        description: `${rooms}-комнатная квартира на ${f} этаже`
      });
    }
  }
  return apartments;
}

// Отображение квартиры на фасаде здания
function getApartmentPosition(floor: number, unit: number, buildingWidth: number, buildingHeight: number) {
  const unitWidth = buildingWidth / UNITS_PER_FLOOR;
  const floorHeight = buildingHeight / FLOORS;
  
  return {
    x: unit * unitWidth - unitWidth / 2,
    y: floor * floorHeight - floorHeight / 2,
    width: unitWidth * 0.8,
    height: floorHeight * 0.8,
  };
}

// SVG эффект выделения квартиры
function ApartmentHighlight({ 
  apartment, 
  buildingWidth, 
  buildingHeight,
  isHovered,
  isSelected 
}: {
  apartment: ApartmentData;
  buildingWidth: number;
  buildingHeight: number;
  isHovered: boolean;
  isSelected: boolean;
}) {
  const pos = getApartmentPosition(apartment.floor, apartment.unit, buildingWidth, buildingHeight);
  
  const getColor = () => {
    if (isSelected) return "#FF6A2B";
    if (isHovered) return "#FFC7A8";
    
    switch (apartment.status) {
      case "available": return "#4fea98";
      case "reserved": return "#ffcd3c";
      case "sold": return "#b8b8b8";
      default: return "#999";
    }
  };

  return (
    <motion.rect
      x={pos.x - pos.width / 2}
      y={buildingHeight - pos.y - pos.height / 2}
      width={pos.width}
      height={pos.height}
      fill={getColor()}
      opacity={isHovered || isSelected ? 0.9 : 0.6}
      stroke={isHovered || isSelected ? "#fff" : "none"}
      strokeWidth={2}
      rx={4}
      animate={{
        opacity: isHovered || isSelected ? 0.95 : 0.65,
        boxShadow: isHovered || isSelected ? "0 0 20px rgba(255, 106, 43, 0.5)" : "none"
      }}
      transition={{ duration: 0.2 }}
    />
  );
}

interface SpainBuilding3DProps {
  center?: [number, number];
  footprint?: [number, number][];
  onPick?: (unit: Spain3DPickedUnit) => void;
  filter?: Spain3DSceneFilter;
  showInfo?: boolean;
  // Optional per-apartment polygon coordinates (lng, lat) to position apartments exactly according to plans/photo
  apartmentCoords?: Record<string, [number, number][]>
  // Optional normalized apartment polygons relative to building bbox ([0..1] coordinates)
  apartmentCoordsNormalized?: Record<string, [number, number][]>
}

export default function SpainBuilding3D({
  center,
  footprint,
  onPick,
  filter = {},
  showInfo = true,
  apartmentCoords,
  apartmentCoordsNormalized,
}: SpainBuilding3DProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const rotationRef = useRef<{ bearing: number; targetBearing: number }>({ bearing: 0, targetBearing: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const [hoveredApt, setHoveredApt] = useState<string | null>(null);
  const [selectedApt, setSelectedApt] = useState<Spain3DPickedUnit>(null);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [ready, setReady] = useState(false);

  // Координаты здания (Испания, по умолчанию Алгарробо)
  const defaultCenter = useMemo<[number, number]>(() => {
    const lat = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LAT || "36.7696");
    const lng = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LNG || "-4.0387");
    return [lng, lat];
  }, []);

  const finalCenter = center || defaultCenter;

  // Контур здания
  const finalFootprint = useMemo<[number, number][]>(() => {
    if (footprint) return footprint;
    
    const [lng, lat] = finalCenter;
    const dx = 0.00009 * Math.cos(lat * Math.PI / 180);
    const dy = 0.00006;
    return [
      [lng - dx, lat + dy],
      [lng + dx, lat + dy],
      [lng + dx * 0.95, lat - dy],
      [lng - dx * 0.95, lat - dy],
    ];
  }, [finalCenter, footprint]);

  const apartments = useMemo(() => generateApartmentData(), []);

  // Функция для вращения карты на 360°
  const rotate360 = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentBearing = map.getBearing();
    const targetBearing = currentBearing + 360;

    let startTime: number | null = null;
    const duration = 20000; // 20 секунд на полный оборот

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;
      const newBearing = (currentBearing + progress * 360) % 360;

      map.setBearing(newBearing);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Инициализация Mapbox
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: finalCenter as LngLatLike,
      zoom: 17.8,
      pitch: 65,
      bearing: 0,
      antialias: true,
      cooperativeGestures: true,
      trackResize: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Добавляем 3D terrain
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

      // Добавляем собственный контур здания с высотой
      const polygonCoords = [...finalFootprint, finalFootprint[0]];
      const buildingHeight = FLOORS * FLOOR_HEIGHT_M;

      map.addSource("our-footprint", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { name: "Наше здание" },
          geometry: {
            type: "Polygon",
            coordinates: [polygonCoords],
          },
        } as GeoJSON.Feature,
      });

      // Подсветка/хало под зданием (чтобы дом визуально выделялся)
      map.addLayer(
        {
          id: "our-bldg-boost",
          type: "fill-extrusion",
          source: "our-footprint",
          paint: {
            "fill-extrusion-color": "#FFDDBB",
            // немного выше, чтобы создать эффект свечения по краям
            "fill-extrusion-height": buildingHeight * 1.03,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.22,
          },
        },
        "waterway-label"
      );

      // Слой здания (главный, более контрастный)
      map.addLayer(
        {
          id: "our-bldg",
          type: "fill-extrusion",
          source: "our-footprint",
          paint: {
            "fill-extrusion-color": "#F2C57C",
            "fill-extrusion-height": buildingHeight,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.98,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        "waterway-label"
      );

      // Квартиры как отдельные элементы
      const apartmentsGeoJSON = makeApartmentsGeoJSON(finalFootprint, apartments, apartmentCoords, apartmentCoordsNormalized);
      // If the component was given exact apartment coordinates, use them (we pass prop below after it's available)
      // (we'll replace the source data further down if a real prop is provided)
      map.addSource("apartments", {
        type: "geojson",
        data: apartmentsGeoJSON,
      });

      // Слой квартир (чуть приглушены, чтобы дом был в фокусе)
      map.addLayer(
        {
          id: "apartments-fill",
          type: "fill-extrusion",
          source: "apartments",
          paint: {
            "fill-extrusion-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              "#FF6A2B",
              ["boolean", ["feature-state", "selected"], false],
              "#FF8C5A",
              [
                "match",
                ["get", "status"],
                "sold",
                "#b8b8b8",
                "reserved",
                "#ffcd3c",
                "available",
                "#4fea98",
                "#999",
              ],
            ],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.98,
              0.6,
            ],
          },
        },
        "our-bldg"
      );

      // Центрируем и подгоняем камеру по границам контура здания
      try {
        const lats = polygonCoords.map((p) => p[1]);
        const lngs = polygonCoords.map((p) => p[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 120, maxZoom: 19, duration: 900, linear: false });
      } catch (e) {
        try {
          map.easeTo({ center: finalCenter as LngLatLike, zoom: 18.2, pitch: 70, bearing: 0, duration: 1600, essential: true });
        } catch (err) {
          console.warn("Focus failed:", err);
        }
      }

      // Обводка квартир
      map.addLayer({
        id: "apartments-outline",
        type: "line",
        source: "apartments",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#fff",
            "rgba(0,0,0,0.3)",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            2,
            1,
          ],
        },
      });

      // Hover эффект
      let hoveredFeatureId: string | number | undefined;

      map.on("mousemove", "apartments-fill", (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        map.getCanvas().style.cursor = "pointer";

        if (e.features && e.features.length > 0) {
          const f = e.features[0] as MapboxGeoJSONFeature;
          const apartmentId = f.properties?.id as string;

          if (hoveredFeatureId !== undefined) {
            map.setFeatureState({ source: "apartments", id: hoveredFeatureId } as any, { hover: false });
          }

          hoveredFeatureId = f.id;
          map.setFeatureState({ source: "apartments", id: hoveredFeatureId } as any, { hover: true });
          setHoveredApt(apartmentId);
        }
      });

      map.on("mouseleave", "apartments-fill", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredFeatureId !== undefined) {
          map.setFeatureState({ source: "apartments", id: hoveredFeatureId } as any, { hover: false });
        }
        hoveredFeatureId = undefined;
        setHoveredApt(null);
      });

      // Click для выбора квартиры
      map.on("click", "apartments-fill", (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (e.features && e.features.length > 0) {
          const f = e.features[0] as MapboxGeoJSONFeature;
          const { id, area, rooms, status, floor } = f.properties as any;
          setSelectedApt({ id, area: Number(area), rooms: Number(rooms), status, floor: Number(floor) });
          onPick?.({ id, area: Number(area), rooms: Number(rooms), status, floor: Number(floor) });
          setShowDetails(true);
        }
      });

      // Stop auto-rotate when user interacts on touch or mouse down (better mobile UX)
      map.on("touchstart", () => {
        if (isAutoRotating) {
          setIsAutoRotating(false);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
      });
      map.on("mousedown", () => {
        if (isAutoRotating) {
          setIsAutoRotating(false);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
      });

      // Начинаем вращение
      rotate360();
      setReady(true);
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map.remove();
    };
  }, [token, finalCenter, finalFootprint, apartments, rotate360, onPick]);

  // Применение фильтра
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const filters: any[] = ["all"];
    if (filter.onlyAvailable) {
      filters.push(["==", ["get", "status"], "available"]);
    }
    if (filter.rooms) {
      filters.push(["==", ["get", "rooms"], filter.rooms]);
    }
    if (filter.hoverFloor) {
      filters.push(["==", ["get", "floor"], filter.hoverFloor]);
    }

    try {
      map.setFilter("apartments-fill", filters as any);
      map.setFilter("apartments-outline", filters as any);
    } catch (e) {
      console.warn("Filter error:", e);
    }
  }, [filter]);

  const handleRotateToggle = () => {
    setIsAutoRotating(!isAutoRotating);
    if (!isAutoRotating) {
      rotate360();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  if (!token) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden ring-1 ring-border bg-surface p-8 text-center">
        <div className="flex items-center justify-center gap-2 text-muted mb-2">
          <Info size={20} />
          <p className="text-sm font-semibold">Требуется конфигурация</p>
        </div>
        <p className="text-xs text-muted">
          Добавьте <code className="bg-black/10 px-2 py-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> в <code className="bg-black/10 px-2 py-1 rounded text-xs">.env.local</code>
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden ring-1 ring-border/50 bg-black" style={{ height: "70vh", minHeight: "500px" }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute sm:top-4 top-auto sm:left-4 left-1/2 sm:transform-none -translate-x-1/2 bottom-4 md:top-6 md:left-6 flex flex-col gap-3 z-20"
        style={{ pointerEvents: "auto" }}
      >
        <motion.button
          onClick={handleRotateToggle}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all backdrop-blur-md ring-1 text-center ${
            isAutoRotating
              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white ring-orange-400/50"
              : "bg-white/20 text-white ring-white/30 hover:bg-white/30"
          }`}
        >
          {isAutoRotating ? "🔄 Вращение" : "⏸ Остановить"}
        </motion.button>

        <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 ring-1 ring-white/20 max-w-xs">
          <div className="flex items-center gap-2 text-white text-xs font-semibold mb-1">
            <MapPin size={14} />
            <span>Испания, Алгарробо</span>
          </div>
          <p className="text-white/70 text-xs">Наведите на квартиру для подробной информации</p>
        </div>
      </motion.div>

      {/* Apartment info panel */}
      <AnimatePresence>
        {hoveredApt && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 max-w-xs z-20"
          >
            {apartments.find((a) => a.id === hoveredApt) && (
              <>
                <h3 className="font-bold text-lg text-gray-900 mb-1">
                  {hoveredApt}
                </h3>
                {apartments.find((a) => a.id === hoveredApt)?.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {apartments.find((a) => a.id === hoveredApt)?.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p className="text-xs text-gray-600">Площадь</p>
                    <p className="font-bold text-gray-900">
                      {apartments.find((a) => a.id === hoveredApt)?.area} м²
                    </p>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p className="text-xs text-gray-600">Комнаты</p>
                    <p className="font-bold text-gray-900">
                      {apartments.find((a) => a.id === hoveredApt)?.rooms}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    apartments.find((a) => a.id === hoveredApt)?.status === "available"
                      ? "bg-green-100 text-green-700"
                      : apartments.find((a) => a.id === hoveredApt)?.status === "reserved"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {apartments.find((a) => a.id === hoveredApt)?.status === "available"
                      ? "Свободна"
                      : apartments.find((a) => a.id === hoveredApt)?.status === "reserved"
                      ? "Зарезервирована"
                      : "Продана"}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const apt = apartments.find((a) => a.id === hoveredApt);
                      if (apt) {
                        setSelectedApt({
                          id: apt.id,
                          area: apt.area,
                          rooms: apt.rooms,
                          status: apt.status,
                          floor: apt.floor,
                        });
                        setShowDetails(true);
                      }
                    }}
                    className="text-orange-600 hover:text-orange-700 font-semibold text-xs"
                  >
                    Подробно →
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected apartment details */}
      <AnimatePresence>
        {showDetails && selectedApt && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-4 md:inset-auto md:bottom-6 md:right-6 md:max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-30"
          >
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-white">
              <h2 className="text-2xl font-bold mb-1">Квартира {selectedApt.id}</h2>
              <p className="text-orange-100">Этаж {selectedApt.floor}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Площадь</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedApt.area}</p>
                  <p className="text-xs text-gray-600">м²</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Комнаты</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedApt.rooms}</p>
                  <p className="text-xs text-gray-600">комнат</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Статус</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedApt.status === "available"
                    ? "bg-green-100 text-green-700"
                    : selectedApt.status === "reserved"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {selectedApt.status === "available"
                    ? "✓ Свободна"
                    : selectedApt.status === "reserved"
                    ? "○ Зарезервирована"
                    : "✕ Продана"}
                </span>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper: создание GeoJSON для квартир
function makeApartmentsGeoJSON(
  footprint: [number, number][],
  apartments: ApartmentData[],
  apartmentCoords?: Record<string, [number, number][]>,
  apartmentCoordsNormalized?: Record<string, [number, number][]>
): GeoJSON.FeatureCollection {
  const FLOOR_HEIGHT_M = 3.2;
  
  return {
    type: "FeatureCollection",
    features: apartments.map((apt, idx) => {
      // Распределяем квартиры по фасаду здания
      const [lng, lat] = footprint[0];
      const [lngEnd, latEnd] = footprint[2];
      
      // If explicit coordinates were provided for this apartment (lng/lat), use them
      const explicit = apartmentCoords && apartmentCoords[apt.id];
      // If normalized coordinates were provided instead, convert to lng/lat
      const explicitNorm = apartmentCoordsNormalized && apartmentCoordsNormalized[apt.id];

      let explicitConverted: [number, number][] | undefined = undefined;
      if (explicitNorm && explicitNorm.length > 0) {
        // convert normalized [x,y] in [0..1] to lng/lat using footprint bbox
        const lats = footprint.map((p) => p[1]);
        const lngs = footprint.map((p) => p[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        explicitConverted = explicitNorm.map(([nx, ny]) => {
          const lng = minLng + nx * (maxLng - minLng);
          const lat = minLat + ny * (maxLat - minLat);
          return [lng, lat];
        });
      }

      const minHeight = (apt.floor - 1) * FLOOR_HEIGHT_M;
      const height = FLOOR_HEIGHT_M * 0.8;

      const useExplicit = explicit && explicit.length > 0 ? explicit : explicitConverted && explicitConverted.length > 0 ? explicitConverted : undefined;

      if (useExplicit) {
        return {
          type: "Feature",
          id: idx,
          properties: {
            id: apt.id,
            floor: apt.floor,
            unit: apt.unit,
            status: apt.status,
            area: apt.area,
            rooms: apt.rooms,
            price: apt.price,
            min_height: minHeight,
            height: minHeight + height,
          },
          geometry: {
            type: "Polygon",
            coordinates: [useExplicit],
          },
        } as GeoJSON.Feature;
      }

      const unitX = (apt.unit - 1) / UNITS_PER_FLOOR;
      const apartmentLng = lng + (lngEnd - lng) * unitX;
      const apartmentLat = lat;
      const size = 0.00003;

      return {
        type: "Feature",
        id: idx,
        properties: {
          id: apt.id,
          floor: apt.floor,
          unit: apt.unit,
          status: apt.status,
          area: apt.area,
          rooms: apt.rooms,
          price: apt.price,
          min_height: minHeight,
          height: minHeight + height,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [apartmentLng - size, apartmentLat + size],
              [apartmentLng + size, apartmentLat + size],
              [apartmentLng + size, apartmentLat - size],
              [apartmentLng - size, apartmentLat - size],
              [apartmentLng - size, apartmentLat + size],
            ],
          ],
        },
      } as GeoJSON.Feature;
    }),
  };
}
