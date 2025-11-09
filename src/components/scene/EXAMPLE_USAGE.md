# Примеры использования окружения

## Быстрый старт с Google Street View

### 1. Получите API ключ Google Maps

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект или выберите существующий
3. Включите "Street View Static API"
4. Создайте API ключ в разделе "Credentials"

### 2. Добавьте ключ в переменные окружения

Создайте файл `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=ваш_ключ_здесь
```

### 3. Используйте в компоненте

```tsx
// src/components/scene/EstateBrowser3D.tsx
import { getGoogleStreetViewUrl } from "./StreetViewEnvironment";

export default function EstateBrowser3D() {
  // Координаты вашего здания (например, Киев)
  const buildingLat = 50.4501;
  const buildingLng = 30.5234;
  
  // Получаем URL панорамы
  const panoramaUrl = getGoogleStreetViewUrl(
    buildingLat,
    buildingLng,
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    "2048x1024",
    90
  );

  return (
    <BuildingScene3D
      filter={filter}
      onPick={setPicked}
      panoramaUrl={panoramaUrl}
      useStreetView={true}
    />
  );
}
```

## Использование собственных 360° фотографий

### 1. Поместите фото в public/panoramas/

```
public/
  panoramas/
    street-view-front.jpg
    street-view-back.jpg
```

### 2. Используйте в компоненте

```tsx
<BuildingScene3D
  filter={filter}
  onPick={setPicked}
  panoramaUrl="/panoramas/street-view-front.jpg"
  useStreetView={true}
/>
```

## Использование готовых панорам из Poly Haven

### 1. Скачайте HDR панораму

Перейдите на [Poly Haven HDRI](https://polyhaven.com/hdris) и скачайте понравившуюся панораму.

### 2. Конвертируйте в JPG (если нужно)

HDR можно использовать напрямую, но для простоты можно конвертировать в JPG.

### 3. Используйте

```tsx
<BuildingScene3D
  filter={filter}
  onPick={setPicked}
  panoramaUrl="/panoramas/city-street.jpg"
  useStreetView={true}
/>
```

## Использование Mapbox (альтернатива)

Mapbox можно использовать как альтернативу, но требует установки `mapbox-gl` и создания собственного компонента интеграции. 

**Рекомендуется использовать Google Street View API** (Вариант 1), так как он уже интегрирован и не требует дополнительных зависимостей.

## Динамическое переключение между видами

```tsx
const [viewMode, setViewMode] = useState<"default" | "streetview">("default");

const panoramaUrl = viewMode === "streetview" 
  ? getGoogleStreetViewUrl(lat, lng, apiKey)
  : undefined;

return (
  <>
    <div className="flex gap-2 mb-4">
      <button onClick={() => setViewMode("default")}>Стандартный вид</button>
      <button onClick={() => setViewMode("streetview")}>Street View</button>
    </div>
    
    <BuildingScene3D
      filter={filter}
      onPick={setPicked}
      panoramaUrl={panoramaUrl}
      useStreetView={viewMode === "streetview"}
    />
  </>
);
```

## Важные замечания

1. **Google Street View API** имеет лимиты запросов (бесплатно: 28,000 запросов/месяц)
2. **Собственные панорамы** - без ограничений, но требуют съемки
3. **Poly Haven** - полностью бесплатно, но нужно скачать файлы

## Оптимизация производительности

- Используйте разрешение панорам не более 2048x1024 для веба
- Кэшируйте загруженные текстуры
- Используйте lazy loading для панорам

