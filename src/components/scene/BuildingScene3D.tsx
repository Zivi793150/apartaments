"use client";
import * as React from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";
import StreetViewEnvironment from "./StreetViewEnvironment";

export type PickedUnit = { id: string; area: number; rooms: number } | null;

import { useRouter } from "next/navigation";

type BuildingKind = "a" | "b";

const FLOORS = 6;
const UNITS_PER_FLOOR = 4;

function getUnitColor(kind: BuildingKind, available: boolean, hovered: boolean) {
  if (!available) return "#7a8794";
  if (hovered) return getBrand(kind);
  return getAccent(kind);
}

// Используем яркие цвета из обновленной палитры
function getBrand(kind: BuildingKind) { 
  return kind === "a" ? "#FF6A2B" : "#6C7A88"; // яркий brand и accent-satin из CSS
}
function getAccent(kind: BuildingKind) { 
  return kind === "a" ? "#FFC7A8" : "#D9E2EB"; // яркий brand-light и accent-satin из CSS
}

function generateUnits(kind: BuildingKind) {
  const units: Array<{ id: string; floor: number; col: number; area: number; rooms: number; available: boolean }> = [];
  for (let f = 1; f <= FLOORS; f++) {
    for (let c = 1; c <= UNITS_PER_FLOOR; c++) {
      const id = `${kind.toUpperCase()}-${f}-${c}`;
      const area = 36 + (c * 2.5) + (f * 0.9);
      const rooms = 1 + (c % 3 === 0 ? 2 : (c % 2));
      const available = (f * c) % 5 !== 0;
      units.push({ id, floor: f, col: c, area: Number(area.toFixed(1)), rooms, available });
    }
  }
  return units;
}

function NeonGlow({ size = [0.98, 0.58, 0.22], color = "#E0703E" as string }) {
  return (
    <mesh>
      <boxGeometry args={size as any} />
      <meshBasicMaterial color={color} transparent opacity={0.42} blending={2} />
    </mesh>
  );
}

function ApartmentBox({
  kind,
  unit,
  position,
  dimmed,
  onHover,
  onPick,
}: {
  kind: BuildingKind;
  unit: { id: string; floor: number; col: number; area: number; rooms: number; available: boolean };
  position: [number, number, number];
  dimmed: boolean;
  onHover: (u: any | null, worldPos?: Vector3) => void;
  onPick: (u: any, worldPos?: Vector3) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const color = getUnitColor(kind, unit.available, hovered);
  const opacity = dimmed ? 0.25 : hovered ? 0.98 : 0.86;
  const ref = React.useRef<any>(null);
  return (
    <group position={position} ref={ref}>
      {hovered && !dimmed && <NeonGlow color={getBrand(kind)} />}
      {/* Main apartment unit */}
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); onHover(unit, ref.current?.getWorldPosition(new Vector3())); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
        onClick={(e) => { e.stopPropagation(); if (!dimmed) onPick(unit, ref.current?.getWorldPosition(new Vector3())); }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.9, 0.5, 0.2]} />
        <meshStandardMaterial 
          color={color} 
          metalness={hovered ? 0.25 : 0.1} 
          roughness={hovered ? 0.45 : 0.55} 
          transparent 
          opacity={opacity}
          emissive={hovered ? color : "#000000"}
          emissiveIntensity={hovered ? 0.15 : 0}
        />
      </mesh>
      {/* Balcony ledge */}
      <mesh position={[0, -0.22, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.08, 0.18]} />
        <meshStandardMaterial color="#dcdfe4" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Large windows with frames */}
      {!dimmed && (
        <>
          <mesh position={[-0.25, 0.1, 0.21]} castShadow>
            <boxGeometry args={[0.15, 0.2, 0.02]} />
            <meshStandardMaterial color="#2a2d35" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0.25, 0.1, 0.21]} castShadow>
            <boxGeometry args={[0.15, 0.2, 0.02]} />
            <meshStandardMaterial color="#2a2d35" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Glass panes */}
          <mesh position={[-0.25, 0.1, 0.22]}>
            <boxGeometry args={[0.13, 0.18, 0.01]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0.25, 0.1, 0.22]}>
            <boxGeometry args={[0.13, 0.18, 0.01]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Building({ kind, offsetX, withParking, filter, onHoverUnit, onPickUnit }: { kind: BuildingKind; offsetX: number; withParking: boolean; filter: SceneFilter; onHoverUnit: (u: any | null, world?: Vector3) => void; onPickUnit: (u: any, world?: Vector3) => void }) {
  const units = React.useMemo(() => generateUnits(kind), [kind]);
  const width = UNITS_PER_FLOOR * 1.1 + 0.6;
  const height = FLOORS * 0.7 + 0.6;
  const isActive = (filter.activeBuilding === kind);

  return (
    <group position={[offsetX, 0, 0]}>
      {/* Subtle active highlight */}
      {isActive && (
        <mesh position={[0, 0, -0.05]} rotation={[0,0,0]}>
          <planeGeometry args={[width+0.4, height+0.4]} />
          <meshBasicMaterial color={kind === "a" ? "#FF6A2B" : "#6C7A88"} transparent opacity={0.08} />
        </mesh>
      )}
      
      {/* Main building facade - premium material */}
      <mesh position={[0, height/2 - 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.4]} />
        <meshStandardMaterial 
          color={kind === "a" ? "#F3F1EE" : "#EAECEF"} 
          roughness={0.7} 
          metalness={0.05}
          emissive={isActive ? (kind === "a" ? "#FF6A2B" : "#6C7A88") : "#000000"}
          emissiveIntensity={isActive ? 0.05 : 0}
        />
      </mesh>
      
      {/* Building edges/trim - premium detail */}
      <mesh position={[-width/2, height/2 - 0.35, 0.21]} castShadow>
        <boxGeometry args={[0.02, height, 0.02]} />
        <meshStandardMaterial color="#b8bcc4" metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[width/2, height/2 - 0.35, 0.21]} castShadow>
        <boxGeometry args={[0.02, height, 0.02]} />
        <meshStandardMaterial color="#b8bcc4" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Top edge */}
      <mesh position={[0, height - 0.35, 0.21]} castShadow>
        <boxGeometry args={[width, 0.02, 0.02]} />
        <meshStandardMaterial color="#b8bcc4" metalness={0.3} roughness={0.4} />
      </mesh>
      
      {/* Vertical grid lines */}
      {Array.from({ length: UNITS_PER_FLOOR * 2 + 1 }).map((_, i) => (
        <mesh key={`v-${i}`} position={[(-width/2) + i*(width/(UNITS_PER_FLOOR*2)), 0, 0.205]} castShadow>
          <boxGeometry args={[0.01, height, 0.01]} />
          <meshStandardMaterial color="#c3c9cf" roughness={0.85} metalness={0.1} />
        </mesh>
      ))}
      
      {/* Horizontal floor dividers - enhanced for all 6 floors */}
      {Array.from({ length: FLOORS * 2 + 1 }).map((_, j) => (
        <mesh key={`h-${j}`} position={[0, (-height/2) + j*(height/(FLOORS*2)), 0.205]} castShadow>
          <boxGeometry args={[width, 0.01, 0.01]} />
          <meshStandardMaterial color="#d0d5db" roughness={0.85} metalness={0.1} />
        </mesh>
      ))}
      
      {/* Terraces/Balconies for each floor - premium detail */}
      {Array.from({ length: FLOORS }).map((_, floorIdx) => {
        const floorNum = floorIdx + 1;
        const floorY = (-height/2) + 0.55 + floorIdx * 0.7;
        return (
          <group key={`terrace-${floorNum}`}>
            {/* Terrace floor */}
            <mesh position={[0, floorY - 0.3, 0.25]} castShadow receiveShadow>
              <boxGeometry args={[width - 0.2, 0.05, 0.15]} />
              <meshStandardMaterial color="#e8e8e8" roughness={0.6} metalness={0.05} />
            </mesh>
            {/* Glass railings on terraces */}
            <mesh position={[0, floorY - 0.25, 0.32]} castShadow>
              <boxGeometry args={[width - 0.2, 0.08, 0.01]} />
              <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Railing posts */}
            {Array.from({ length: UNITS_PER_FLOOR + 1 }).map((_, i) => (
              <mesh key={`post-${floorNum}-${i}`} position={[(-width/2) + 0.1 + i * (width - 0.2) / UNITS_PER_FLOOR, floorY - 0.25, 0.32]} castShadow>
                <boxGeometry args={[0.015, 0.08, 0.015]} />
                <meshStandardMaterial color="#2a2d35" metalness={0.8} roughness={0.2} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Apartment units */}
      {units.map((u) => {
        const x = (-width/2) + 0.8 + (u.col-1) * 1.1;
        const y = (-height/2) + 0.55 + (u.floor-1) * 0.7;
        const matches = (
          (filter.activeBuilding === "all" || filter.activeBuilding === kind) &&
          (!filter.onlyAvailable || u.available) &&
          (!filter.rooms || u.rooms === filter.rooms) &&
          (!filter.hoverFloor || u.floor === filter.hoverFloor)
        );
        return (
          <ApartmentBox key={u.id} kind={kind} unit={u} position={[x, y, 0.31]} dimmed={!matches} onHover={onHoverUnit} onPick={onPickUnit} />
        );
      })}
    </group>
  );
}

export type SceneFilter = {
  activeBuilding: "all" | BuildingKind;
  rooms?: 1 | 2 | 3 | 4 | null;
  onlyAvailable?: boolean;
  hoverFloor?: number | null;
};

// ProjectorInside удален - больше не нужен без 3D моделей

export default function BuildingScene3D({ 
  filter, 
  onPick,
  panoramaUrl,
  useStreetView = false
}: { 
  filter: SceneFilter; 
  onPick?: (u: PickedUnit) => void;
  panoramaUrl?: string;
  useStreetView?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [vh, setVh] = React.useState<number>(68);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [showMobileHint, setShowMobileHint] = React.useState<boolean>(false);
  React.useEffect(() => {
    const upd = () => setIsMobile(window.innerWidth < 768);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  React.useEffect(() => {
    if (isMobile) {
      setShowMobileHint(true);
      const t = setTimeout(() => setShowMobileHint(false), 5000);
      return () => clearTimeout(t);
    }
  }, [isMobile]);

  // targetXRef удален - больше не нужен без 3D моделей зданий

  // Drag handle for mobile to resize scene height
  const dragRef = React.useRef<{startY:number;startVh:number}|null>(null);
  const onTouchStart = (e: React.TouchEvent) => { dragRef.current = { startY: e.touches[0].clientY, startVh: vh }; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.touches[0].clientY; // up increases
    const next = Math.max(50, Math.min(90, dragRef.current.startVh + dy / 6));
    setVh(next);
  };
  const onTouchEnd = () => { dragRef.current = null; };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full max-w-[980px] md:max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border bg-surface px-3 md:px-0" 
      style={{ 
        overscrollBehavior: "contain", 
        height: `${vh}vh`,
        touchAction: "pan-x pan-y", // Prevent pinch zoom on mobile
      }} 
      onWheelCapture={(e) => { e.preventDefault(); }}
      onTouchStart={(e) => {
        // Prevent double-tap zoom on mobile
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        // Prevent pinch zoom
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }}
    >
      {/* Parking badges */}
      <div className="absolute left-4 bottom-4 z-10 hidden md:block">
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 rounded-full bg-background/90 backdrop-blur-md px-3 py-1.5 text-[12px] ring-1 ring-border/60 shadow-lg"
        >
          Корпус A · Паркинг
        </motion.div>
      </div>
      <div className="absolute right-4 bottom-4 z-10 hidden md:block">
        <motion.div 
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 rounded-full bg-background/90 backdrop-blur-md px-3 py-1.5 text-[12px] ring-1 ring-border/60 shadow-lg"
        >
          Корпус B · Без паркинга
        </motion.div>
      </div>
      
      {/* Mobile helper hint - moved to bottom, dismissible */}
      {isMobile && showMobileHint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25 }}
          className="absolute left-3 right-3 bottom-16 z-20 md:hidden"
        >
          <div className="bg-background/95 backdrop-blur-md rounded-full px-3 py-2 text-[12px] text-muted ring-1 ring-border/60 shadow-lg flex items-center gap-2">
            <span>💡 Потяните вниз, чтобы увеличить область просмотра</span>
            <button onClick={() => setShowMobileHint(false)} className="ml-auto text-xs px-2 py-0.5 rounded bg-surface ring-1 ring-border hover:bg-surface/80">OK</button>
          </div>
        </motion.div>
      )}

      {/* Интерактивные элементы убраны - используем только панораму */}

      <Canvas
        camera={{ position: [0, 0, 0] as any, fov: 75 }}
        dpr={[1, 2]}
      >
        {/* Камера для панорамы - убрана автоматическая фокусировка */}
        
        {/* Панорамное окружение Google Street View - основной фон */}
        {useStreetView && panoramaUrl ? (
          <StreetViewEnvironment panoramaUrl={panoramaUrl} />
        ) : (
          // Фоллбек: простое небо, если панорама недоступна
          <color attach="background" args={[0.88, 0.92, 0.97]} />
        )}
        
        {/* Освещение минимальное - панорама сама обеспечивает освещение */}
        <ambientLight intensity={1.0} />
        
        {/* Минимальная прозрачная поверхность земли (только для теней от зданий) */}
        {!useStreetView && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#d4d9d0" roughness={0.9} transparent opacity={0.2} />
          </mesh>
        )}
        
        {/* Управление камерой для панорамы - можно крутить и смотреть вокруг */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          zoomSpeed={0.3}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.1}
          maxPolarAngle={Math.PI}
          minPolarAngle={0}
          minDistance={0.1}
          maxDistance={2}
          autoRotate={false}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Mobile drag handle */}
      {isMobile && (
        <motion.div 
          className="absolute left-0 right-0 bottom-0 z-20 flex items-center justify-center pb-2" 
          onTouchStart={onTouchStart} 
          onTouchMove={onTouchMove} 
          onTouchEnd={onTouchEnd}
          whileTap={{ scale: 0.95 }}
        >
          <div className="h-8 w-32 rounded-full bg-background/85 backdrop-blur-md ring-1 ring-border/60 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing">
            <div className="h-1.5 w-16 rounded-full bg-border/70" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// CameraLerp удален - больше не нужен без 3D моделей зданий
