# Настройка Poly Haven HDRI для окружения

Poly Haven предоставляет бесплатные HDRI панорамы высокого качества для реалистичного освещения и окружения.

## Что такое HDRI?

HDRI (High Dynamic Range Image) - это панорамное изображение 360° с высоким динамическим диапазоном, которое:
- Создаёт реалистичное освещение сцены
- Обеспечивает естественные отражения на объектах
- Даёт фотореалистичный фон окружения

## Шаг 1: Выбор HDRI на Poly Haven

1. Перейдите на [Poly Haven HDRI](https://polyhaven.com/hdris)
2. Найдите подходящую панораму (например, "City Street", "Urban Street")
3. Нажмите на панораму для просмотра

## Шаг 2: Скачивание HDRI

### Вариант A: Скачать локально (рекомендуется)

1. На странице HDRI нажмите "Download"
2. Выберите формат: **HDR** (лучше для качества) или **EXR**
3. Выберите разрешение: **4k** (хороший баланс качества/размера) или **8k** (максимальное качество)
4. Скачайте файл
5. Поместите в `public/hdris/`:

```
public/
  hdris/
    city_street_4k.hdr
    urban_street_4k.hdr
    ...
```

### Вариант B: Использовать CDN (быстрее для тестирования)

Poly Haven предоставляет прямые ссылки на CDN. Можно использовать без скачивания:

```tsx
import { getPolyHavenHDRIUrl } from "@/components/scene/PolyHavenEnvironment";

const hdriUrl = getPolyHavenHDRIUrl("city_street", "4k");
```

## Шаг 3: Интеграция в проект

### Использование компонента

```tsx
import PolyHavenEnvironment from "@/components/scene/PolyHavenEnvironment";

// В BuildingScene3D или другом компоненте:
<PolyHavenEnvironment 
  hdriUrl="/hdris/city_street_4k.hdr"
  intensity={1.0}
  useAsBackground={true}
  useAsEnvironment={true}
/>
```

### Использование с CDN

```tsx
import PolyHavenEnvironment, { 
  getPolyHavenHDRIUrl,
  POLYHAVEN_CITY_HDRI 
} from "@/components/scene/PolyHavenEnvironment";

<PolyHavenEnvironment 
  hdriUrl={getPolyHavenHDRIUrl(POLYHAVEN_CITY_HDRI.cityStreet, "4k")}
  intensity={1.2}
/>
```

## Шаг 4: Интеграция в BuildingScene3D

Обновите `EstateBrowser3D.tsx`:

```tsx
import PolyHavenEnvironment, { 
  getPolyHavenHDRIUrl,
  POLYHAVEN_CITY_HDRI 
} from "@/components/scene/PolyHavenEnvironment";

export default function EstateBrowser3D() {
  // Используем городскую HDRI панораму
  const hdriUrl = getPolyHavenHDRIUrl(POLYHAVEN_CITY_HDRI.cityStreet, "4k");
  
  // Или локальный файл:
  // const hdriUrl = "/hdris/city_street_4k.hdr";

  return (
    <div>
      <BuildingScene3D 
        filter={filter} 
        onPick={setPicked}
        hdriUrl={hdriUrl}
        usePolyHaven={true}
      />
    </div>
  );
}
```

## Рекомендуемые HDRI для недвижимости

### Городские сцены:
- **city_street** - городская улица днём
- **urban_street** - урбанистическая улица
- **downtown** - центр города
- **city_park** - городской парк

### Вечерние/ночные сцены:
- **city_night** - город ночью
- **street_night** - улица ночью
- **city_sunset** - город на закате

### Природные сцены:
- **forest** - лес
- **beach** - пляж
- **sunset** - закат

## Настройка интенсивности

```tsx
// Яркое освещение (день)
<PolyHavenEnvironment hdriUrl={hdriUrl} intensity={1.5} />

// Нормальное освещение
<PolyHavenEnvironment hdriUrl={hdriUrl} intensity={1.0} />

// Тёмное освещение (вечер)
<PolyHavenEnvironment hdriUrl={hdriUrl} intensity={0.7} />
```

## Разрешения

- **1k** (1024x512) - быстро, но низкое качество
- **2k** (2048x1024) - хороший баланс
- **4k** (4096x2048) - **рекомендуется** для веба
- **8k** (8192x4096) - максимальное качество, но большой размер

## Преимущества Poly Haven HDRI

✅ **Бесплатно** - все HDRI бесплатны для коммерческого использования  
✅ **Высокое качество** - до 16k разрешение  
✅ **Разнообразие** - сотни панорам на выбор  
✅ **Реалистичное освещение** - естественный свет и отражения  
✅ **Быстрая загрузка** - можно использовать CDN  

## Примеры использования

### Переключение между HDRI

```tsx
const [hdriName, setHdriName] = useState(POLYHAVEN_CITY_HDRI.cityStreet);

<select onChange={(e) => setHdriName(e.target.value)}>
  <option value={POLYHAVEN_CITY_HDRI.cityStreet}>City Street</option>
  <option value={POLYHAVEN_CITY_HDRI.cityNight}>City Night</option>
  <option value={POLYHAVEN_CITY_HDRI.urbanStreet}>Urban Street</option>
</select>

<PolyHavenEnvironment 
  hdriUrl={getPolyHavenHDRIUrl(hdriName, "4k")}
/>
```

### Комбинирование с другими источниками

```tsx
// HDRI для освещения + панорама для фона
<PolyHavenEnvironment 
  hdriUrl={hdriUrl}
  useAsBackground={false}  // Не использовать как фон
  useAsEnvironment={true}  // Только для освещения
/>
<StreetViewEnvironment panoramaUrl={panoramaUrl} />
```

## Troubleshooting

### HDRI не загружается

1. Проверьте путь к файлу: `/hdris/filename.hdr`
2. Убедитесь, что файл в формате .hdr или .exr
3. Проверьте консоль браузера на ошибки CORS
4. Попробуйте использовать CDN вместо локального файла

### Слишком тёмное/яркое освещение

Настройте параметр `intensity`:
```tsx
<PolyHavenEnvironment hdriUrl={hdriUrl} intensity={0.8} /> // Темнее
<PolyHavenEnvironment hdriUrl={hdriUrl} intensity={1.5} /> // Ярче
```

### Медленная загрузка

1. Используйте разрешение 2k или 4k вместо 8k
2. Оптимизируйте файл HDRI (сжатие)
3. Используйте CDN для кэширования

