"use client";
import * as React from "react";
import { useEffect, useRef } from "react";

/**
 * Компонент для интеграции Mapbox 3D карты как окружения
 * 
 * Требования:
 * 1. Установить: npm install mapbox-gl
 * 2. Получить API ключ на mapbox.com
 * 3. Добавить стили: import 'mapbox-gl/dist/mapbox-gl.css'
 * 
 * Использование:
 * <MapboxEnvironment 
 *   mapboxToken="YOUR_TOKEN"
 *   lat={50.4501}
 *   lng={30.5234}
 *   zoom={18}
 *   pitch={60}
 *   bearing={0}
 * />
 */
export default function MapboxEnvironment({
  mapboxToken,
  lat,
  lng,
  zoom = 18,
  pitch = 60,
  bearing = 0,
  style = "mapbox://styles/mapbox/satellite-streets-v12",
  containerClassName = "absolute inset-0 z-0"
}: {
  mapboxToken: string;
  lat: number;
  lng: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  style?: string;
  containerClassName?: string;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Динамический импорт mapbox-gl (опционально, чтобы не загружать если не используется)
    import("mapbox-gl").then((mapboxgl) => {
      if (!mapContainer.current) return;

      (mapboxgl as any).accessToken = mapboxToken;

      const map = new (mapboxgl as any).Map({
        container: mapContainer.current,
        style: style,
        center: [lng, lat],
        zoom: zoom,
        pitch: pitch,
        bearing: bearing,
        antialias: true,
        // Включить 3D здания
        building3D: true,
      });

      // Включить 3D здания
      map.on("load", () => {
        map.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.6,
          },
        });
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    });
  }, [mapboxToken, lat, lng, zoom, pitch, bearing, style]);

  return (
    <div ref={mapContainer} className={containerClassName} style={{ width: "100%", height: "100%" }} />
  );
}

