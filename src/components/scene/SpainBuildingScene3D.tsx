"use client";
import * as React from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Vector3, Mesh, Group, Raycaster } from "three";
import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import StreetViewEnvironment from "./StreetViewEnvironment";

export type SpainPickedUnit = { id: string; area: number; rooms: number; floor: number } | null;

/**
 * Конфигурация квартир на основе планов
 * Можно расширить, добавив реальные данные из планов
 */
export interface ApartmentConfig {
  id: string;
  name: string;
  area: number;
  rooms: number;
  floor: number;
  available: boolean;
  // Позиция в модели (если квартиры названы в модели)
  meshName?: string;
  // Или позиция вручную (если нужно)
  position?: [number, number, number];
  bbox?: { min: [number, number, number]; max: [number, number, number] };
}

// Пример конфигурации квартир - можно загрузить из JSON или генерировать из планов
const DEFAULT_APARTMENTS: ApartmentConfig[] = [
  // Пример для 1 этажа
  { id: "66-A001", name: "Flat 66-A001", area: 39.06, rooms: 2, floor: 1, available: true, meshName: "apartment_1_1" },
  { id: "66-A002", name: "Flat 66-A002", area: 43.20, rooms: 2, floor: 1, available: true, meshName: "apartment_1_2" },
  { id: "66-A003", name: "Flat 66-A003", area: 26.47, rooms: 1, floor: 1, available: true, meshName: "apartment_1_3" },
  { id: "66-A004", name: "Flat 66-A004", area: 25.41, rooms: 1, floor: 1, available: false, meshName: "apartment_1_4" },
  // Пример для 2 этажа
  { id: "66-A005", name: "Flat 66-A005", area: 39.06, rooms: 2, floor: 2, available: true, meshName: "apartment_2_1" },
  { id: "66-A006", name: "Flat 66-A006", area: 43.20, rooms: 2, floor: 2, available: true, meshName: "apartment_2_2" },
  { id: "66-A007", name: "Flat 66-A007", area: 39.06, rooms: 2, floor: 2, available: true, meshName: "apartment_2_3" },
  { id: "66-A008", name: "Flat 66-A008", area: 43.20, rooms: 2, floor: 2, available: true, meshName: "apartment_2_4" },
  // Добавьте больше квартир по необходимости
];

export type SpainSceneFilter = {
  onlyAvailable?: boolean;
  rooms?: 1 | 2 | 3 | 4 | null;
  floor?: number | null;
};

/**
 * Компонент для загрузки и отображения готовой 3D модели здания
 */
function BuildingModel({ 
  apartments, 
  hoveredId, 
  onHover, 
  onPick,
  filter 
}: { 
  apartments: ApartmentConfig[];
  hoveredId: string | null;
  onHover: (apt: ApartmentConfig | null, worldPos?: Vector3) => void;
  onPick: (apt: ApartmentConfig, worldPos?: Vector3) => void;
  filter: SpainSceneFilter;
}) {
  const { scene } = useGLTF("/models/building.glb");
  const groupRef = React.useRef<Group>(null);
  const [apartmentMeshes, setApartmentMeshes] = React.useState<Map<string, Mesh>>(new Map());

  // Находим меши квартир в модели
  React.useEffect(() => {
    const meshes = new Map<string, Mesh>();
    
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        // Ищем меши по имени (если дизайнер назвал их)
        const name = child.name.toLowerCase();
        
        // Проверяем все квартиры
        for (const apt of apartments) {
          if (apt.meshName && name.includes(apt.meshName.toLowerCase())) {
            meshes.set(apt.id, child);
            // Сохраняем оригинальный материал
            (child as any).userData.originalMaterial = child.material;
            (child as any).userData.apartmentId = apt.id;
            // Делаем меш интерактивным
            child.userData.isApartment = true;
          }
        }
      }
    });

    setApartmentMeshes(meshes);
  }, [scene, apartments]);

  // Подсветка при наведении
  React.useEffect(() => {
    apartmentMeshes.forEach((mesh, aptId) => {
      const apt = apartments.find(a => a.id === aptId);
      if (!apt) return;

      const matchesFilter = (
        (!filter.onlyAvailable || apt.available) &&
        (!filter.rooms || apt.rooms === filter.rooms) &&
        (!filter.floor || apt.floor === filter.floor)
      );

      if (hoveredId === aptId && matchesFilter) {
        // Подсветка при наведении - зеленое свечение
        if (mesh.material instanceof Array) {
          mesh.material.forEach((mat: any) => {
            if (mat && mat.emissive !== undefined) {
              mat.emissive = new Vector3(0.3, 0.8, 0.3);
              mat.emissiveIntensity = 0.5;
            }
          });
        } else if (mesh.material && (mesh.material as any).emissive !== undefined) {
          (mesh.material as any).emissive = new Vector3(0.3, 0.8, 0.3);
          (mesh.material as any).emissiveIntensity = 0.5;
        }
      } else {
        // Восстанавливаем оригинальный материал
        const originalMat = (mesh as any).userData.originalMaterial;
        if (originalMat) {
          if (originalMat instanceof Array) {
            originalMat.forEach((mat: any) => {
              if (mat && mat.emissive !== undefined) {
                mat.emissive = new Vector3(0, 0, 0);
                mat.emissiveIntensity = 0;
              }
            });
          } else if (originalMat && (originalMat as any).emissive !== undefined) {
            (originalMat as any).emissive = new Vector3(0, 0, 0);
            (originalMat as any).emissiveIntensity = 0;
          }
        }
      }
    });
  }, [hoveredId, apartmentMeshes, apartments, filter]);

  // Обработка событий на уровне всей сцены
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const object = e.object;
    if (object instanceof Mesh && (object as any).userData?.isApartment) {
      const aptId = (object as any).userData.apartmentId;
      if (aptId) {
        const apt = apartments.find(a => a.id === aptId);
        if (apt) {
          const worldPos = object.getWorldPosition(new Vector3());
          onHover(apt, worldPos);
        }
      }
    } else {
      onHover(null);
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const object = e.object;
    if (object instanceof Mesh && (object as any).userData?.isApartment) {
      const aptId = (object as any).userData.apartmentId;
      if (aptId) {
        const apt = apartments.find(a => a.id === aptId);
        if (apt) {
          const worldPos = object.getWorldPosition(new Vector3());
          onPick(apt, worldPos);
        }
      }
    }
  };

  return (
    <group 
      ref={groupRef}
      onPointerMove={handlePointerMove}
      onPointerOut={() => onHover(null)}
      onClick={handleClick}
    >
      <primitive 
        object={scene} 
        scale={1} 
        position={[0, 0, 0]}
      />
    </group>
  );
}

// Предзагрузка модели для оптимизации
useGLTF.preload("/models/building.glb");

/**
 * Проектор для преобразования 3D позиции в экранные координаты
 */
function ScreenProjector({ 
  worldPos,
  onProject 
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
 * Основной компонент 3D сцены для здания в Испании
 */
export default function SpainBuildingScene3D({
  filter = {},
  onPick,
  panoramaUrl,
  usePanorama = false,
  apartments = DEFAULT_APARTMENTS,
  modelPath = "/models/building.glb",
  coordinates,
  address,
}: {
  filter?: SpainSceneFilter;
  onPick?: (u: SpainPickedUnit) => void;
  panoramaUrl?: string;
  usePanorama?: boolean;
  apartments?: ApartmentConfig[];
  modelPath?: string;
  coordinates?: { lat: number; lng: number };
  address?: string;
}) {
  const [hovered, setHovered] = React.useState<ApartmentConfig | null>(null);
  const [screenPos, setScreenPos] = React.useState<{ x: number; y: number } | null>(null);
  const [pulse, setPulse] = React.useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [worldPos, setWorldPos] = React.useState<Vector3 | null>(null);

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

  // Фильтруем квартиры по фильтру
  const filteredApartments = React.useMemo(() => {
    return apartments.filter(apt => {
      if (filter.onlyAvailable && !apt.available) return false;
      if (filter.rooms && apt.rooms !== filter.rooms) return false;
      if (filter.floor && apt.floor !== filter.floor) return false;
      return true;
    });
  }, [apartments, filter]);

  return (
    <div 
      className="relative w-full max-w-[980px] md:max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border bg-surface"
      style={{ 
        height: isMobile ? "60vh" : "68vh",
        touchAction: "pan-x pan-y",
      }}
      onWheelCapture={(e) => { e.preventDefault(); }}
    >
      {/* Hover tooltip */}
      {hovered && screenPos && (
        <div 
          className="pointer-events-none absolute z-20" 
          style={{ 
            left: Math.max(10, Math.min(screenPos.x - 90, window.innerWidth - 200)), 
            top: Math.max(10, screenPos.y - 120) 
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
              <span className={`ml-2 inline-block size-2 rounded-full align-middle ${hovered.available ? "bg-green-500" : "bg-muted"}`} />
            </div>
            <div className="text-[12px] text-muted">{hovered.area} м² · {hovered.rooms}к</div>
          </motion.div>
        </div>
      )}

      {/* Click pulse feedback */}
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
          fov: isMobile ? 50 : 45 
        }}
        dpr={[1, 2]}
        onPointerMissed={() => { setHovered(null); }}
        gl={{ antialias: true }}
      >
        {/* Панорамное окружение */}
        {usePanorama && panoramaUrl && (
          <StreetViewEnvironment panoramaUrl={panoramaUrl} />
        )}

        {/* Стандартное окружение (если панорама не используется) */}
        {!usePanorama && (
          <>
            <color attach="background" args={[0.9, 0.93, 0.96]} />
            <fog attach="fog" args={["#B8D4E8", 20, 60]} />
            {/* Небо */}
            <mesh>
              <sphereGeometry args={[100, 32, 16]} />
              <meshBasicMaterial color="#B8D4E8" side={2} />
            </mesh>
          </>
        )}

        {/* Освещение */}
        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[10, 15, 10]} 
          intensity={1.3} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />
        <pointLight position={[0, 10, -10]} intensity={0.3} distance={40} />

        {/* Земля/Территория */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#d4d9d0" roughness={0.9} />
        </mesh>

        {/* Загруженная модель здания */}
        <BuildingModel
          apartments={filteredApartments}
          hoveredId={hovered?.id || null}
          onHover={handleHover}
          onPick={handlePick}
          filter={filter}
        />

        {/* Управление камерой - вращение на 360° */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          zoomSpeed={0.6}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0}
          minDistance={isMobile ? 10 : 8}
          maxDistance={isMobile ? 40 : 50}
          autoRotate={false}
          target={[0, 0, 0]}
        />

        {/* Проектор для экранных координат */}
        <ScreenProjector 
          worldPos={worldPos} 
          onProject={(pt) => {
            if (pt) setScreenPos(pt);
            else setScreenPos(null);
          }} 
        />
      </Canvas>

      {/* Информация о координатах (если указаны) */}
      {(coordinates || address) && (
        <div className="absolute bottom-4 left-4 z-10 hidden md:block">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-full bg-background/90 backdrop-blur-md px-3 py-1.5 text-[12px] ring-1 ring-border/60 shadow-lg"
          >
            {address || (coordinates ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}` : "")}
          </motion.div>
        </div>
      )}
    </div>
  );
}
