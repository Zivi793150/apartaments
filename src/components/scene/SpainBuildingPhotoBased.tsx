"use client";
import * as React from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3, Mesh } from "three";
import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import MapboxScene from "./MapboxScene";

export type SpainPickedUnit = { id: string; area: number; rooms: number; floor: number } | null;

/**
 * Конфигурация квартир на основе планов
 */
export interface ApartmentConfig {
  id: string;
  name: string;
  area: number;
  rooms: number;
  floor: number;
  available: boolean;
  // Позиция в здании (в метрах от центра)
  position: [number, number, number];
  // Размеры квартиры (ширина, высота, глубина)
  size: [number, number, number];
}

// Пример конфигурации на основе планов
const DEFAULT_APARTMENTS: ApartmentConfig[] = [
  // 1 этаж, левая сторона
  { 
    id: "66-A001", 
    name: "Flat 66-A001", 
    area: 39.06, 
    rooms: 2, 
    floor: 1, 
    available: true,
    position: [-6, 1.5, 0],
    size: [4, 3, 3]
  },
  { 
    id: "66-A002", 
    name: "Flat 66-A002", 
    area: 43.20, 
    rooms: 2, 
    floor: 1, 
    available: true,
    position: [-2, 1.5, 0],
    size: [4.5, 3, 3]
  },
  { 
    id: "66-A003", 
    name: "Flat 66-A003", 
    area: 26.47, 
    rooms: 1, 
    floor: 1, 
    available: true,
    position: [2, 1.5, 0],
    size: [3, 3, 3]
  },
  { 
    id: "66-A004", 
    name: "Flat 66-A004", 
    area: 25.41, 
    rooms: 1, 
    floor: 1, 
    available: false,
    position: [6, 1.5, 0],
    size: [2.8, 3, 3]
  },
  // 2 этаж
  { 
    id: "66-A005", 
    name: "Flat 66-A005", 
    area: 39.06, 
    rooms: 2, 
    floor: 2, 
    available: true,
    position: [-6, 4.5, 0],
    size: [4, 3, 3]
  },
  { 
    id: "66-A006", 
    name: "Flat 66-A006", 
    area: 43.20, 
    rooms: 2, 
    floor: 2, 
    available: true,
    position: [-2, 4.5, 0],
    size: [4.5, 3, 3]
  },
  // Добавьте больше квартир...
];

export type SpainSceneFilter = {
  onlyAvailable?: boolean;
  rooms?: 1 | 2 | 3 | 4 | null;
  floor?: number | null;
};

/**
 * Компонент квартиры - простой бокс с возможностью подсветки
 */
function ApartmentBox({
  apartment,
  isHovered,
  onHover,
  onPick,
  filter,
}: {
  apartment: ApartmentConfig;
  isHovered: boolean;
  onHover: (apt: ApartmentConfig | null, worldPos?: Vector3) => void;
  onPick: (apt: ApartmentConfig, worldPos?: Vector3) => void;
  filter: SpainSceneFilter;
}) {
  const meshRef = React.useRef<Mesh>(null);
  const matchesFilter = (
    (!filter.onlyAvailable || apartment.available) &&
    (!filter.rooms || apartment.rooms === filter.rooms) &&
    (!filter.floor || apartment.floor === filter.floor)
  );

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (matchesFilter && meshRef.current) {
      const worldPos = meshRef.current.getWorldPosition(new Vector3());
      onHover(apartment, worldPos);
    }
  };

  const handlePointerOut = () => {
    onHover(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (matchesFilter && meshRef.current) {
      const worldPos = meshRef.current.getWorldPosition(new Vector3());
      onPick(apartment, worldPos);
    }
  };

  const color = apartment.available 
    ? (isHovered ? "#4fea98" : "#6C7A88") 
    : "#7a8794";
  const opacity = matchesFilter ? (isHovered ? 0.95 : 0.7) : 0.3;
  const emissive = isHovered && matchesFilter ? 0.3 : 0;

  return (
    <mesh
      ref={meshRef}
      position={apartment.position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      <boxGeometry args={apartment.size} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={color}
        emissiveIntensity={emissive}
        metalness={0.1}
        roughness={0.6}
      />
    </mesh>
  );
}

/**
 * Здание из фотографий - простая геометрия с текстурами
 */
function BuildingFromPhotos({
  apartments,
  hoveredId,
  onHover,
  onPick,
  filter,
}: {
  apartments: ApartmentConfig[];
  hoveredId: string | null;
  onHover: (apt: ApartmentConfig | null, worldPos?: Vector3) => void;
  onPick: (apt: ApartmentConfig, worldPos?: Vector3) => void;
  filter: SpainSceneFilter;
}) {
  // Загрузка текстур фасада (если есть)
  // Можно использовать фотографии из public/images/building/
  // Для добавления текстур используйте useTexture из @react-three/drei:
  // const facadeFront = useTexture("/images/building/facade-front.jpg");
  // Затем используйте в meshStandardMaterial: map={facadeFront}

  // Размеры здания (можно вычислить из планов)
  const buildingWidth = 20; // метры
  const buildingHeight = 18; // метры (6 этажей по 3м)
  const buildingDepth = 12; // метры

  return (
    <group>
      {/* Основной корпус здания - простой бокс */}
      <mesh position={[0, buildingHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[buildingWidth, buildingHeight, buildingDepth]} />
        <meshStandardMaterial
          color="#EAECEF"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Фасады с фотографиями (можно добавить позже) */}
      {/* Для добавления текстур используйте useTexture из @react-three/drei */}
      {/* Пример:
          const facadeFront = useTexture("/images/building/facade-front.jpg");
          Затем используйте в meshStandardMaterial: map={facadeFront}
      */}

      {/* Квартиры как интерактивные боксы */}
      {apartments.map((apt) => (
        <ApartmentBox
          key={apt.id}
          apartment={apt}
          isHovered={hoveredId === apt.id}
          onHover={onHover}
          onPick={onPick}
          filter={filter}
        />
      ))}
    </group>
  );
}

/**
 * Проектор для экранных координат
 */
function ScreenProjector({
  worldPos,
  onProject,
}: {
  worldPos: Vector3 | null;
  onProject: (pt: { x: number; y: number } | null) => void;
}) {
  const { size, camera } = useThree();

  useFrame(() => {
    if (worldPos) {
      const v = worldPos.clone().project(camera);
      const x = (v.x + 1) / 2 * size.width;
      const y = (-v.y + 1) / 2 * size.height;
      onProject({ x, y });
    } else {
      onProject(null);
    }
  });

  return null;
}

/**
 * Основной компонент 3D сцены на основе фотографий
 */
export default function SpainBuildingPhotoBased({
  filter = {},
  onPick,
  apartments = DEFAULT_APARTMENTS,
  coordinates,
  address,
  useMapbox = true,
}: {
  filter?: SpainSceneFilter;
  onPick?: (u: SpainPickedUnit) => void;
  apartments?: ApartmentConfig[];
  coordinates?: { lat: number; lng: number };
  address?: string;
  useMapbox?: boolean;
}) {
  const [hovered, setHovered] = React.useState<ApartmentConfig | null>(null);
  const [screenPos, setScreenPos] = React.useState<{ x: number; y: number } | null>(null);
  const [pulse, setPulse] = React.useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [worldPos, setWorldPos] = React.useState<Vector3 | null>(null);
  const [showMapbox, setShowMapbox] = React.useState(useMapbox);

  React.useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth < 768);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const handleHover = (apt: ApartmentConfig | null, wp?: Vector3) => {
    setHovered(apt);
    if (wp) {
      setWorldPos(wp);
    } else {
      setWorldPos(null);
    }
  };

  const handlePick = (apt: ApartmentConfig, wp?: Vector3) => {
    onPick?.({ id: apt.id, area: apt.area, rooms: apt.rooms, floor: apt.floor });
    if (wp && screenPos) {
      setPulse(screenPos);
      setTimeout(() => setPulse(null), 350);
    }
  };

  const filteredApartments = React.useMemo(() => {
    return apartments.filter((apt) => {
      if (filter.onlyAvailable && !apt.available) return false;
      if (filter.rooms && apt.rooms !== filter.rooms) return false;
      if (filter.floor && apt.floor !== filter.floor) return false;
      return true;
    });
  }, [apartments, filter]);

  // Если используется Mapbox, показываем его как фон
  if (showMapbox && coordinates) {
    return (
      <div className="relative w-full max-w-[1100px] mx-auto">
        {/* Mapbox как фон/окружение */}
        <div className="absolute inset-0 z-0" style={{ height: "68vh" }}>
          <MapboxScene
            filter={{ activeBuilding: "a", onlyAvailable: filter.onlyAvailable }}
            onPick={(unit) => {
              if (unit) {
                const apt = apartments.find((a) => a.id === unit.id);
                if (apt) {
                  onPick?.({ id: apt.id, area: apt.area, rooms: apt.rooms, floor: apt.floor });
                }
              }
            }}
          />
        </div>

        {/* 3D здание поверх Mapbox */}
        <div className="relative z-10" style={{ height: "68vh", pointerEvents: "none" }}>
          <Canvas
            camera={{
              position: isMobile ? [15, 10, 15] as any : [20, 12, 20] as any,
              fov: isMobile ? 50 : 45,
            }}
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
            onPointerMissed={() => {
              setHovered(null);
            }}
          >
            <BuildingFromPhotos
              apartments={filteredApartments}
              hoveredId={hovered?.id || null}
              onHover={handleHover}
              onPick={handlePick}
              filter={filter}
            />
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              enableDamping={true}
              dampingFactor={0.05}
              minDistance={8}
              maxDistance={50}
            />
            <ScreenProjector
              worldPos={worldPos}
              onProject={(pt) => {
                if (pt) setScreenPos(pt);
                else setScreenPos(null);
              }}
            />
          </Canvas>
        </div>

        {/* Tooltip и UI поверх всего */}
        <div className="relative z-20 pointer-events-none">
          {hovered && screenPos && (
            <div
              className="absolute"
              style={{
                left: Math.max(10, Math.min(screenPos.x - 90, window.innerWidth - 200)),
                top: Math.max(10, screenPos.y - 120),
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-background/95 backdrop-blur ring-1 ring-border shadow-xl px-3 py-2 w-[180px]"
              >
                <div className="text-[12px] text-muted mb-0.5">Этаж {hovered.floor}</div>
                <div className="text-[16px] font-medium">
                  {hovered.name}
                  <span
                    className={`ml-2 inline-block size-2 rounded-full align-middle ${
                      hovered.available ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                </div>
                <div className="text-[12px] text-muted">
                  {hovered.area} м² · {hovered.rooms}к
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Стандартный режим без Mapbox
  return (
    <div
      className="relative w-full max-w-[980px] md:max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border bg-surface"
      style={{
        height: isMobile ? "60vh" : "68vh",
        touchAction: "pan-x pan-y",
      }}
    >
      {hovered && screenPos && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: Math.max(10, Math.min(screenPos.x - 90, window.innerWidth - 200)),
            top: Math.max(10, screenPos.y - 120),
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-background/95 backdrop-blur ring-1 ring-border shadow-xl px-3 py-2 w-[180px]"
          >
            <div className="text-[12px] text-muted mb-0.5">Этаж {hovered.floor}</div>
            <div className="text-[16px] font-medium">
              {hovered.name}
              <span
                className={`ml-2 inline-block size-2 rounded-full align-middle ${
                  hovered.available ? "bg-green-500" : "bg-muted"
                }`}
              />
            </div>
            <div className="text-[12px] text-muted">
              {hovered.area} м² · {hovered.rooms}к
            </div>
          </motion.div>
        </div>
      )}

      {pulse && (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: pulse.x - 10, top: pulse.y - 10 }}
        >
          <div className="size-5 rounded-full bg-green-500/60 animate-ping" />
        </div>
      )}

      <Canvas
        shadows
        camera={{
          position: isMobile ? [15, 10, 15] as any : [20, 12, 20] as any,
          fov: isMobile ? 50 : 45,
        }}
        dpr={[1, 2]}
        onPointerMissed={() => {
          setHovered(null);
        }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[0.9, 0.93, 0.96]} />
        <fog attach="fog" args={["#B8D4E8", 20, 60]} />

        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 15, 10]} intensity={1.3} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#d4d9d0" roughness={0.9} />
        </mesh>

        <BuildingFromPhotos
          apartments={filteredApartments}
          hoveredId={hovered?.id || null}
          onHover={handleHover}
          onPick={handlePick}
          filter={filter}
        />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.05}
          minDistance={isMobile ? 10 : 8}
          maxDistance={isMobile ? 40 : 50}
        />

        <ScreenProjector
          worldPos={worldPos}
          onProject={(pt) => {
            if (pt) setScreenPos(pt);
            else setScreenPos(null);
          }}
        />
      </Canvas>
    </div>
  );
}

