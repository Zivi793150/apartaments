# Настройка 3D сцены здания в Испании

## Обзор

Компонент `SpainBuildingScene3D` создан для отображения интерактивной 3D сцены здания в Испании с возможностью:
- Вращения на 360°
- Подсветки квартир при наведении
- Использования готовой 3D модели от дизайнера
- Интеграции с планами квартир

## Варианты реализации

### Вариант 1: Использование готовой GLB модели (Рекомендуется)

**Преимущества:**
- ✅ Не требует моделирования через код
- ✅ Использует готовую модель от дизайнера
- ✅ Высокое качество визуализации
- ✅ Поддержка текстур и материалов

**Требования:**
1. Модель должна быть в формате GLB или GLTF
2. Квартиры должны быть названы в модели (например: `apartment_1_1`, `apartment_2_3`)
3. Модель должна быть размещена в `public/models/building.glb`

**Настройка:**
```tsx
import SpainBuildingScene3D from "@/components/scene/SpainBuildingScene3D";

// Использование
<SpainBuildingScene3D
  apartments={apartmentsConfig}
  coordinates={{ lat: 36.7731, lng: -4.0396 }}
  address="C. Cam. de Velez, 15, Альгарробо"
  onPick={(unit) => console.log("Selected:", unit)}
/>
```

### Вариант 2: Использование панорамного окружения

**Для реалистичного окружения можно использовать:**

1. **Google Street View панорамы:**
```tsx
import { getGoogleStreetViewUrl } from "@/components/scene/StreetViewEnvironment";

const panoramaUrl = getGoogleStreetViewUrl(
  36.7731, // lat
  -4.0396, // lng
  "YOUR_GOOGLE_API_KEY",
  "2048x1024",
  120, // FOV
  0,   // heading
  0    // pitch
);

<SpainBuildingScene3D
  usePanorama={true}
  panoramaUrl={panoramaUrl}
  // ...
/>
```

2. **Собственные 360° фотографии:**
   - Разместите в `public/images/panoramas/`
   - Используйте equirectangular формат
   - Укажите путь в `panoramaUrl`

3. **Готовые панорамы:**
   - [Poly Haven](https://polyhaven.com/hdris) - бесплатные HDR панорамы
   - [HDRI Haven](https://hdrihaven.com/) - высококачественные панорамы

### Вариант 3: Конфигурация квартир

**Структура конфигурации:**
```typescript
interface ApartmentConfig {
  id: string;              // Уникальный ID (например: "66-A001")
  name: string;            // Отображаемое имя
  area: number;            // Площадь в м²
  rooms: number;           // Количество комнат
  floor: number;           // Этаж
  available: boolean;      // Доступна ли квартира
  meshName?: string;       // Имя меша в модели (например: "apartment_1_1")
  position?: [number, number, number]; // Позиция вручную (если не указан meshName)
  bbox?: {                 // Границы для raycasting (если не указан meshName)
    min: [number, number, number];
    max: [number, number, number];
  };
}
```

**Пример конфигурации:**
```typescript
const apartments: ApartmentConfig[] = [
  {
    id: "66-A001",
    name: "Flat 66-A001",
    area: 39.06,
    rooms: 2,
    floor: 1,
    available: true,
    meshName: "apartment_1_1" // Должно совпадать с именем в модели
  },
  // ... больше квартир
];
```

**Генерация из планов:**
Можно создать скрипт для автоматической генерации конфигурации из PDF планов в `public/plans/Плани/`.

### Вариант 4: Интеграция с планами

**Использование планов из `public/plans/`:**
```typescript
// Можно загрузить планы и использовать для:
// 1. Определения позиций квартир
// 2. Валидации конфигурации
// 3. Отображения в tooltip при наведении

import { readFile } from 'fs/promises';

// Пример загрузки плана этажа
const floorPlan = await loadFloorPlan(1); // 1 этаж
```

## Настройка модели

### Требования к модели

1. **Именование мешей:**
   - Квартиры должны иметь понятные имена
   - Рекомендуемый формат: `apartment_{floor}_{number}`
   - Пример: `apartment_1_1`, `apartment_2_3`

2. **Масштаб:**
   - Модель должна быть в реальном масштабе (метры)
   - Центр модели должен быть в начале координат (0, 0, 0)

3. **Материалы:**
   - Материалы должны поддерживать `emissive` для подсветки
   - Рекомендуется использовать `MeshStandardMaterial` или `MeshPhysicalMaterial`

### Подготовка модели в Blender/3ds Max

1. **Экспорт в GLB:**
   ```bash
   # Blender
   File > Export > glTF 2.0 (.glb/.gltf)
   # Выберите формат: Binary (.glb)
   ```

2. **Проверка имен:**
   - Убедитесь, что все меши квартир имеют правильные имена
   - Используйте Outliner для проверки

3. **Оптимизация:**
   - Удалите неиспользуемые материалы
   - Оптимизируйте геометрию (decimate если нужно)
   - Сожмите текстуры

## Использование

### Базовый пример

```tsx
"use client";
import SpainBuildingScene3D, { ApartmentConfig } from "@/components/scene/SpainBuildingScene3D";

const apartments: ApartmentConfig[] = [
  { id: "66-A001", name: "Flat 66-A001", area: 39.06, rooms: 2, floor: 1, available: true, meshName: "apartment_1_1" },
  { id: "66-A002", name: "Flat 66-A002", area: 43.20, rooms: 2, floor: 1, available: true, meshName: "apartment_1_2" },
  // ... больше квартир
];

export default function SpainBuildingPage() {
  const handlePick = (unit: SpainPickedUnit) => {
    if (unit) {
      console.log("Selected apartment:", unit);
      // Переход на страницу квартиры
      router.push(`/apartment/${unit.id}`);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Здание в Испании</h1>
      <SpainBuildingScene3D
        apartments={apartments}
        coordinates={{ lat: 36.7731, lng: -4.0396 }}
        address="C. Cam. de Velez, 15, Альгарробо"
        onPick={handlePick}
        filter={{ onlyAvailable: true }}
      />
    </div>
  );
}
```

### С фильтрацией

```tsx
const [filter, setFilter] = useState<SpainSceneFilter>({
  onlyAvailable: true,
  rooms: null,
  floor: null,
});

<SpainBuildingScene3D
  apartments={apartments}
  filter={filter}
  onPick={handlePick}
/>
```

### С панорамным окружением

```tsx
<SpainBuildingScene3D
  apartments={apartments}
  usePanorama={true}
  panoramaUrl="/images/panoramas/spain-building-360.jpg"
  onPick={handlePick}
/>
```

## Решение проблем

### Квартиры не подсвечиваются

1. **Проверьте имена мешей:**
   - Убедитесь, что `meshName` в конфигурации совпадает с именем в модели
   - Используйте консоль браузера для отладки

2. **Проверьте материалы:**
   - Материалы должны поддерживать `emissive`
   - Если нет, компонент автоматически попытается добавить

### Модель не загружается

1. **Проверьте путь:**
   - Модель должна быть в `public/models/building.glb`
   - Или укажите другой путь через `modelPath`

2. **Проверьте формат:**
   - Используйте GLB (бинарный) формат
   - GLTF тоже поддерживается, но GLB предпочтительнее

### Производительность

1. **Оптимизация модели:**
   - Уменьшите количество полигонов
   - Сожмите текстуры
   - Используйте LOD (Level of Detail) если нужно

2. **Настройки рендеринга:**
   - `dpr={[1, 2]}` - адаптивное разрешение
   - Можно уменьшить `shadow-mapSize` для слабых устройств

## Дополнительные возможности

### Кастомное окружение

Можно добавить деревья, машины, людей используя готовые модели из:
- [Sketchfab](https://sketchfab.com/)
- [Poly Haven](https://polyhaven.com/models)
- [TurboSquid](https://www.turbosquid.com/)

### Интеграция с картами

Можно использовать координаты для:
- Отображения на карте
- Получения Street View панорамы
- Показа ближайших объектов

## Примеры использования

См. `src/components/scene/EXAMPLE_USAGE.md` для более подробных примеров.

