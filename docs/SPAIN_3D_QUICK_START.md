# Быстрый старт: 3D сцена без готовой модели

## Рекомендуемый подход: Фото + Простая геометрия + Mapbox

### Шаг 1: Использование готового компонента

```tsx
import SpainBuildingPhotoBased from "@/components/scene/SpainBuildingPhotoBased";

export default function BuildingPage() {
  return (
    <SpainBuildingPhotoBased
      apartments={apartmentsConfig}
      coordinates={{ lat: 36.7731, lng: -4.0396 }}
      address="C. Cam. de Velez, 15, Альгарробо"
      useMapbox={true}
      onPick={(unit) => console.log("Selected:", unit)}
    />
  );
}
```

### Шаг 2: Настройка конфигурации квартир

Отредактируйте `DEFAULT_APARTMENTS` в `SpainBuildingPhotoBased.tsx`:

```typescript
const DEFAULT_APARTMENTS: ApartmentConfig[] = [
  {
    id: "66-A001",
    name: "Flat 66-A001",
    area: 39.06,
    rooms: 2,
    floor: 1,
    available: true,
    position: [-6, 1.5, 0],  // Позиция в метрах от центра
    size: [4, 3, 3]          // Размеры (ширина, высота, глубина)
  },
  // Добавьте больше квартир...
];
```

### Шаг 3: Добавление фотографий фасада (опционально)

1. Подготовьте фотографии фасада:
   - Фронтальный вид
   - Боковые виды (если есть)

2. Разместите в `public/images/building/`:
   ```
   public/images/building/
     - facade-front.jpg
     - facade-left.jpg
     - facade-right.jpg
   ```

3. Раскомментируйте код загрузки текстур в компоненте:
   ```typescript
   import { useTexture } from "@react-three/drei";
   
   const facadeFront = useTexture("/images/building/facade-front.jpg");
   ```

### Шаг 4: Настройка Mapbox (опционально)

Если хотите использовать Mapbox для окружения:

1. Добавьте API ключ в `.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
   ```

2. Компонент автоматически использует Mapbox если `useMapbox={true}`

## Альтернативные варианты

См. `docs/SPAIN_3D_ALTERNATIVES.md` для полного списка вариантов:
- Фотограмметрия (3D из фотографий)
- Готовые 3D модели
- Упрощенная модель на основе планов
- И другие...

## Что уже работает

✅ Простая 3D геометрия здания  
✅ Интерактивные квартиры с подсветкой  
✅ Вращение на 360°  
✅ Интеграция с Mapbox (опционально)  
✅ Tooltip с информацией о квартире  
✅ Фильтрация квартир  

## Следующие шаги

1. Настройте конфигурацию квартир под ваши планы
2. Добавьте фотографии фасада (если есть)
3. Настройте Mapbox (если нужно)
4. Кастомизируйте под свои нужды

