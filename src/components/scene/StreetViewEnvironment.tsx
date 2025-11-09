"use client";
import * as React from "react";
import { useThree } from "@react-three/fiber";
import { TextureLoader, EquirectangularReflectionMapping } from "three";

/**
 * Компонент для отображения панорамного окружения (360° фото)
 * Можно использовать:
 * 1. Google Street View панорамы
 * 2. Собственные 360° фотографии
 * 3. Готовые панорамы из Poly Haven или других источников
 */
export default function StreetViewEnvironment({ 
  panoramaUrl
}: { 
  panoramaUrl: string;
}) {
  const { scene } = useThree();
  const textureRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!panoramaUrl) return;

    const loader = new TextureLoader();
    loader.load(
      panoramaUrl,
      (loadedTexture) => {
        // Настройка текстуры для панорамы (equirectangular mapping)
        loadedTexture.mapping = EquirectangularReflectionMapping;
        scene.background = loadedTexture;
        textureRef.current = loadedTexture;
      },
      undefined,
      (error) => {
        console.warn("Failed to load panorama:", error);
      }
    );

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        scene.background = null;
      }
    };
  }, [panoramaUrl, scene]);

  return null; // Компонент только устанавливает фон сцены
}

/**
 * Хелпер для получения Google Street View панорамы
 * Требует API ключ Google Maps Platform
 */
export function getGoogleStreetViewUrl(
  lat: number,
  lng: number,
  apiKey: string,
  size = "2048x1024",
  fov = 90
): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=${fov}&heading=0&pitch=0&key=${apiKey}`;
}

