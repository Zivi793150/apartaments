"use client";
import * as React from "react";
import { useThree } from "@react-three/fiber";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { PMREMGenerator, EquirectangularReflectionMapping } from "three";

/**
 * Компонент для загрузки HDRI панорам из Poly Haven
 * 
 * Poly Haven предоставляет бесплатные HDRI панорамы высокого качества:
 * https://polyhaven.com/hdris
 * 
 * Использование:
 * 1. Скачайте HDRI с polyhaven.com (формат .hdr или .exr)
 * 2. Поместите в public/hdris/
 * 3. Используйте компонент:
 * 
 * <PolyHavenEnvironment hdriUrl="/hdris/city_street_4k.hdr" />
 * 
 * Или используйте прямую ссылку на Poly Haven CDN:
 * <PolyHavenEnvironment hdriUrl="https://dl.polyhaven.org/file/ph-hdri/hdr/4k/city_street_4k.hdr" />
 */
export default function PolyHavenEnvironment({ 
  hdriUrl,
  intensity = 1.0,
  useAsBackground = true,
  useAsEnvironment = true
}: { 
  hdriUrl: string;
  intensity?: number;
  useAsBackground?: boolean;
  useAsEnvironment?: boolean;
}) {
  const { scene, gl } = useThree();
  const textureRef = React.useRef<any>(null);
  const pmremGeneratorRef = React.useRef<PMREMGenerator | null>(null);

  React.useEffect(() => {
    if (!hdriUrl) return;

    // Создаём PMREM генератор для конвертации HDRI в environment map
    if (!pmremGeneratorRef.current) {
      pmremGeneratorRef.current = new PMREMGenerator(gl);
      pmremGeneratorRef.current.compileEquirectangularShader();
    }

    const loader = new RGBELoader();
    
    loader.load(
      hdriUrl,
      (texture) => {
        // Настройка текстуры для панорамы
        texture.mapping = EquirectangularReflectionMapping;
        
        // Генерируем environment map для реалистичного освещения
        if (useAsEnvironment && pmremGeneratorRef.current) {
          const envMap = pmremGeneratorRef.current.fromEquirectangular(texture).texture;
          scene.environment = envMap;
          scene.environmentIntensity = intensity;
        }

        // Устанавливаем как фон сцены (если нужно)
        if (useAsBackground) {
          scene.background = texture;
          scene.backgroundIntensity = intensity;
        }

        textureRef.current = texture;
      },
      undefined,
      (error) => {
        console.error("Failed to load HDRI:", error);
        console.warn("Убедитесь, что файл .hdr или .exr находится в public/hdris/ или используйте прямую ссылку на Poly Haven CDN");
      }
    );

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        if (useAsBackground) {
          scene.background = null;
        }
        if (useAsEnvironment) {
          scene.environment = null;
        }
      }
      if (pmremGeneratorRef.current) {
        pmremGeneratorRef.current.dispose();
        pmremGeneratorRef.current = null;
      }
    };
  }, [hdriUrl, scene, gl, intensity, useAsBackground, useAsEnvironment]);

  return null;
}

/**
 * Хелпер для получения URL HDRI из Poly Haven CDN
 * 
 * @param name - название HDRI (например: "city_street", "sunset", "studio")
 * @param resolution - разрешение: "1k", "2k", "4k", "8k" (по умолчанию "4k")
 * @returns URL для загрузки HDRI
 */
export function getPolyHavenHDRIUrl(
  name: string,
  resolution: "1k" | "2k" | "4k" | "8k" = "4k"
): string {
  return `https://dl.polyhaven.org/file/ph-hdri/hdr/${resolution}/${name}_${resolution}.hdr`;
}

/**
 * Популярные HDRI из Poly Haven для городских сцен
 */
export const POLYHAVEN_CITY_HDRI = {
  cityStreet: "city_street",
  cityNight: "city_night",
  citySunset: "city_sunset",
  urbanStreet: "urban_street",
  downtown: "downtown",
  cityPark: "city_park",
  streetDay: "street_day",
  streetNight: "street_night",
} as const;

/**
 * Популярные HDRI из Poly Haven для природных сцен
 */
export const POLYHAVEN_NATURE_HDRI = {
  forest: "forest",
  mountain: "mountain",
  beach: "beach",
  sunset: "sunset",
  clearSky: "clear_sky",
  cloudy: "cloudy",
} as const;

