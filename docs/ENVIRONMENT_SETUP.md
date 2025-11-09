# Настройка окружения для 3D сцены

Есть несколько способов добавить реалистичное окружение (улицы, здания, виды) без ручного моделирования:

## Вариант 1: Панорамные изображения 360° (Рекомендуется)

### Использование Google Street View

1. Получите API ключ на [Google Cloud Console](https://console.cloud.google.com/)
2. Включите "Street View Static API"
3. Используйте компонент `StreetViewEnvironment`:

```tsx
import StreetViewEnvironment, { getGoogleStreetViewUrl } from "@/components/scene/StreetViewEnvironment";

// В BuildingScene3D.tsx:
<StreetViewEnvironment 
  panoramaUrl={getGoogleStreetViewUrl(
    50.4501, // широта
    30.5234, // долгота
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    "2048x1024",
    90
  )}
/>
```

### Использование собственных 360° фотографий

Поместите панорамные изображения в `public/panoramas/` и используйте:

```tsx
<StreetViewEnvironment panoramaUrl="/panoramas/street-view.jpg" />
```

**Где взять 360° фото:**
- Сделать самостоятельно (камера 360° или телефон)
- [Poly Haven](https://polyhaven.com/hdris) - бесплатные HDR панорамы
- [Sketchfab](https://sketchfab.com/) - 3D модели и панорамы

## Вариант 2: Mapbox 3D карты (Альтернатива)

Mapbox можно использовать как альтернативу Google Street View, но требует установки дополнительных зависимостей.

**Примечание:** Для использования Mapbox нужно установить `mapbox-gl` и создать собственный компонент интеграции. Основной функционал работает с Google Street View API.

## Вариант 3: Готовые 3D модели окружения

### Загрузка GLTF/GLB моделей

1. Найдите модели на:
   - [Sketchfab](https://sketchfab.com/) - фильтр "Downloadable"
   - [Poly Haven](https://polyhaven.com/models)
   - [TurboSquid](https://www.turbosquid.com/)

2. Поместите в `public/models/environment/`

3. Загрузите в сцену:

```tsx
import { useGLTF } from "@react-three/drei";

function EnvironmentModel() {
  const { scene } = useGLTF("/models/environment/street.glb");
  return <primitive object={scene} scale={1} position={[0, 0, 0]} />;
}

// В BuildingScene3D:
<EnvironmentModel />
```

## Вариант 4: Google Maps Platform (Aerial View)

Google Maps Platform предоставляет Aerial View API для получения 3D обзоров местности.

1. Получите API ключ
2. Используйте API для получения изображений
3. Интегрируйте как текстуры в Three.js

**Документация:** https://developers.google.com/maps/documentation/aerial-view

## Рекомендации

**Для быстрого старта:** Используйте Вариант 1 (панорамные изображения)
- Проще всего настроить
- Не требует сложной интеграции
- Хорошо выглядит

**Для максимального реализма:** Используйте Вариант 2 (Mapbox)
- Реальные данные
- 3D здания автоматически
- Интерактивность

**Для полного контроля:** Используйте Вариант 3 (готовые модели)
- Полный контроль над сценой
- Можно кастомизировать
- Требует больше работы

## Переменные окружения

Добавьте в `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_api_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

