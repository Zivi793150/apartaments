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

// Используем цвета из палитры для лучшей согласованности
function getBrand(kind: BuildingKind) { 
  return kind === "a" ? "#E0703E" : "#6C7A88"; // brand и accent-satin из CSS
}
function getAccent(kind: BuildingKind) { 
  return kind === "a" ? "#F5C4AD" : "#D4DBE3"; // brand-light и accent-satin из CSS
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
  const opacity = dimmed ? 0.15 : hovered ? 0.95 : 0.9;
  const ref = React.useRef<any>(null);
  
  return (
    <group position={position} ref={ref}>
      {hovered && !dimmed && <NeonGlow color={getBrand(kind)} />}
      
      {/* Main apartment unit - light beige wall */}
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); onHover(unit, ref.current?.getWorldPosition(new Vector3())); }}
        onPointerOut={() => { setHovered(false); onHover(null); }}
        onClick={(e) => { e.stopPropagation(); if (!dimmed) onPick(unit, ref.current?.getWorldPosition(new Vector3())); }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.9, 0.5, 0.25]} />
        <meshStandardMaterial 
          color={dimmed ? "#b8a898" : "#d4c4a8"} 
          metalness={0.05} 
          roughness={0.7} 
          transparent 
          opacity={opacity}
          emissive={hovered && !dimmed ? getBrand(kind) : "#000000"}
          emissiveIntensity={hovered && !dimmed ? 0.1 : 0}
        />
      </mesh>
      
      {/* Large dark rectangular window opening - recessed */}
      {!dimmed && (
        <mesh position={[0, 0.05, 0.13]} castShadow>
          <boxGeometry args={[0.7, 0.4, 0.05]} />
          <meshStandardMaterial 
            color="#2a2d35" 
            metalness={0.3} 
            roughness={0.6}
            emissive={hovered ? getBrand(kind) : "#000000"}
            emissiveIntensity={hovered ? 0.05 : 0}
          />
        </mesh>
      )}
    </group>
  );
}

// Environment - surrounding buildings and street
function Environment() {
  return (
    <group>
      {/* Street/ground plane - grey cobblestone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.9} metalness={0.05} />
      </mesh>
      
      {/* Background buildings - simplified blocks on hillside */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const distance = 15 + Math.random() * 5;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance + 8;
        const height = 2 + Math.random() * 3;
        const width = 1.5 + Math.random() * 1.5;
        return (
          <mesh key={`bg-building-${i}`} position={[x, height/2 - 0.8, z]} castShadow receiveShadow>
            <boxGeometry args={[width, height, width]} />
            <meshStandardMaterial color="#e8e0d6" roughness={0.8} metalness={0.05} />
          </mesh>
        );
      })}
      
      {/* Traditional building on the left - with red tile roof */}
      <group position={[-8, 0, 2]}>
        {/* Main structure */}
        <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 2.4, 3]} />
          <meshStandardMaterial color="#f5f0e8" roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Red tile roof */}
        <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <boxGeometry args={[4.5, 0.3, 4.5]} />
          <meshStandardMaterial color="#b85450" roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Small balconies */}
        {[0.5, -0.5].map((x, i) => (
          <mesh key={`balcony-${i}`} position={[x, 1.8, 1.6]} castShadow>
            <boxGeometry args={[0.8, 0.3, 0.3]} />
            <meshStandardMaterial color="#2a2d35" roughness={0.6} metalness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Building({ kind, offsetX, withParking, filter, onHoverUnit, onPickUnit }: { kind: BuildingKind; offsetX: number; withParking: boolean; filter: SceneFilter; onHoverUnit: (u: any | null, world?: Vector3) => void; onPickUnit: (u: any, world?: Vector3) => void }) {
  const units = React.useMemo(() => generateUnits(kind), [kind]);
  const width = UNITS_PER_FLOOR * 1.1 + 0.6;
  const height = FLOORS * 0.7 + 0.6;
  const isActive = (filter.activeBuilding === kind);
  const TERRACE_DEPTH = 0.12; // Consistent terrace depth
  const STEP_BACK = 0.05; // Uniform step back per floor

  return (
    <group position={[offsetX, 0, 0]}>
      {/* Subtle active highlight */}
      {isActive && (
        <mesh position={[0, 0, -0.05]} rotation={[0,0,0]}>
          <planeGeometry args={[width+0.4, height+0.4]} />
          <meshBasicMaterial color={kind === "a" ? "#E0703E" : "#6C7A88"} transparent opacity={0.08} />
        </mesh>
      )}
      
      {/* Ground level base - darker block (parking level for building A) */}
      {withParking && (
        <mesh position={[0, -height/2 + 0.15, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.3, 0.4]} />
          <meshStandardMaterial color="#9a8f7f" roughness={0.8} metalness={0.05} />
        </mesh>
      )}
      
      {/* Main facade - each floor as a stepped-back block */}
      {Array.from({ length: FLOORS }).map((_, floorIdx) => {
        const floorNum = floorIdx + 1;
        const floorY = (-height/2) + 0.3 + floorIdx * 0.7;
        const stepBack = floorIdx * STEP_BACK;
        const floorHeight = 0.65;
        const floorWidth = width;
        
        return (
          <group key={`floor-${floorNum}`}>
            {/* Floor wall block - light beige, recessed */}
            <mesh 
              position={[0, floorY + floorHeight/2, stepBack]} 
              castShadow 
              receiveShadow
            >
              <boxGeometry args={[floorWidth, floorHeight, 0.2]} />
              <meshStandardMaterial 
                color="#d4c4a8" 
                roughness={0.7} 
                metalness={0.05}
              />
            </mesh>
            
            {/* Horizontal floor divider - light grey band at bottom of each floor */}
            <mesh position={[0, floorY, stepBack + 0.1]} castShadow>
              <boxGeometry args={[floorWidth, 0.015, 0.01]} />
              <meshStandardMaterial color="#d0d5db" roughness={0.8} metalness={0.1} />
            </mesh>
            
            {/* Terrace floor - light grey, extends forward from wall */}
            <mesh position={[0, floorY, stepBack + TERRACE_DEPTH + 0.1]} castShadow receiveShadow>
              <boxGeometry args={[floorWidth - 0.08, 0.025, TERRACE_DEPTH]} />
              <meshStandardMaterial color="#e8e8e8" roughness={0.6} metalness={0.05} />
            </mesh>
            
            {/* Terrace railing */}
            {/* Top horizontal rail */}
            <mesh position={[0, floorY + 0.04, stepBack + TERRACE_DEPTH + 0.1 + 0.07]} castShadow>
              <boxGeometry args={[floorWidth - 0.08, 0.006, 0.006]} />
              <meshStandardMaterial color="#2a2d35" metalness={0.7} roughness={0.3} />
            </mesh>
            
            {/* Vertical railing posts */}
            {Array.from({ length: UNITS_PER_FLOOR + 1 }).map((_, i) => {
              const postX = (-floorWidth/2) + 0.04 + i * (floorWidth - 0.08) / UNITS_PER_FLOOR;
              return (
                <mesh 
                  key={`post-${floorNum}-${i}`} 
                  position={[postX, floorY + 0.02, stepBack + TERRACE_DEPTH + 0.1 + 0.07]} 
                  castShadow
                >
                  <boxGeometry args={[0.006, 0.05, 0.006]} />
                  <meshStandardMaterial color="#2a2d35" metalness={0.7} roughness={0.3} />
                </mesh>
              );
            })}
            
            {/* Glass panels between posts */}
            <mesh position={[0, floorY + 0.02, stepBack + TERRACE_DEPTH + 0.1 + 0.07]}>
              <boxGeometry args={[floorWidth - 0.08, 0.05, 0.001]} />
              <meshStandardMaterial 
                color="#87CEEB" 
                transparent 
                opacity={0.15} 
                metalness={0.9} 
                roughness={0.1} 
              />
            </mesh>
          </group>
        );
      })}
      
      {/* Vertical structural elements - light grey lines */}
      {/* Left edge */}
      <mesh position={[-width/2, 0, 0.08]} castShadow>
        <boxGeometry args={[0.012, height, 0.012]} />
        <meshStandardMaterial color="#c3c9cf" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Right edge */}
      <mesh position={[width/2, 0, 0.08]} castShadow>
        <boxGeometry args={[0.012, height, 0.012]} />
        <meshStandardMaterial color="#c3c9cf" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Between units */}
      {Array.from({ length: UNITS_PER_FLOOR - 1 }).map((_, i) => {
        const unitX = (-width/2) + 0.8 + (i + 1) * 1.1;
        return (
          <mesh key={`divider-${i}`} position={[unitX, 0, 0.08]} castShadow>
            <boxGeometry args={[0.008, height, 0.008]} />
            <meshStandardMaterial color="#c3c9cf" roughness={0.8} metalness={0.1} />
          </mesh>
        );
      })}

      {/* Apartment units with dark window openings */}
      {units.map((u) => {
        const x = (-width/2) + 0.8 + (u.col-1) * 1.1;
        const y = (-height/2) + 0.55 + (u.floor-1) * 0.7;
        const stepBack = (u.floor - 1) * STEP_BACK;
        const matches = (
          (filter.activeBuilding === "all" || filter.activeBuilding === kind) &&
          (!filter.onlyAvailable || u.available) &&
          (!filter.rooms || u.rooms === filter.rooms) &&
          (!filter.hoverFloor || u.floor === filter.hoverFloor)
        );
        return (
          <ApartmentBox key={u.id} kind={kind} unit={u} position={[x, y, stepBack + 0.1]} dimmed={!matches} onHover={onHoverUnit} onPick={onPickUnit} />
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
  const targetXRef = React.useRef<number>(0); // Initialize on building A (centered)
  React.useEffect(() => {
    // центры зданий соответствуют offsetX для левого/правого корпусов
    if (filter.activeBuilding === "a") targetXRef.current = 0;
    else if (filter.activeBuilding === "b") targetXRef.current = 7.2;
    else targetXRef.current = 3.6; // центр между зданиями
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
        <color attach="background" args={[0,0,0]} />
        {/* Enhanced lighting setup for premium look */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[6, 8, 6]} 
          intensity={1.2} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        {/* Additional fill light for premium look */}
        <directionalLight position={[-4, 4, -4]} intensity={0.4} />
        {/* Rim light for depth */}
        <pointLight position={[0, 8, -8]} intensity={0.3} distance={20} />
        {/* Environment - street and surrounding buildings */}
        <Environment />
        
        {/* Main building - only show building A if filter is set to A or all */}
        {(filter.activeBuilding === "a" || filter.activeBuilding === "all") && (
          <Building kind="a" withParking={true} offsetX={0} filter={filter} onHoverUnit={(u, wp) => setHovered(u ? { ...u, worldPosition: wp } : null)} onPickUnit={(u, wp) => { onPick?.({ id: u.id, area: u.area, rooms: u.rooms }); if (wp) setPulse(screenPos ?? null); setTimeout(() => setPulse(null), 350); }} />
        )}
        {/* Building B - only show if filter is set to B or all */}
        {(filter.activeBuilding === "b" || filter.activeBuilding === "all") && (
          <Building kind="b" withParking={false} offsetX={7.2} filter={filter} onHoverUnit={(u, wp) => setHovered(u ? { ...u, worldPosition: wp } : null)} onPickUnit={(u, wp) => { onPick?.({ id: u.id, area: u.area, rooms: u.rooms }); if (wp) setPulse(screenPos ?? null); setTimeout(() => setPulse(null), 350); }} />
        )}
        <ProjectorInside hovered={hovered} onProject={(pt)=>setScreenPos(pt)} />
        <OrbitControls
          ref={(ctrl:any)=>{(CameraLerp as any).controlsRef=ctrl}}
          enablePan={false}
          enableZoom={false}
          zoomSpeed={0}
          enableRotate={true}
          enableDamping={true}
          dampingFactor={0.05}
          maxPolarAngle={Math.PI/2.2}
          minPolarAngle={Math.PI/3}
          minDistance={isMobile ? 9.5 : 7.5}
          maxDistance={isMobile ? 10.5 : 8.5}
          autoRotate={false}
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
  const targetDistance = React.useRef<number>(8); // Fixed target distance
  
  useFrame(() => {
    if (!controls || !controls.target) return;
    
    // Smooth lerp camera X position
    const dx = targetXRef.current - camera.position.x;
    camera.position.x += dx * 0.08;
    
    // Smooth lerp target X position
    const dtx = targetXRef.current - controls.target.x;
    controls.target.x += dtx * 0.1;
    
    // Maintain fixed distance from target to prevent zoom
    const currentDistance = camera.position.distanceTo(controls.target);
    if (Math.abs(currentDistance - targetDistance.current) > 0.1) {
      const direction = new Vector3()
        .subVectors(camera.position, controls.target)
        .normalize();
      const correctedPos = direction.multiplyScalar(targetDistance.current).add(controls.target);
      camera.position.lerp(correctedPos, 0.2);
    }
    
    controls.update();
  });
  return null;
}
