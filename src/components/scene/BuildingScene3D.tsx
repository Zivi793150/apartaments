"use client";
import * as React from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { motion } from "framer-motion";

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

function ProjectorInside({ hovered, onProject }: { hovered: any | null; onProject: (pt: {x:number;y:number}|null) => void }) {
  const { size, camera } = useThree();
  React.useEffect(() => {
    if (hovered && hovered.worldPosition instanceof Vector3) {
      const v = hovered.worldPosition.clone().project(camera);
      const x = (v.x + 1) / 2 * size.width;
      const y = (-v.y + 1) / 2 * size.height;
      onProject({ x, y });
    } else {
      onProject(null);
    }
  }, [hovered, size, camera, onProject]);
  return null;
}

export default function BuildingScene3D({ filter, onPick }: { filter: SceneFilter; onPick?: (u: PickedUnit) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState<any | null>(null);
  const [screenPos, setScreenPos] = React.useState<{x:number;y:number}|null>(null);
  const [pulse, setPulse] = React.useState<{x:number;y:number}|null>(null);
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

  // smooth focus to active building (A/B/All) - starts on A
  const targetXRef = React.useRef<number>(-3.6); // Initialize on building A
  React.useEffect(() => {
    // центры зданий соответствуют offsetX для левого/правого корпусов
    if (filter.activeBuilding === "a") targetXRef.current = -3.6;
    else if (filter.activeBuilding === "b") targetXRef.current = 3.6;
    else targetXRef.current = 0; // центр
  }, [filter.activeBuilding]);

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

      {/* Hover overlay card */}
      {hovered && screenPos && (
        <div className="pointer-events-none absolute z-20" style={{ left: screenPos.x - 90, top: screenPos.y - 120 }}>
          <div className="rounded-2xl bg-background/95 backdrop-blur ring-1 ring-border shadow-xl px-3 py-2 w-[180px]">
            <div className="text-[12px] text-muted mb-0.5">Этаж {hovered.floor}</div>
            <div className="text-[16px] font-medium">
              {hovered.id}
              <span className={`ml-2 inline-block size-2 rounded-full align-middle ${hovered.available?"bg-brand":"bg-muted"}`} />
            </div>
            <div className="text-[12px] text-muted">{hovered.area} м² · {hovered.rooms}к</div>
          </div>
        </div>
      )}

      {/* Click pulse feedback */}
      {pulse && (
        <div className="pointer-events-none absolute z-20" style={{ left: pulse.x - 10, top: pulse.y - 10 }}>
          <div className="size-5 rounded-full bg-brand/60 animate-ping" />
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: isMobile ? [6.2, 5.2, 10.5] as any : [7.2, 5.2, 11.5] as any, fov: isMobile ? 42 : 36 }}
        dpr={[1, 2]}
        onPointerMissed={() => { setHovered(null); }}
      >
        {/* Smooth camera focus on active building */}
        <CameraLerp targetXRef={targetXRef} />
        {/* Sky gradient background */}
        <color attach="background" args={[0.88, 0.92, 0.97]} />
        {/* Atmospheric fog for depth */}
        <fog attach="fog" args={["#B8D4E8", 15, 50]} />
        {/* Sky dome with gradient - внутренняя сторона */}
        <mesh>
          <sphereGeometry args={[50, 32, 16]} />
          <meshBasicMaterial color="#B8D4E8" side={2} />
        </mesh>
        
        {/* Enhanced lighting setup for premium look */}
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[6, 8, 6]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        {/* Additional fill light for premium look */}
        <directionalLight position={[-4, 4, -4]} intensity={0.5} />
        {/* Rim light for depth */}
        <pointLight position={[0, 8, -8]} intensity={0.4} distance={30} />
        
        {/* Ground/Street - расширенная поверхность */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#d4d9d0" roughness={0.9} />
        </mesh>
        
        {/* Street markings */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.79, 0]} receiveShadow>
          <planeGeometry args={[4, 80]} />
          <meshStandardMaterial color="#9ca3a0" roughness={0.8} />
        </mesh>
        
        {/* Surrounding buildings - левая сторона */}
        <group position={[-12, 0, -5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3, 4, 3]} />
            <meshStandardMaterial color="#c8d0d8" roughness={0.7} metalness={0.1} />
          </mesh>
        </group>
        <group position={[-15, 0, 2]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2.5, 3.5, 2.5]} />
            <meshStandardMaterial color="#d0d8e0" roughness={0.7} metalness={0.1} />
          </mesh>
        </group>
        
        {/* Surrounding buildings - правая сторона */}
        <group position={[12, 0, -5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3, 4.5, 3]} />
            <meshStandardMaterial color="#c8d0d8" roughness={0.7} metalness={0.1} />
          </mesh>
        </group>
        <group position={[15, 0, 2]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2.5, 3.8, 2.5]} />
            <meshStandardMaterial color="#d0d8e0" roughness={0.7} metalness={0.1} />
          </mesh>
        </group>
        
        {/* Trees - левая сторона */}
        {Array.from({ length: 4 }).map((_, i) => (
          <group key={`tree-l-${i}`} position={[-8 - i * 2, 0, -8 + i * 1.5]}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <coneGeometry args={[0.8, 2, 8]} />
              <meshStandardMaterial color="#4a7c59" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.1, 0.1, 1.5]} />
              <meshStandardMaterial color="#5d4037" roughness={0.8} />
            </mesh>
          </group>
        ))}
        
        {/* Trees - правая сторона */}
        {Array.from({ length: 4 }).map((_, i) => (
          <group key={`tree-r-${i}`} position={[8 + i * 2, 0, -8 + i * 1.5]}>
            <mesh position={[0, 1.5, 0]} castShadow>
              <coneGeometry args={[0.8, 2, 8]} />
              <meshStandardMaterial color="#4a7c59" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.1, 0.1, 1.5]} />
              <meshStandardMaterial color="#5d4037" roughness={0.8} />
            </mesh>
          </group>
        ))}
        
        {/* Background buildings - дальний план */}
        {Array.from({ length: 6 }).map((_, i) => (
          <group key={`bg-${i}`} position={[-20 + i * 7, 0, -15]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2, 2 + Math.random() * 2, 2]} />
              <meshStandardMaterial color="#b0b8c0" roughness={0.8} metalness={0.1} />
            </mesh>
          </group>
        ))}
        
        {/* Main buildings */}
        <Building kind="a" withParking offsetX={-3.6} filter={filter} onHoverUnit={(u, wp) => setHovered(u ? { ...u, worldPosition: wp } : null)} onPickUnit={(u, wp) => { onPick?.({ id: u.id, area: u.area, rooms: u.rooms }); if (wp) setPulse(screenPos ?? null); setTimeout(() => setPulse(null), 350); }} />
        <Building kind="b" withParking={false} offsetX={3.6} filter={filter} onHoverUnit={(u, wp) => setHovered(u ? { ...u, worldPosition: wp } : null)} onPickUnit={(u, wp) => { onPick?.({ id: u.id, area: u.area, rooms: u.rooms }); if (wp) setPulse(screenPos ?? null); setTimeout(() => setPulse(null), 350); }} />
        <ProjectorInside hovered={hovered} onProject={(pt)=>setScreenPos(pt)} />
        <OrbitControls
          ref={(ctrl:any)=>{(CameraLerp as any).controlsRef=ctrl}}
          enablePan={true}
          enableZoom={true}
          zoomSpeed={0.5}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.05}
          maxPolarAngle={Math.PI/2.1}
          minPolarAngle={0}
          minDistance={isMobile ? 8 : 6}
          maxDistance={isMobile ? 25 : 30}
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

function CameraLerp({ targetXRef }: { targetXRef: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const controls = (CameraLerp as any).controlsRef as any | undefined;
  
  useFrame(() => {
    if (!controls || !controls.target) return;
    
    // Smooth lerp target X position для фокуса на выбранном здании
    // Но позволяем пользователю свободно панорамировать
    const dtx = targetXRef.current - controls.target.x;
    controls.target.x += dtx * 0.05; // Медленнее, чтобы не мешать ручному управлению
    
    controls.update();
  });
  return null;
}
