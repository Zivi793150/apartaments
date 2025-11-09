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
 * Хелпер для получения Google Street View панорамы 360°
 * Требует API ключ Google Maps Platform
 * 
 * Для получения полной 360° панорамы используем максимальный FOV (120)
 * и оптимальное разрешение для веба
 */
export function getGoogleStreetViewUrl(
  lat: number,
  lng: number,
  apiKey: string,
  size = "2048x1024",
  fov = 120, // Максимальный FOV для максимального охвата
  heading = 0, // Направление (0=север, 90=восток, 180=юг, 270=запад)
  pitch = 0 // Угол наклона (-90 до 90)
): string {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=${fov}&heading=${heading}&pitch=${pitch}&key=${apiKey}`;
}

/**
 * Получить координаты здания из адреса или использовать координаты напрямую
 * Для Испании (из скриншота): C. Cam. de Velez, 15, Альгарробо
 */
export function getBuildingCoordinates(address?: string): { lat: number; lng: number } | null {
  // Если адрес не указан, можно использовать координаты напрямую
  // Для примера: Альгарробо, Испания (примерные координаты)
  // В реальности нужно использовать Geocoding API для получения точных координат
  
  if (address) {
    // Здесь можно использовать Google Geocoding API
    // Для демо используем координаты Альгарробо, Испания
    return { lat: 36.7731, lng: -4.0396 };
  }
  
  return null;
}

