# Пример использования SpainBuildingScene3D

## Быстрый старт

```tsx
"use client";
import SpainBuildingScene3D, { 
  ApartmentConfig, 
  SpainPickedUnit 
} from "@/components/scene/SpainBuildingScene3D";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Конфигурация квартир (можно загрузить из JSON или API)
const apartments: ApartmentConfig[] = [
  // 1 этаж
  { id: "66-A001", name: "Flat 66-A001", area: 39.06, rooms: 2, floor: 1, available: true, meshName: "apartment_1_1" },
  { id: "66-A002", name: "Flat 66-A002", area: 43.20, rooms: 2, floor: 1, available: true, meshName: "apartment_1_2" },
  { id: "66-A003", name: "Flat 66-A003", area: 26.47, rooms: 1, floor: 1, available: true, meshName: "apartment_1_3" },
  { id: "66-A004", name: "Flat 66-A004", area: 25.41, rooms: 1, floor: 1, available: false, meshName: "apartment_1_4" },
  
  // 2 этаж
  { id: "66-A005", name: "Flat 66-A005", area: 39.06, rooms: 2, floor: 2, available: true, meshName: "apartment_2_1" },
  { id: "66-A006", name: "Flat 66-A006", area: 43.20, rooms: 2, floor: 2, available: true, meshName: "apartment_2_2" },
  { id: "66-A007", name: "Flat 66-A007", area: 39.06, rooms: 2, floor: 2, available: true, meshName: "apartment_2_3" },
  { id: "66-A008", name: "Flat 66-A008", area: 43.20, rooms: 2, floor: 2, available: true, meshName: "apartment_2_4" },
  
  // Добавьте больше квартир...
];

export default function SpainBuildingPage() {
  const router = useRouter();
  const [selectedUnit, setSelectedUnit] = useState<SpainPickedUnit>(null);

  const handlePick = (unit: SpainPickedUnit) => {
    if (unit) {
      setSelectedUnit(unit);
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
      />
      
      {selectedUnit && (
        <div className="mt-4 p-4 bg-surface rounded-lg">
          <h2 className="text-xl font-bold">Выбрана квартира: {selectedUnit.id}</h2>
          <p>Площадь: {selectedUnit.area} м²</p>
          <p>Комнат: {selectedUnit.rooms}</p>
          <p>Этаж: {selectedUnit.floor}</p>
        </div>
      )}
    </div>
  );
}
```

## С фильтрацией

```tsx
import { useState } from "react";
import SpainBuildingScene3D, { SpainSceneFilter } from "@/components/scene/SpainBuildingScene3D";

export default function FilteredBuildingPage() {
  const [filter, setFilter] = useState<SpainSceneFilter>({
    onlyAvailable: true,
    rooms: null,
    floor: null,
  });

  return (
    <div>
      {/* Фильтры */}
      <div className="flex gap-4 mb-4">
        <label>
          <input
            type="checkbox"
            checked={filter.onlyAvailable || false}
            onChange={(e) => setFilter({ ...filter, onlyAvailable: e.target.checked })}
          />
          Только доступные
        </label>
        
        <select
          value={filter.rooms || ""}
          onChange={(e) => setFilter({ ...filter, rooms: e.target.value ? Number(e.target.value) as any : null })}
        >
          <option value="">Все комнаты</option>
          <option value="1">1 комната</option>
          <option value="2">2 комнаты</option>
          <option value="3">3 комнаты</option>
        </select>
        
        <select
          value={filter.floor || ""}
          onChange={(e) => setFilter({ ...filter, floor: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Все этажи</option>
          <option value="1">1 этаж</option>
          <option value="2">2 этаж</option>
          <option value="3">3 этаж</option>
        </select>
      </div>

      <SpainBuildingScene3D
        apartments={apartments}
        filter={filter}
        onPick={(unit) => console.log("Selected:", unit)}
      />
    </div>
  );
}
```

## С панорамным окружением

```tsx
import SpainBuildingScene3D from "@/components/scene/SpainBuildingScene3D";
import { getGoogleStreetViewUrl } from "@/components/scene/StreetViewEnvironment";

export default function PanoramaBuildingPage() {
  // Получаем панораму из Google Street View
  const panoramaUrl = getGoogleStreetViewUrl(
    36.7731, // lat
    -4.0396, // lng
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    "2048x1024",
    120,
    0,
    0
  );

  // Или используйте свою панораму
  // const panoramaUrl = "/images/panoramas/spain-building-360.jpg";

  return (
    <SpainBuildingScene3D
      apartments={apartments}
      usePanorama={true}
      panoramaUrl={panoramaUrl}
      onPick={(unit) => console.log("Selected:", unit)}
    />
  );
}
```

## Интеграция с существующим кодом

Если у вас уже есть компонент `EstateBrowser3D`, можно интегрировать:

```tsx
import SpainBuildingScene3D from "@/components/scene/SpainBuildingScene3D";
import EstateBrowser3D from "@/components/scene/EstateBrowser3D";

export default function BuildingViewPage() {
  const [viewMode, setViewMode] = useState<"spain" | "estate">("spain");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setViewMode("spain")}>Здание в Испании</button>
        <button onClick={() => setViewMode("estate")}>Общий вид</button>
      </div>

      {viewMode === "spain" ? (
        <SpainBuildingScene3D
          apartments={apartments}
          onPick={(unit) => console.log("Selected:", unit)}
        />
      ) : (
        <EstateBrowser3D />
      )}
    </div>
  );
}
```

## Загрузка конфигурации из JSON

```tsx
import { useEffect, useState } from "react";
import SpainBuildingScene3D, { ApartmentConfig } from "@/components/scene/SpainBuildingScene3D";

export default function DynamicBuildingPage() {
  const [apartments, setApartments] = useState<ApartmentConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загрузка конфигурации из API или JSON файла
    fetch("/api/apartments")
      .then(res => res.json())
      .then(data => {
        setApartments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load apartments:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <SpainBuildingScene3D
      apartments={apartments}
      onPick={(unit) => console.log("Selected:", unit)}
    />
  );
}
```

## Пример JSON конфигурации

```json
// public/data/apartments.json
[
  {
    "id": "66-A001",
    "name": "Flat 66-A001",
    "area": 39.06,
    "rooms": 2,
    "floor": 1,
    "available": true,
    "meshName": "apartment_1_1"
  },
  {
    "id": "66-A002",
    "name": "Flat 66-A002",
    "area": 43.20,
    "rooms": 2,
    "floor": 1,
    "available": true,
    "meshName": "apartment_1_2"
  }
]
```

Загрузка:
```tsx
const apartments = await import("/public/data/apartments.json");
```

