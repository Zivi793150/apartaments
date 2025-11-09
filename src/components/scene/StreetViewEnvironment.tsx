"use client";
import * as React from "react";
import { useThree } from "@react-three/fiber";
import { TextureLoader, EquirectangularReflectionMapping, LinearFilter } from "three";

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
        // Улучшаем качество текстуры
        loadedTexture.minFilter = LinearFilter;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.generateMipmaps = false; // Отключаем mipmaps для панорамы
        loadedTexture.anisotropy = 16; // Максимальная анизотропия для лучшего качества
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
  size = "640x640",
  fov = 120
): string {
  // Используем максимальное разрешение и FOV для лучшего качества
  // Для получения панорамы 360° используем несколько запросов с разными heading
  // Но для начала используем один запрос с максимальными параметрами
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=${fov}&heading=0&pitch=0&key=${apiKey}`;
}

/**
 * Получить панораму 360° через несколько запросов (для лучшего качества)
 * Google Street View API ограничен разрешением 640x640 для бесплатного тарифа
 * Для получения полной 360° панорамы нужно сделать несколько запросов с разными heading
 */
export function getGoogleStreetView360Url(
  lat: number,
  lng: number,
  apiKey: string,
  size = "640x640",
  fov = 90
): string[] {
  // Создаем 4 запроса для полной панорамы (север, восток, юг, запад)
  const headings = [0, 90, 180, 270]; // 0=север, 90=восток, 180=юг, 270=запад
  return headings.map(heading => 
    `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${lat},${lng}&fov=${fov}&heading=${heading}&pitch=0&key=${apiKey}`
  );
}

